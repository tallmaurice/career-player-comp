// =============================================================================
// POST /api/generate-comp  — the Career Player Comp v7 engine
//
// Body:    { careerText: string; answers: QuizAnswers }
// Returns: 200 { comp: Comp }
//          400 { error } on bad input
//          429 { error } on per-IP or global daily-spend limit
//          503 { error } on Anthropic / timeout failure
//
// Engine (v7): a SINGLE balanced generation pass. The v7 spike that locked the
// engine was single-generation (no best-of-3, no judge) and produced shippable,
// biting cards on 6/6 profiles. Best-of-3 + a judge call added 3-4x the latency,
// which blew the serverless function budget (the "scout took too long" error)
// for no quality gain we'd validated. So v1 ships single-pass: fast, cheap, and
// exactly what we tested. Best-of-3 can return later on a plan with more time.
//
// Caching: the system string (the v7 prompt alone, ~13k tokens — the candidate
// roster is injected per-request into the USER message) is byte-identical
// across every request, so it is the prompt-cache prefix — marked with
// cache_control: ephemeral. Per-request content lives after the breakpoint.
//
// Model: claude-sonnet-4-6.
// =============================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { Comp, QuizAnswers } from "@/lib/types";
import { SYSTEM_STRING, buildUserMessage, parseComp, PLAYER_POOL } from "@/lib/engine";
import { retrieveCandidates } from "@/lib/engine/retrieval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel function budget. On the Pro plan the ceiling is 300s; we set 120 so a
// COLD-cache run (the system prompt is ~13k input tokens now that the pool
// moved to a per-request roster in the user message, but a cold ephemeral cache
// must still prefill all of it before generating — historically the cause of
// the "scout took too long" timeouts at ~60k) has ample headroom.
// Warm-cache runs (steady traffic) finish far faster; this is just the ceiling.
export const maxDuration = 120;

// ---- Tunables ---------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";
// The Comp now carries the full_report plus the enrichment fields (OVR/POT/
// rationale, badge tiers, contract, draft, a stats-by-season table, and
// strengths/weaknesses). max_tokens is a cap, not a target — the model stops
// when done (~1200-1600 tokens typical now), so this only sets headroom (enough
// that a long résumé's season table can't truncate the JSON), not latency.
const GEN_MAX_TOKENS = 2400;
// Abort comfortably under maxDuration so the user gets the friendly message, not
// a 504. Streaming keeps the call robust across the full budget. 105s leaves
// room even for a cold prefill + the full generation, with margin to respond.
const OVERALL_TIMEOUT_MS = 105_000;

// Per-IP and global limits (only enforced when Upstash env is present).
const PER_IP_LIMIT = 5; // requests
const PER_IP_WINDOW = "1 h" as const;
// Global daily kill-switch: max non-bypass generations per UTC day — the hard
// ceiling on a runaway bill. Cost per comp ≈ $0.06 warm / ≈ $0.13 cold (the
// ~13k-token cached system prompt is the swing between the two).
// So worst-case daily spend ≈ this count × ~$0.13. To set a $ ceiling:
// count = $ / 0.13.
// LAUNCH WEEK (set 2026-06-30, bumped 2500→5000 the night before launch so a
// viral spike — e.g. a radio mention — isn't cut off mid-moment). Worst case
// (all cold) ≈ $650; warm launch traffic runs ~$0.06/comp so realistic spend is
// well under that. REVISIT after this week (Maurice) — drop back down once the
// spike passes. When this trips, the front end shows the branded "scouts are out"
// page (sponsor + tip).
const DAILY_SPEND_CAP = 10000;
// IPs that skip ALL limits (your own, for testing/demos). Comma-separated env var.
const BYPASS_IPS = new Set(
  (process.env.RATE_LIMIT_BYPASS_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

// ---- Anthropic client -------------------------------------------------------

const apiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

// The cached system block: stable prefix → cache_control ephemeral. Built once.
const SYSTEM_BLOCKS: Anthropic.TextBlockParam[] = [
  {
    type: "text",
    text: SYSTEM_STRING,
    // 1-hour cache TTL (vs the 5-minute default). Keeps the ~13k-token system
    // prompt warm for a full hour after each comp, so sporadic launch traffic
    // (people trickling in minutes-to-an-hour apart) gets a cheap cache read
    // (comp ≈ $0.06 warm) instead of a fresh cold write (≈ $0.13). The 1h write
    // costs 2x vs the 5m write's 1.25x, so a truly isolated comp is slightly
    // pricier, but any clustering within the hour wins big; the daily spend cap
    // bounds the downside either way.
    cache_control: { type: "ephemeral", ttl: "1h" },
  },
];

// ---- Rate limiting / kill-switch (graceful no-op without Upstash) -----------

type LimitState = { rateLimited: boolean; spendExhausted: boolean };

async function checkLimits(ip: string): Promise<LimitState> {
  if (BYPASS_IPS.has(ip)) {
    // Allowlisted (you): no per-IP limit, and don't count toward the daily cap.
    return { rateLimited: false, spendExhausted: false };
  }
  // Accept either the native Upstash names OR the Vercel-Upstash marketplace
  // names (KV_REST_API_*), so the limiter works however Upstash was provisioned.
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    // Dev / unconfigured: no limits.
    return { rateLimited: false, spendExhausted: false };
  }

  // Lazy-import so the route still builds and runs when Upstash isn't configured.
  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import("@upstash/ratelimit"),
      import("@upstash/redis"),
    ]);
    const redis = new Redis({ url, token });

    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(PER_IP_LIMIT, PER_IP_WINDOW),
      prefix: "cpc:ip",
    });
    const { success } = await ratelimit.limit(ip);
    // Rate-limited requests must NOT count toward the daily cap — otherwise
    // free 429s (one hot IP or a stuck retry loop) trip the kill-switch for everyone.
    if (!success) return { rateLimited: true, spendExhausted: false };

    // Global daily spend kill-switch: a per-UTC-day counter.
    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const spendKey = `cpc:spend:${day}`;
    const count = await redis.incr(spendKey);
    if (count === 1) {
      await redis.expire(spendKey, 60 * 60 * 48);
    }
    const spendExhausted = count > DAILY_SPEND_CAP;

    return { rateLimited: !success, spendExhausted };
  } catch {
    // Infra blip: fail OPEN on the limiter; the 503 wrap still bounds cost.
    return { rateLimited: false, spendExhausted: false };
  }
}

/** Increment the global "careers scouted" counter and return this user's number
 *  (social proof). No-ops to null when Upstash isn't configured, or for bypass
 *  IPs (so your own test runs don't inflate it). Stores only a counter — no user
 *  content, consistent with the no-storage promise. */
async function recordScouted(ip: string): Promise<number | null> {
  if (BYPASS_IPS.has(ip)) return null;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url, token });
    return await redis.incr("cpc:scouted:total");
  } catch {
    return null;
  }
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "anon";
}

// ---- Generation -------------------------------------------------------------

function textFromMessage(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** One generation pass on a given lens, with a single retry on invalid JSON or
 *  out-of-pool player. Returns null if both attempts fail. */
async function generateCandidate(
  client: Anthropic,
  userMessage: string,
  signal: AbortSignal,
): Promise<Comp | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    // Stream the generation. The output is large now (full report + season table
    // + enrichment fields); a non-streaming blocking call risks socket/idle
    // timeouts as it approaches the function budget. Streaming keeps the
    // connection active and reliably completes within maxDuration. We still only
    // act on the final assembled message.
    const msg = await client.messages
      .stream(
        {
          model: MODEL,
          max_tokens: GEN_MAX_TOKENS,
          // Locked decision (build-state): low temp so same input = same comp.
          // Was never wired in — prod ran at API default 1.0 until 2026-07-01.
          temperature: 0.2,
          system: SYSTEM_BLOCKS,
          messages: [
            {
              role: "user",
              content:
                attempt === 0
                  ? userMessage
                  : userMessage +
                    "\n\nREMINDER: output VALID JSON ONLY, exactly the schema, and player_name MUST be one of the approved pool names exactly.",
            },
          ],
        },
        { signal },
      )
      .finalMessage();
    const parsed = parseComp(textFromMessage(msg));
    if (parsed.ok) return parsed.comp;
  }
  return null;
}

// ---- Handler ----------------------------------------------------------------

interface RequestBody {
  careerText?: unknown;
  answers?: unknown;
}

function validateAnswers(a: unknown): QuizAnswers | null {
  if (typeof a !== "object" || a === null) return null;
  const o = a as Record<string, unknown>;
  const out: Partial<QuizAnswers> = {};
  // q1-q8 required, q9/q10 optional.
  for (const k of ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"] as const) {
    if (typeof o[k] !== "string" || (o[k] as string).trim() === "") return null;
    out[k] = o[k] as string;
  }
  for (const k of ["q9", "q10"] as const) {
    if (typeof o[k] === "string") out[k] = (o[k] as string).slice(0, 1_000);
  }
  return out as QuizAnswers;
}

export async function POST(req: Request): Promise<Response> {
  if (!anthropic) {
    return Response.json(
      { error: "The scout is not configured. Try again later." },
      { status: 503 },
    );
  }

  // ---- Parse + validate input ----
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Cap input: LinkedIn exports run ~2-10K chars; an uncapped paste/PDF
  // multiplies token cost up to 4x on the retry path or 400s outright.
  const careerText = (typeof body.careerText === "string" ? body.careerText : "").slice(0, 20_000);
  const answers = validateAnswers(body.answers);
  if (!answers) {
    return Response.json(
      { error: "Answer all eight questions before the scout can read you." },
      { status: 400 },
    );
  }
  // With no resume the quiz still carries it — the v7 prompt handles a thin tape.

  // ---- Limits ----
  const ip = clientIp(req);
  const { rateLimited, spendExhausted } = await checkLimits(ip);
  if (spendExhausted) {
    // Global daily cap tripped -> the branded "scouts are out for the day" page.
    return Response.json(
      {
        error: "The scouts are out for the day. Back tomorrow.",
        reason: "daily_cap",
      },
      { status: 429 },
    );
  }
  if (rateLimited) {
    return Response.json(
      {
        error: "Easy. The scout can only read so many careers an hour. Try again soon.",
        reason: "rate_limit",
      },
      { status: 429 },
    );
  }

  // ---- Generate (single balanced pass) ----
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERALL_TIMEOUT_MS);

  try {
    // RETRIEVAL: deterministically classify this career and pick a ~40-player
    // candidate roster that is relevant but internally varied (no API call).
    // Only this shortlist is shown to the model — it forces variety across users
    // (the ~12-20-names-only problem) and keeps the per-call payload small.
    const { candidates } = retrieveCandidates(careerText, answers, PLAYER_POOL);

    // The balanced "best" lens: maximum accuracy AND maximum earned bite in one
    // pass (the v7 spot-check config). The system prompt makes both co-primary.
    let comp = await generateCandidate(
      anthropic,
      buildUserMessage(careerText, answers, "best", candidates),
      controller.signal,
    );
    // If the first pass failed twice (rare), one fallback on the roast lens.
    if (!comp) {
      comp = await generateCandidate(
        anthropic,
        buildUserMessage(careerText, answers, "roast", candidates),
        controller.signal,
      );
    }
    if (!comp) {
      return Response.json(
        { error: "The scout couldn't get a clean read. Try again." },
        { status: 503 },
      );
    }
    const scouted = await recordScouted(ip);
    return Response.json(
      { comp, scouted: scouted ?? undefined },
      { status: 200 },
    );
  } catch (err) {
    const aborted =
      controller.signal.aborted ||
      (err instanceof Error && err.name === "AbortError");
    if (aborted) {
      return Response.json(
        { error: "The scout took too long on this one. Give it another shot." },
        { status: 503 },
      );
    }
    // Anthropic API errors (overload, auth, upstream limit) → friendly 503.
    // Surface the REAL cause in Vercel function logs so a fast-fail can be
    // diagnosed (status + name + message); the user still gets the friendly
    // message. Anthropic SDK errors carry a numeric `.status` (401 auth, 429
    // rate/credit limit, 529 overloaded).
    console.error("[generate-comp] generation failed:", {
      name: err instanceof Error ? err.name : typeof err,
      status: (err as { status?: unknown } | null)?.status ?? null,
      message: err instanceof Error ? err.message : String(err),
    });
    return Response.json(
      { error: "The scout's having a moment. Try again in a few seconds." },
      { status: 503 },
    );
  } finally {
    clearTimeout(timer);
  }
}

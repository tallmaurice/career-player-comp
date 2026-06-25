// =============================================================================
// POST /api/generate-comp  — the Career Player Comp v7 engine
//
// Body:    { careerText: string; answers: QuizAnswers }
// Returns: 200 { comp: Comp }
//          400 { error } on bad input
//          429 { error } on per-IP or global daily-spend limit
//          503 { error } on Anthropic / timeout failure
//
// Engine (v7): best-of-3 generation with 3 lens variations + a cold judge that
// scores on accuracy AND fun. CONDITIONAL to save cost: generate candidate 1,
// judge it solo; only fire candidates 2 and 3 if the first is weak, then judge
// all three. NO banned-phrase pre-filter (v7 removed it). Accuracy gates and
// safety guards live in the system prompt itself.
//
// Caching: the system string (v7 prompt + injected pool) is byte-identical
// across every request, so it is the prompt-cache prefix — marked with
// cache_control: ephemeral. Per-request content (career, answers, lens) lives
// in the user message after the breakpoint and is never cached.
//
// Model: claude-sonnet-4-6 (chosen for cost per the engine spec). Sonnet 4.6
// supports prompt caching with cache_control: { type: "ephemeral" }.
// =============================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { Comp, QuizAnswers } from "@/lib/types";
import {
  SYSTEM_STRING,
  buildUserMessage,
  parseComp,
  type Lens,
} from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---- Tunables ---------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";
// The Comp is 11 fields including a 2-4 paragraph full_report. 1200 (spec note)
// truncates the report; 2000 gives headroom without much cost (output billed by
// actual tokens). Judge is a tiny structured reply, so it gets a small cap.
const GEN_MAX_TOKENS = 2000;
const JUDGE_MAX_TOKENS = 400;
const OVERALL_TIMEOUT_MS = 20_000;

// Per-IP and global limits (only enforced when Upstash env is present).
const PER_IP_LIMIT = 5; // requests
const PER_IP_WINDOW = "1 h" as const;
const DAILY_SPEND_CAP = 1500; // max generations per UTC day (global kill-switch)

// ---- Anthropic client -------------------------------------------------------

const apiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

// The cached system block: stable prefix → cache_control ephemeral. Built once.
// Passed as the `system` param (string | TextBlockParam[]); the cache breakpoint
// on this block caches the whole v7 prompt + injected pool across every request.
const SYSTEM_BLOCKS: Anthropic.TextBlockParam[] = [
  {
    type: "text",
    text: SYSTEM_STRING,
    cache_control: { type: "ephemeral" },
  },
];

// ---- Rate limiting / kill-switch (graceful no-op without Upstash) -----------

type LimitState = { rateLimited: boolean; spendExhausted: boolean };

async function checkLimits(ip: string): Promise<LimitState> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // Dev / unconfigured: no limits.
    return { rateLimited: false, spendExhausted: false };
  }

  // Lazy-import so the route still builds and runs when Upstash isn't installed
  // or configured. Dynamic import keeps it out of the cold path when absent.
  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import("@upstash/ratelimit"),
      import("@upstash/redis"),
    ]);
    const redis = new Redis({ url, token });

    // Per-IP sliding window.
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(PER_IP_LIMIT, PER_IP_WINDOW),
      prefix: "cpc:ip",
    });
    const { success } = await ratelimit.limit(ip);

    // Global daily spend kill-switch: a per-UTC-day counter.
    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const spendKey = `cpc:spend:${day}`;
    const count = await redis.incr(spendKey);
    if (count === 1) {
      // First write today — expire the counter ~2 days out.
      await redis.expire(spendKey, 60 * 60 * 48);
    }
    const spendExhausted = count > DAILY_SPEND_CAP;

    return { rateLimited: !success, spendExhausted };
  } catch {
    // If Upstash is misbehaving, fail OPEN on the limiter (don't block users on
    // an infra blip) but treat the request as allowed. The Anthropic-side
    // failure path still protects us from runaway cost via the 503 wrap.
    return { rateLimited: false, spendExhausted: false };
  }
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "anon";
}

// ---- Anthropic calls --------------------------------------------------------

function textFromMessage(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Generate one candidate for a given lens, with a single retry on invalid
 *  JSON or out-of-pool player. Returns null if both attempts fail. */
async function generateCandidate(
  client: Anthropic,
  userMessage: string,
  signal: AbortSignal,
): Promise<Comp | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await client.messages.create(
      {
        model: MODEL,
        max_tokens: GEN_MAX_TOKENS,
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
    );
    const parsed = parseComp(textFromMessage(msg));
    if (parsed.ok) return parsed.comp;
  }
  return null;
}

const JUDGE_SYSTEM =
  "You are a cold, fast editor for a self-aware career-roast product. You did not write these. Judge each candidate scouting report on TWO axes equally: ACCURACY (does it prove it read THIS specific career and assign a player whose real arc genuinely fits) and FUN (is the screenshot_line and card_summary genuinely sharp, true, and screenshot-worthy without crossing into cruelty or hitting anything uncontrollable). Penalize generic comps that could fit anyone, lazy famous-name picks, and soft/toothless writing. Reward precise non-obvious picks with a true, funny bite.";

/** Judge: given candidates, return the index of the best, plus whether the best
 *  is strong enough to ship without generating more. Returns index 0 and weak
 *  on any failure (caller falls back to the first valid candidate). */
async function judge(
  client: Anthropic,
  candidates: Comp[],
  signal: AbortSignal,
): Promise<{ winner: number; strong: boolean }> {
  if (candidates.length === 1) {
    // Solo gate: is candidate 0 strong enough to ship as-is?
    const card = JSON.stringify({
      player_name: candidates[0].player_name,
      archetype_title: candidates[0].archetype_title,
      card_summary: candidates[0].card_summary,
      screenshot_line: candidates[0].screenshot_line,
      why_this_player: candidates[0].why_this_player,
    });
    const msg = await client.messages.create(
      {
        model: MODEL,
        max_tokens: JUDGE_MAX_TOKENS,
        system: JUDGE_SYSTEM,
        messages: [
          {
            role: "user",
            content:
              `Here is one candidate comp:\n${card}\n\n` +
              `Is it strong on BOTH accuracy and fun — precise pick, true and genuinely sharp line, would a stranger screenshot it? ` +
              `Reply with ONLY JSON: {"strong": true|false}. ` +
              `Be strict: "strong" is false if the pick feels generic/lazy or the line is soft.`,
          },
        ],
      },
      { signal },
    );
    try {
      const t = textFromMessage(msg);
      const m = t.match(/\{[\s\S]*\}/);
      const v = m ? (JSON.parse(m[0]) as { strong?: unknown }) : {};
      return { winner: 0, strong: v.strong === true };
    } catch {
      return { winner: 0, strong: false };
    }
  }

  // Pick-the-best across multiple candidates.
  const summary = candidates
    .map((c, i) =>
      JSON.stringify({
        index: i,
        player_name: c.player_name,
        archetype_title: c.archetype_title,
        card_summary: c.card_summary,
        screenshot_line: c.screenshot_line,
        why_this_player: c.why_this_player,
      }),
    )
    .join("\n");
  const msg = await client.messages.create(
    {
      model: MODEL,
      max_tokens: JUDGE_MAX_TOKENS,
      system: JUDGE_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Here are ${candidates.length} candidate comps for the same person:\n${summary}\n\n` +
            `Pick the single best on accuracy AND fun combined. ` +
            `Reply with ONLY JSON: {"winner": <index>}.`,
        },
      ],
    },
    { signal },
  );
  try {
    const t = textFromMessage(msg);
    const m = t.match(/\{[\s\S]*\}/);
    const v = m ? (JSON.parse(m[0]) as { winner?: unknown }) : {};
    const w =
      typeof v.winner === "number" &&
      v.winner >= 0 &&
      v.winner < candidates.length
        ? v.winner
        : 0;
    return { winner: w, strong: true };
  } catch {
    return { winner: 0, strong: true };
  }
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
    if (typeof o[k] === "string") out[k] = o[k] as string;
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

  const careerText = typeof body.careerText === "string" ? body.careerText : "";
  const answers = validateAnswers(body.answers);
  if (!answers) {
    return Response.json(
      { error: "Answer all eight questions before the scout can read you." },
      { status: 400 },
    );
  }
  // With no resume AND no free-text signal, the quiz still carries it — the v7
  // prompt handles a thin/empty tape. So we don't hard-require careerText.

  // ---- Limits ----
  const { rateLimited, spendExhausted } = await checkLimits(clientIp(req));
  if (spendExhausted) {
    return Response.json(
      { error: "The scout is taking the rest of the day off. Back tomorrow." },
      { status: 429 },
    );
  }
  if (rateLimited) {
    return Response.json(
      { error: "Easy — the scout can only read so many careers an hour. Try again soon." },
      { status: 429 },
    );
  }

  // ---- Generate (best-of-3, conditional judge) ----
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERALL_TIMEOUT_MS);

  try {
    const lenses: Lens[] = ["sharp", "roast", "pattern"];

    // Candidate 1 (sharp). Judge it solo; only generate 2 & 3 if it's weak.
    const c1 = await generateCandidate(
      anthropic,
      buildUserMessage(careerText, answers, lenses[0]),
      controller.signal,
    );

    if (!c1) {
      // First lens failed twice — try the roast lens once as a fallback.
      const fallback = await generateCandidate(
        anthropic,
        buildUserMessage(careerText, answers, lenses[1]),
        controller.signal,
      );
      if (!fallback) {
        return Response.json(
          { error: "The scout couldn't get a clean read. Try again." },
          { status: 503 },
        );
      }
      return Response.json({ comp: fallback }, { status: 200 });
    }

    const solo = await judge(anthropic, [c1], controller.signal);
    if (solo.strong) {
      return Response.json({ comp: c1 }, { status: 200 });
    }

    // Weak — fire candidates 2 (roast) and 3 (pattern) in parallel.
    const [c2, c3] = await Promise.all([
      generateCandidate(
        anthropic,
        buildUserMessage(careerText, answers, lenses[1]),
        controller.signal,
      ),
      generateCandidate(
        anthropic,
        buildUserMessage(careerText, answers, lenses[2]),
        controller.signal,
      ),
    ]);

    const candidates: Comp[] = [c1, c2, c3].filter(
      (c): c is Comp => c !== null,
    );
    if (candidates.length === 1) {
      return Response.json({ comp: candidates[0] }, { status: 200 });
    }

    const verdict = await judge(anthropic, candidates, controller.signal);
    const winner = candidates[verdict.winner] ?? candidates[0];
    return Response.json({ comp: winner }, { status: 200 });
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
    // Anthropic API errors (rate limit upstream, overload, auth) → friendly 503.
    return Response.json(
      { error: "The scout's having a moment. Try again in a few seconds." },
      { status: 503 },
    );
  } finally {
    clearTimeout(timer);
  }
}

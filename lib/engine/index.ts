// =============================================================================
// Career Player Comp — engine internals (v7)
//
// Pure, side-effect-free helpers shared by the route handler: building the
// cached system string, composing the per-request user message, parsing and
// validating a candidate Comp, and the lens variations for best-of-3.
//
// The deployed app does NOT depend on the aios folder; system-prompt.ts and
// player-pool.json are the self-contained copies.
// =============================================================================

import type { Comp, QuizAnswers } from "@/lib/types";
import { SYSTEM_PROMPT_V7, PLAYER_POOL_SLOT } from "./system-prompt";
import poolJson from "./player-pool.json";

// ---- Player pool ------------------------------------------------------------

/** One entry in the approved roster (player-pool-v3.json). Only `name` is
 *  load-bearing for engine validation; the rest is matching context for the
 *  model. Kept loose on purpose — the JSON is the source of truth. */
export interface PoolPlayer {
  name: string;
  position_era: string;
  altitude: string;
  temperament: string;
  arc: string;
  distinctive_detail: string;
  work_style: string;
  career_traits: string[];
  "2k_label": string;
  comp_tone: string;
  league: string;
}

export const PLAYER_POOL = poolJson as PoolPlayer[];

/** Lowercased set of every valid player name, for out-of-pool validation. */
const POOL_NAMES = new Set(PLAYER_POOL.map((p) => p.name.trim().toLowerCase()));

export function isPlayerInPool(name: string): boolean {
  return POOL_NAMES.has(name.trim().toLowerCase());
}

// ---- System string (stable, cacheable prefix) -------------------------------

/**
 * The full system string: v7 prompt with the player pool injected at its slot.
 *
 * This is byte-identical across every request and every user, so it is the
 * prompt-cache prefix. NOTHING per-request (career text, answers, lens) goes
 * in here — those live in the user message after the cache breakpoint.
 *
 * Computed once at module load.
 */
export const SYSTEM_STRING: string = SYSTEM_PROMPT_V7.replace(
  PLAYER_POOL_SLOT,
  JSON.stringify(PLAYER_POOL),
);

// ---- Lens variations for best-of-3 ------------------------------------------

/** A generation lens. Steers emphasis without changing the task or the schema.
 *  Lives in the user message so the cached system prefix never varies. */
export type Lens = "sharp" | "roast" | "pattern";

const LENS_NOTE: Record<Lens, string> = {
  sharp:
    "LENS FOR THIS PASS: precision. Find the single most exact, non-obvious player in the pool whose real arc rhymes with this career move-for-move. Land the truest read. Bite comes from accuracy.",
  roast:
    "LENS FOR THIS PASS: the roast. Locate the self-image gap and the one thing they half-know and have never heard said this cleanly. Push the screenshot_line to its sharpest TRUE form. Stay accurate and never cross into cruelty or the uncontrollable.",
  pattern:
    "LENS FOR THIS PASS: the pattern. Read for the recurring behavior across the whole tape — the move they keep making — and build the comp and the tendency badge around that pattern, not a single moment.",
};

// ---- User message -----------------------------------------------------------

const ANSWER_LABELS: Record<keyof QuizAnswers, string> = {
  q1: "ALTITUDE",
  q2: "SCOPE",
  q3: "TEMPERAMENT",
  q4: "ARC",
  q5: "CONFLICT",
  q6: "SELF-IMAGE GAP",
  q7: "ENDGAME",
  q8: "MOTIVATION",
  q9: "SECRET WEAPON (the thing nobody says out loud)",
  q10: "RESUME SAFETY-NET",
};

const ANSWER_ORDER: (keyof QuizAnswers)[] = [
  "q1",
  "q2",
  "q3",
  "q4",
  "q5",
  "q6",
  "q7",
  "q8",
  "q9",
  "q10",
];

/**
 * Compose the per-request user message: career data + the 10 answers + lens.
 * Labels carry the dimension the prompt expects (ALTITUDE, etc.) but NOT the
 * "Q1/Q9" tags the prompt forbids in output — the model reads the dimension,
 * the user never sees a question number.
 */
export function buildUserMessage(
  careerText: string,
  answers: QuizAnswers,
  lens: Lens,
): string {
  const career = careerText.trim();
  const careerBlock = career
    ? `CAREER DATA (primary signal):\n${career}`
    : `CAREER DATA: (none provided — no resume. The quiz answers ARE the tape. Build with full confidence from the behavioral pattern, per THIN OR MISSING RESUME.)`;

  const answerLines = ANSWER_ORDER.map((k) => {
    const v = answers[k];
    if (v == null || v.trim() === "") {
      return k === "q9" || k === "q10"
        ? `${ANSWER_LABELS[k]}: (skipped)`
        : null;
    }
    return `${ANSWER_LABELS[k]}: ${v.trim()}`;
  })
    .filter((l): l is string => l !== null)
    .join("\n");

  return [
    careerBlock,
    "",
    "ANSWERS:",
    answerLines,
    "",
    LENS_NOTE[lens],
    "",
    "Return valid JSON only, exactly the schema in the system prompt. No prose before or after.",
  ].join("\n");
}

// ---- Comp parsing + validation ----------------------------------------------

export type ParseResult =
  | { ok: true; comp: Comp }
  | { ok: false; reason: "json" | "shape" | "out_of_pool"; detail: string };

/** Strip a leading/trailing ```json fence if the model added one, then locate
 *  the outermost JSON object. */
function extractJson(text: string): string | null {
  let t = text.trim();
  // Strip markdown fences if present.
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1].trim();
  // Find the first { and last } — the schema is a single object.
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  return t.slice(first, last + 1);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Parse a raw model response into a validated Comp.
 * Validates: JSON parses, all 11 fields present with the right shape, exactly
 * 3 badges spanning 3 categories with >=1 "tendency", and player_name is in
 * the approved pool. Does NOT run banned-phrase checks (v7 removed those).
 */
export function parseComp(raw: string): ParseResult {
  const jsonStr = extractJson(raw);
  if (jsonStr === null)
    return { ok: false, reason: "json", detail: "no JSON object found" };

  let obj: unknown;
  try {
    obj = JSON.parse(jsonStr);
  } catch (e) {
    return {
      ok: false,
      reason: "json",
      detail: e instanceof Error ? e.message : "JSON.parse failed",
    };
  }

  if (typeof obj !== "object" || obj === null)
    return { ok: false, reason: "shape", detail: "not an object" };
  const o = obj as Record<string, unknown>;

  const stringFields = [
    "player_name",
    "position_era",
    "archetype_title",
    "card_summary",
    "screenshot_line",
    "full_report",
    "why_this_player",
    "front_office_fit",
    "comp_tone",
  ] as const;
  for (const f of stringFields) {
    if (!isNonEmptyString(o[f]))
      return { ok: false, reason: "shape", detail: `missing/empty ${f}` };
  }

  // stat_line
  const sl = o["stat_line"];
  if (typeof sl !== "object" || sl === null)
    return { ok: false, reason: "shape", detail: "missing stat_line" };
  const slo = sl as Record<string, unknown>;
  for (const f of ["seasons", "teams", "pivots", "contract_status"] as const) {
    // Coerce numbers to strings — known engine drift returns numbers/prose here.
    if (typeof slo[f] === "number") slo[f] = String(slo[f]);
    if (!isNonEmptyString(slo[f]))
      return { ok: false, reason: "shape", detail: `missing stat_line.${f}` };
  }

  // badges: exactly 3, 3 categories, >=1 tendency
  const badges = o["badges"];
  if (!Array.isArray(badges) || badges.length !== 3)
    return { ok: false, reason: "shape", detail: "badges must be exactly 3" };
  const cats = new Set<string>();
  for (const b of badges) {
    if (typeof b !== "object" || b === null)
      return { ok: false, reason: "shape", detail: "badge not an object" };
    const bo = b as Record<string, unknown>;
    if (!isNonEmptyString(bo["label"]) || !isNonEmptyString(bo["earned_by"]))
      return { ok: false, reason: "shape", detail: "badge missing label/earned_by" };
    const cat = bo["category"];
    if (
      cat !== "skill" &&
      cat !== "temperament" &&
      cat !== "intangible" &&
      cat !== "tendency"
    )
      return { ok: false, reason: "shape", detail: `bad badge category: ${String(cat)}` };
    cats.add(cat);
  }
  if (cats.size !== 3)
    return { ok: false, reason: "shape", detail: "badges must span 3 categories" };
  if (!cats.has("tendency"))
    return { ok: false, reason: "shape", detail: "badges need >=1 tendency" };

  const playerName = (o["player_name"] as string).trim();
  if (!isPlayerInPool(playerName))
    return { ok: false, reason: "out_of_pool", detail: `not in pool: ${playerName}` };

  // Normalize player_name to the pool's canonical casing.
  const canonical = PLAYER_POOL.find(
    (p) => p.name.trim().toLowerCase() === playerName.toLowerCase(),
  )!.name;

  const comp: Comp = {
    player_name: canonical,
    position_era: (o["position_era"] as string).trim(),
    archetype_title: (o["archetype_title"] as string).trim(),
    badges: (badges as Comp["badges"]).map((b) => ({
      label: b.label.trim(),
      category: b.category,
      earned_by: b.earned_by.trim(),
    })),
    card_summary: (o["card_summary"] as string).trim(),
    screenshot_line: (o["screenshot_line"] as string).trim(),
    full_report: (o["full_report"] as string).trim(),
    why_this_player: (o["why_this_player"] as string).trim(),
    stat_line: {
      seasons: String(slo["seasons"]).trim(),
      teams: String(slo["teams"]).trim(),
      pivots: String(slo["pivots"]).trim(),
      contract_status: String(slo["contract_status"]).trim(),
    },
    front_office_fit: (o["front_office_fit"] as string).trim(),
    comp_tone: (o["comp_tone"] as string).trim(),
  };
  return { ok: true, comp };
}

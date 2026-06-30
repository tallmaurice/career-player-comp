// =============================================================================
// Career Player Comp — deterministic retrieval (rebuild-variation)
//
// THE PROBLEM this solves: when all 204 players are injected every call, the
// model picks from its own famous-archetype memory and ~12-20 names ever
// surface. Fix: classify the incoming career into the SAME controlled tag
// vocabulary the pool is tagged with, score every player by multi-axis overlap,
// then select a ~40-player shortlist that is RELEVANT but INTERNALLY VARIED
// (never 40 clones of one archetype). Only that shortlist is shown to the model.
//
// This is pure, deterministic, side-effect-free code. NO API call. It is the
// cheap pre-filter that both forces variety (different careers -> different
// shortlists -> far more of the 204 surface) and shrinks the per-call pool.
//
// Tag vocabulary: docs/tag-vocabulary.md (the source of truth for the values).
// =============================================================================

import type { PoolPlayer } from "./index";

// ---- Tag types --------------------------------------------------------------

/** The multi-dimensional fingerprint carried by every pool player (added on the
 *  rebuild-variation branch). Closed axes use the controlled vocabulary; `hook`
 *  is a freeform comp-logic sentence. */
export interface PlayerTags {
  archetype: string[];
  build: string[];
  trajectory: string[];
  prominence: string;
  era: string;
  descriptors: string[];
  hook: string;
}

/** A pool player guaranteed to carry tags (post-merge). */
export type TaggedPlayer = PoolPlayer & { tags: PlayerTags };

/** A classified incoming career — the query side of retrieval, in the same
 *  vocabulary as the pool. Multi-value where the signal supports it. */
export interface CareerQuery {
  archetype: string[];
  build: string[];
  trajectory: string[];
  /** Ordinal prominence level inferred from seniority/scope, 0 (deep-cut) .. 4
   *  (apex). Used as a DISTANCE term, not a match — keeps a modest career from
   *  pulling 40 superstars. */
  prominenceLevel: number;
  descriptors: string[];
}

// ---- Prominence ordinal -----------------------------------------------------

const PROMINENCE_ORD: Record<string, number> = {
  "deep-cut": 0,
  role: 1,
  starter: 2,
  star: 3,
  apex: 4,
};

function prominenceOrd(p: string): number {
  return PROMINENCE_ORD[p] ?? 1;
}

// ---- Quiz option -> tag maps ------------------------------------------------
// The quiz options are authored on the same axes the pool is tagged on, so the
// classification is a direct, deterministic lookup. Keys are the exact option
// strings from lib/types.ts QUESTIONS. We match case-insensitively and tolerate
// minor punctuation drift by normalizing first.

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,'’]/g, "");
}

/** Q1 ALTITUDE -> build */
const Q1_BUILD: Record<string, string[]> = {
  "i built it from nothing": ["founder"],
  "i took something broken and fixed it": ["turnaround"],
  "i ran something already working and kept it humming": ["operator"],
  "i made a good team better from inside it": ["glue"],
  "i got really good at one specific thing": ["craftsman"],
};

/** Q3 TEMPERAMENT -> archetype */
const Q3_ARCHETYPE: Record<string, string[]> = {
  "takes the last shot": ["closer"],
  "sets up whoever takes it": ["facilitator"],
  "keeps everyone calm": ["anchor"],
  "does the ugly work nobody will touch": ["anchor", "specialist"],
  "already saw it coming and planned for it": ["facilitator"],
};

/** Q4 ARC -> trajectory */
const Q4_TRAJECTORY: Record<string, string[]> = {
  "one lane gone deep": ["lifer"],
  "a steady climb up one ladder": ["steady-prime"],
  "a couple of full reinventions": ["reinventor"],
  "a lot of stops but i always land on my feet": ["journeyman"],
  "a slow burn that took a while to click": ["late-bloomer", "slow-climb"],
};

/** Q2 SCOPE -> prominence delta + supporting archetype/descriptor. */
const Q2_SCOPE: Record<string, { prom: number; archetype?: string[]; build?: string[]; descriptors?: string[] }> = {
  "mostly solo": { prom: 0, build: ["craftsman", "founder"] },
  "with a small crew i led": { prom: 1 },
  "as one piece of a big team": { prom: -1, archetype: ["anchor"], build: ["glue"] },
  "by running a large operation": { prom: 1, build: ["operator"] },
  "quietly while other people got the credit": { prom: -1, archetype: ["anchor"], build: ["glue"], descriptors: ["quiet-leader"] },
};

/** Q7 ENDGAME -> prominence delta + supporting tags. */
const Q7_ENDGAME: Record<string, { prom: number; build?: string[]; trajectory?: string[]; descriptors?: string[] }> = {
  "running the whole thing": { prom: 1, build: ["operator", "founder"] },
  "best in the building at one craft": { prom: 0, build: ["craftsman"], descriptors: ["elite-specialist"] },
  "out on my own built something mine": { prom: 0, build: ["founder"] },
  "still here still steady thats the win": { prom: -1, trajectory: ["lifer"], descriptors: ["one-team-loyal", "longevity"] },
  "honestly not sure and fine with that": { prom: 0 },
};

/** Q6 SELF-IMAGE GAP -> descriptors (the sharper, roast-fuel signal). */
const Q6_DESC: Record<string, string[]> = {
  "they think i run more than i do": [],
  "they think im chill im keeping score": ["quiet-leader"],
  "they underestimate me until they need me": ["underdog", "overlooked"],
  "they think i love this im just good at it": [],
  "they think i have a plan im improvising": [],
};

/** Q8 MOTIVATION -> descriptors. */
const Q8_DESC: Record<string, string[]> = {
  winning: ["clutch"],
  "the craft itself": ["elite-specialist"],
  "the people id let down if i left": ["one-team-loyal", "locker-room-glue"],
  "the paycheck no shame": [],
  "proving the doubters wrong": ["underdog"],
};

// ---- Résumé keyword scan ----------------------------------------------------
// Adds career-DRIVEN signal on top of the quiz so the shortlist is anchored in
// the actual history, not just the 8 MC buckets. Deterministic substring scan.

const SENIORITY_HIGH = /\b(ceo|c\.e\.o|founder|co-?founder|owner|president|chief|cto|cfo|coo|partner|managing director|executive director|head of|vp|vice president|svp|evp|principal)\b/i;
const SENIORITY_MID = /\b(director|senior manager|department head|lead|team lead|manager|supervisor|head coach)\b/i;
const SENIORITY_LOW = /\b(intern|trainee|assistant|coordinator|associate|junior|entry[- ]level|apprentice|clerk)\b/i;
const ELITE_SCHOOL = /\b(harvard|yale|princeton|stanford|mit|wharton|columbia|dartmouth|brown university|cornell|upenn|university of pennsylvania|oxford|cambridge)\b/i;
const COMEBACK = /\b(returned|comeback|came back|after (a|an)? ?(injury|illness|leave|hiatus|gap)|relaunch|second act|reentered|re-?entered)\b/i;
const LONGEVITY = /\b(2[0-9]\+? years|over (two|twenty) decades|three decades|3 decades|20\+ years|25 years|30 years)\b/i;

/** Count distinct employers as a rough journeyman/lifer signal. Looks for the
 *  number of "Company —" / bullet-style role separators; falls back to line
 *  heuristics. Cheap and approximate by design. */
function estimateEmployers(text: string): number {
  // Count lines that look like a role/company header (Title at Company, or
  // "Company | 2019-2022"). Very rough.
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let count = 0;
  for (const l of lines) {
    if (/\b(at|@|\||·|—|-)\b/.test(l) && /\d{4}|present/i.test(l)) count++;
    else if (/^(senior |lead |head |chief |vp |director |manager )/i.test(l)) count++;
  }
  return count;
}

// ---- Classifier -------------------------------------------------------------

function pushAll(target: string[], values?: string[]) {
  if (!values) return;
  for (const v of values) if (!target.includes(v)) target.push(v);
}

/**
 * Classify an incoming career into the controlled tag vocabulary. Deterministic:
 * the quiz answers map directly onto the axes, and the résumé text adds
 * career-driven prominence + descriptor signal. No API call.
 */
export function classifyCareer(
  careerText: string,
  answers: { q1: string; q2: string; q3: string; q4: string; q5: string; q6: string; q7: string; q8: string; q9?: string; q10?: string },
): CareerQuery {
  const archetype: string[] = [];
  const build: string[] = [];
  const trajectory: string[] = [];
  const descriptors: string[] = [];

  // Primary axes straight from the quiz.
  pushAll(archetype, Q3_ARCHETYPE[norm(answers.q3)]);
  pushAll(build, Q1_BUILD[norm(answers.q1)]);
  pushAll(trajectory, Q4_TRAJECTORY[norm(answers.q4)]);

  // Prominence: start neutral (starter=2), nudge by scope + endgame + résumé.
  let prom = 2;
  const q2 = Q2_SCOPE[norm(answers.q2)];
  if (q2) {
    prom += q2.prom;
    pushAll(archetype, q2.archetype);
    pushAll(build, q2.build);
    pushAll(descriptors, q2.descriptors);
  }
  const q7 = Q7_ENDGAME[norm(answers.q7)];
  if (q7) {
    prom += q7.prom;
    pushAll(build, q7.build);
    pushAll(trajectory, q7.trajectory);
    pushAll(descriptors, q7.descriptors);
  }

  // Descriptor signal from the sharper quiz items + free text.
  pushAll(descriptors, Q6_DESC[norm(answers.q6)]);
  pushAll(descriptors, Q8_DESC[norm(answers.q8)]);

  // Résumé scan: prominence from seniority, plus a few defining descriptors.
  const text = `${careerText}\n${answers.q9 ?? ""}\n${answers.q10 ?? ""}`;
  if (SENIORITY_HIGH.test(text)) prom += 1;
  else if (SENIORITY_LOW.test(text) && !SENIORITY_MID.test(text)) prom -= 1;
  if (ELITE_SCHOOL.test(text)) pushAll(descriptors, ["high-pedigree"]);
  if (COMEBACK.test(text)) {
    pushAll(descriptors, ["injury-comeback"]);
    pushAll(trajectory, ["injury-arc"]);
  }
  if (LONGEVITY.test(text)) pushAll(descriptors, ["longevity"]);

  const employers = estimateEmployers(careerText);
  if (employers >= 5) {
    pushAll(trajectory, ["journeyman"]);
    pushAll(descriptors, ["journeyman-survivor"]);
  } else if (employers === 1 && careerText.trim().length > 80) {
    pushAll(trajectory, ["lifer"]);
    pushAll(descriptors, ["one-team-loyal"]);
  }

  // Clamp prominence to [0,4].
  const prominenceLevel = Math.max(0, Math.min(4, prom));

  return { archetype, build, trajectory, prominenceLevel, descriptors };
}

// ---- Scoring ----------------------------------------------------------------

// Axis weights. archetype + trajectory are the strongest career-match signals
// (the quiz produces them directly); build next; descriptors add precision.
const W_ARCHETYPE = 3.0;
const W_TRAJECTORY = 2.5;
const W_BUILD = 2.0;
const W_DESCRIPTOR = 1.4;
// Prominence is a distance PENALTY per ordinal step of mismatch. This is what
// stops a modest career from pulling the whole superstar tier.
const W_PROMINENCE = 1.1;

function overlapCount(a: string[], b: string[]): number {
  let n = 0;
  for (const x of a) if (b.includes(x)) n++;
  return n;
}

/** Raw relevance of one player to the query (higher = more relevant). */
export function scorePlayer(query: CareerQuery, p: TaggedPlayer): number {
  const t = p.tags;
  let s = 0;
  s += W_ARCHETYPE * overlapCount(query.archetype, t.archetype);
  s += W_TRAJECTORY * overlapCount(query.trajectory, t.trajectory);
  s += W_BUILD * overlapCount(query.build, t.build);
  s += W_DESCRIPTOR * overlapCount(query.descriptors, t.descriptors);
  s -= W_PROMINENCE * Math.abs(query.prominenceLevel - prominenceOrd(t.prominence));
  return s;
}

// ---- Variety-spread selection (MMR) -----------------------------------------

/** Similarity between two players for the diversity term — shared PRIMARY tags
 *  across the differentiating axes. Two players who share archetype+trajectory+
 *  prominence are near-clones for shortlist purposes. */
function playerSimilarity(a: TaggedPlayer, b: TaggedPlayer): number {
  let s = 0;
  if (overlapCount(a.tags.archetype, b.tags.archetype) > 0) s += 0.4;
  if (overlapCount(a.tags.trajectory, b.tags.trajectory) > 0) s += 0.3;
  if (a.tags.prominence === b.tags.prominence) s += 0.2;
  if (a.tags.era === b.tags.era) s += 0.1;
  return s; // 0..1
}

export interface SelectOptions {
  /** How many candidates to return. */
  size?: number;
  /** MMR tradeoff: 1.0 = pure relevance, 0.0 = pure diversity. */
  lambda?: number;
  /** Max candidates sharing a single primary archetype (hard anti-clustering). */
  archetypeCap?: number;
}

/**
 * Select a shortlist that is RELEVANT but INTERNALLY VARIED. Maximal Marginal
 * Relevance: greedily take the player that maximizes lambda*relevance minus
 * (1-lambda)*max-similarity-to-already-chosen, with a hard cap on how many can
 * share one primary archetype so the shortlist can never collapse to 40 clones.
 *
 * Deterministic: ties broken by the player's pool index (stable input order),
 * so the same query always yields the same shortlist (matches the app's
 * same-input-same-comp contract).
 */
export function selectCandidates(
  query: CareerQuery,
  pool: TaggedPlayer[],
  opts: SelectOptions = {},
): TaggedPlayer[] {
  const size = opts.size ?? 40;
  const lambda = opts.lambda ?? 0.7;
  const archetypeCap = opts.archetypeCap ?? Math.ceil(size / 4); // <=25% one archetype

  if (pool.length <= size) return [...pool];

  // Pre-score everything; normalize relevance to 0..1 for a clean MMR blend.
  interface Scored {
    p: TaggedPlayer;
    idx: number;
    rel: number;
    relN: number;
  }
  const raw = pool.map((p, idx) => ({ p, idx, rel: scorePlayer(query, p) }));
  const maxRel = Math.max(...raw.map((s) => s.rel));
  const minRel = Math.min(...raw.map((s) => s.rel));
  const span = maxRel - minRel || 1;
  const scored: Scored[] = raw.map((s) => ({ ...s, relN: (s.rel - minRel) / span }));

  const selected: Scored[] = [];
  const remaining: Scored[] = [...scored];
  const archetypeCounts: Record<string, number> = {};

  while (selected.length < size && remaining.length > 0) {
    let bestI = -1;
    let bestVal = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      // Hard anti-clustering: skip if this primary archetype is already full,
      // UNLESS we'd otherwise run out (handled by a relax pass below).
      const primary = cand.p.tags.archetype[0] ?? "_";
      if ((archetypeCounts[primary] ?? 0) >= archetypeCap) continue;

      const relN = cand.relN;
      let maxSim = 0;
      for (const s of selected) {
        const sim = playerSimilarity(cand.p, s.p);
        if (sim > maxSim) maxSim = sim;
      }
      const mmr = lambda * relN - (1 - lambda) * maxSim;
      // Tie-break deterministically on pool index (lower wins).
      if (mmr > bestVal + 1e-9 || (Math.abs(mmr - bestVal) <= 1e-9 && bestI >= 0 && cand.idx < remaining[bestI].idx)) {
        bestVal = mmr;
        bestI = i;
      }
    }

    if (bestI === -1) {
      // Every remaining candidate is archetype-capped. Relax the cap to fill the
      // shortlist (variety floor met; now just take the most relevant).
      remaining.sort((a, b) => b.rel - a.rel || a.idx - b.idx);
      const next = remaining.shift()!;
      selected.push(next);
      const primary = next.p.tags.archetype[0] ?? "_";
      archetypeCounts[primary] = (archetypeCounts[primary] ?? 0) + 1;
      continue;
    }

    const [chosen] = remaining.splice(bestI, 1);
    selected.push(chosen);
    const primary = chosen.p.tags.archetype[0] ?? "_";
    archetypeCounts[primary] = (archetypeCounts[primary] ?? 0) + 1;
  }

  return selected.map((s) => s.p);
}

// ---- Public entry -----------------------------------------------------------

/**
 * Classify a career and return its variety-spread candidate shortlist. The one
 * call the route makes. Pure + deterministic; no API.
 */
export function retrieveCandidates(
  careerText: string,
  answers: { q1: string; q2: string; q3: string; q4: string; q5: string; q6: string; q7: string; q8: string; q9?: string; q10?: string },
  pool: TaggedPlayer[],
  opts?: SelectOptions,
): { query: CareerQuery; candidates: TaggedPlayer[] } {
  const query = classifyCareer(careerText, answers);
  const candidates = selectCandidates(query, pool, opts);
  return { query, candidates };
}

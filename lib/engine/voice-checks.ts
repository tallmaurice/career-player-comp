// =============================================================================
// Voice checks (voice-rules branch). Two VOICE AND JOKES rules that models
// still break are checked in code after parseComp, with one cheap repair:
//   pronoun:    he/she/him/her/his/hers/himself/herself in a field that
//               describes only the person, when the résumé states no pronouns.
//   isnt-shape: a not/isn't/wasn't clause followed by that's/it's/it is/you're
//               in the next clause or sentence ("That's not X, that's Y").
// runVoiceRepair() finds them, sends only the offending passages to a model the
// caller supplies (one call, never a loop), splices the rewrites back in and
// checks again. Whatever the repair leaves behind is reported, not retried.
// Nothing here calls the network; the route or a test harness owns the client.
// =============================================================================

import type { Comp } from "@/lib/types";

export type VoiceProblem = "pronoun" | "isnt-shape";

/** One passage to rewrite: a sentence (or two, for the two-sentence shape)
 *  inside the field at `path` ("card_summary", "badges.1.earned_by", ...). */
export type RepairItem = { id: string; path: string; problems: VoiceProblem[]; text: string };

export type VoiceRepairResult = {
  comp: Comp;
  found: RepairItem[];
  applied: string[]; // ids whose rewrite was spliced in
  rewrites: Record<string, string>; // id -> the passage as rewritten
  remaining: RepairItem[]; // what the checks still find after the repair
  called: boolean; // false when there was nothing to fix
};

// Fields that describe only the person, never the player.
function personPaths(c: Comp): string[] {
  return [
    "screenshot_line", "card_summary", "ovr_rationale", "archetype_title", "front_office_fit",
    ...c.badges.flatMap((_, i) => [`badges.${i}.label`, `badges.${i}.earned_by`]),
    ...c.strengths.map((_, i) => `strengths.${i}`),
    ...c.weaknesses.map((_, i) => `weaknesses.${i}`),
    ...c.season_stats.map((_, i) => `season_stats.${i}.line`),
    "contract.descriptor", "draft.note",
  ];
}

// Every prose field, for the isn't/is shape.
function prosePaths(c: Comp): string[] {
  return [...personPaths(c), "full_report", "why_this_player", "secondary_comp", "comp_tone"];
}

function getAt(obj: unknown, path: string): unknown {
  return path.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), obj);
}

function setAt(obj: unknown, path: string, value: string): void {
  const keys = path.split(".");
  const last = keys.pop()!;
  const parent = keys.reduce<any>((o, k) => o[k], obj);
  parent[last] = value;
}

/** Pronouns written on the page, e.g. "(He/Him)" on a LinkedIn PDF or "Pronouns: she/her". */
const STATED = /\b(?:he|she|they)\s*\/\s*(?:him|her|them|his|hers|they|theirs)\b|\bpronouns?\s*[:(]/i;
export const statesPronouns = (careerText: string): boolean => STATED.test(careerText);

const PRONOUN = /\b(?:he|she|him|her|his|hers|himself|herself)\b/i;
// The affirming clause, including the was/were and he/she/they forms of the same move.
const AFFIRM = String.raw`(?:that['’]s|that is|that was|it['’]s|it is|it was|this is|you['’]re|you are|you were|he['’]s|he is|she['’]s|she is|they['’]re|they are)\b`;
// Only a negated "to be" (is not, isn't, that's not, you were not...): the shape denies
// what something IS. A plain "could not" or "do not" followed by "That is..." is not it.
const NEG = String.raw`(?:\b(?:is|was|are|were|am)\s+not\b|\b(?:isn|wasn|aren|weren)['’]t\b|['’](?:s|re)\s+not\b)`;
// "isn't X, it's Y" in one sentence (comma, semicolon, colon or dash between the clauses).
const SAME_SENTENCE = new RegExp(`${NEG}[^.!?]*?[,;:—–]\\s*(?:but\\s+)?${AFFIRM}`, "i");
const HAS_NEG = new RegExp(NEG, "i");
// "It isn't X. It's Y." across two sentences.
const OPENS_AFFIRM = new RegExp(`^["“‘(]?${AFFIRM}`, "i");

/** Sentence spans (exact offsets, so a passage is always a substring of the field). */
function sentenceSpans(text: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  const boundary = /[.!?]["”’)]?(?=\s+["“‘(]?[A-Z0-9])/g;
  let start = 0;
  for (let m = boundary.exec(text); m; m = boundary.exec(text)) {
    const end = m.index + m[0].length;
    spans.push({ start, end });
    start = end;
    while (start < text.length && /\s/.test(text[start])) start++;
  }
  if (start < text.length) spans.push({ start, end: text.length });
  return spans;
}

/** Every passage that breaks either rule, merged per field so no two overlap. */
export function findVoiceIssues(comp: Comp, careerText: string): RepairItem[] {
  const checkPronouns = !statesPronouns(careerText);
  const person = new Set(personPaths(comp));
  const items: RepairItem[] = [];
  for (const path of prosePaths(comp)) {
    const text = getAt(comp, path);
    if (typeof text !== "string" || !text.trim()) continue;
    const spans = sentenceSpans(text);
    const hits: Array<{ start: number; end: number; problem: VoiceProblem }> = [];
    spans.forEach((s, i) => {
      const sentence = text.slice(s.start, s.end);
      if (checkPronouns && person.has(path) && PRONOUN.test(sentence)) hits.push({ ...s, problem: "pronoun" });
      if (SAME_SENTENCE.test(sentence)) hits.push({ ...s, problem: "isnt-shape" });
      else if (HAS_NEG.test(sentence) && spans[i + 1] && OPENS_AFFIRM.test(text.slice(spans[i + 1].start, spans[i + 1].end))) {
        hits.push({ start: s.start, end: spans[i + 1].end, problem: "isnt-shape" });
      }
    });
    hits.sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number; problems: Set<VoiceProblem> }> = [];
    for (const h of hits) {
      const last = merged[merged.length - 1];
      if (last && h.start < last.end) {
        last.end = Math.max(last.end, h.end);
        last.problems.add(h.problem);
      } else merged.push({ start: h.start, end: h.end, problems: new Set([h.problem]) });
    }
    for (const m of merged) {
      items.push({ id: String(items.length + 1), path, problems: [...m.problems], text: text.slice(m.start, m.end) });
    }
  }
  return items;
}

export const REPAIR_SYSTEM = `You are the copy desk for Career Player Comp, a comedy product that compares a person's career to one NBA or WNBA player in a scouting report. You get a few passages from one report, each with the problem to fix. Rewrite each passage so the problem is gone. Keep its facts, its joke and roughly its length, and change as few words as you can.

Problems:
- pronoun: the passage calls the person he, she, him, her, his, hers, himself or herself, and the résumé gives no pronouns. Write to the person as "you", or drop the pronoun. A pronoun for the basketball player can stay.
- isnt-shape: the passage says what something isn't, then what it is ("That's not X, that's Y"; "It isn't X. It's Y."). Say the true thing directly, as one statement.

Return JSON only, nothing before or after: {"<id>": "<rewritten passage>", ...} with one entry for every id.`;

export function repairMessage(items: RepairItem[]): string {
  return JSON.stringify(items.map(({ id, path, problems, text }) => ({ id, field: path, problems, text })));
}

/** Splice the model's rewrites into a copy of the comp. Unusable entries are skipped. */
export function applyRepair(
  comp: Comp,
  items: RepairItem[],
  reply: string,
): { comp: Comp; applied: string[]; rewrites: Record<string, string> } {
  const out = structuredClone(comp);
  let fixes: Record<string, unknown> = {};
  try {
    fixes = JSON.parse(reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1));
  } catch {
    return { comp: out, applied: [], rewrites: {} };
  }
  const applied: string[] = [];
  const rewrites: Record<string, string> = {};
  for (const it of items) {
    const next = fixes[it.id];
    const current = getAt(out, it.path);
    if (typeof next !== "string" || !next.trim() || typeof current !== "string" || !current.includes(it.text)) continue;
    setAt(out, it.path, current.replace(it.text, () => next.trim()));
    applied.push(it.id);
    rewrites[it.id] = next.trim();
  }
  return { comp: out, applied, rewrites };
}

/** Check, repair once with the caller's model, check again. The repaired comp
 *  is kept even when something still fails; `remaining` says what. */
export async function runVoiceRepair(
  comp: Comp,
  careerText: string,
  callModel: (system: string, user: string) => Promise<string>,
): Promise<VoiceRepairResult> {
  const found = findVoiceIssues(comp, careerText);
  if (!found.length) return { comp, found, applied: [], rewrites: {}, remaining: [], called: false };
  const reply = await callModel(REPAIR_SYSTEM, repairMessage(found));
  const { comp: repaired, applied, rewrites } = applyRepair(comp, found, reply);
  return { comp: repaired, found, applied, rewrites, remaining: findVoiceIssues(repaired, careerText), called: true };
}

/** The internal "angles" plan the model writes first. parseComp drops it (it is
 *  never shown to anyone); this reads it back for testing. */
export function readAngles(raw: string): unknown {
  try {
    return (JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { angles?: unknown }).angles ?? null;
  } catch {
    return null;
  }
}

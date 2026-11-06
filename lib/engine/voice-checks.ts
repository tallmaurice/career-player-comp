// =============================================================================
// Voice checks (voice-rules branch). VOICE AND JOKES rules that models still
// break are checked in code after parseComp, with one cheap repair:
//   pronoun:    he/she/him/her/his/hers/himself/herself in a field that
//               describes only the person, when the résumé states no pronouns.
//   isnt-shape: a not/isn't/wasn't clause followed by that's/it's/it is/you're
//               in the next clause or sentence ("That's not X, that's Y").
//   count:      a number before employers/jobs/outlets/stops/places/teams/titles
//               ("six outlets", "eleven stops") in any prose field. stat_line is
//               not prose, so its counts stand.
//   crutch:     the ", which is the most..." / ", which is exactly what..." tag,
//               more than once per report (the first one stays).
//   copy:       six or more words in a row shared with the worked examples.
//   theme:      the same joke or image in more than two fields (a theme word
//               family, or a three-word phrase once names and stopwords are set
//               aside). The screenshot_line and the best one other keep it.
// runVoiceRepair() finds them, sends only the offending passages to a model the
// caller supplies (one call, never a loop), splices the rewrites back in and
// checks again. Whatever the repair leaves behind is reported, not retried.
// Nothing here calls the network; the route or a test harness owns the client.
// =============================================================================

import type { Comp } from "@/lib/types";
import { FEW_SHOT_EXAMPLES } from "./system-prompt";

export type VoiceProblem = "pronoun" | "isnt-shape" | "count" | "crutch" | "copy" | "theme";

/** One passage to rewrite: a sentence (or two, for the two-sentence shape)
 *  inside the field at `path` ("card_summary", "badges.1.earned_by", ...).
 *  `notes` says what to avoid (the repeated theme, the copied words). */
export type RepairItem = { id: string; path: string; problems: VoiceProblem[]; text: string; notes?: string[] };

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

// Every prose field (stat_line is a stat block, not prose).
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

// ---- Sentences and fields -----------------------------------------------------

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

/** A sentence and the field it counts toward for the theme cap: each full_report
 *  paragraph is its own field, and the badges and weaknesses are one field each. */
type Sentence = { path: string; unit: string; start: number; end: number; text: string };

function unitOf(path: string, text: string, start: number): string {
  if (path === "full_report") {
    const sep = /\n\s*\n/.test(text) ? /\n\s*\n/g : /\n/g;
    const before = text.slice(0, start).match(sep)?.length ?? 0;
    return `full_report ¶${before + 1}`;
  }
  const head = path.split(".")[0];
  return ["badges", "weaknesses", "strengths", "season_stats"].includes(head) ? head : path;
}

function sentencesOf(comp: Comp): Sentence[] {
  const out: Sentence[] = [];
  for (const path of prosePaths(comp)) {
    const text = getAt(comp, path);
    if (typeof text !== "string" || !text.trim()) continue;
    for (const s of sentenceSpans(text)) {
      out.push({ path, unit: unitOf(path, text, s.start), ...s, text: text.slice(s.start, s.end) });
    }
  }
  return out;
}

// The fields the theme cap counts, best first: when a theme is over the cap,
// the screenshot_line keeps it, plus the first other field in this order.
const THEME_UNITS = ["screenshot_line", "full_report", "card_summary", "badges", "weaknesses", "front_office_fit", "contract.descriptor", "ovr_rationale"];
const isThemeUnit = (u: string) => THEME_UNITS.includes(u.startsWith("full_report") ? "full_report" : u);
function rank(unit: string): number {
  if (unit.startsWith("full_report ¶")) return 1 + Number(unit.slice(13)) / 100;
  const i = THEME_UNITS.indexOf(unit);
  return i === -1 ? 100 : i;
}

// ---- Words ------------------------------------------------------------------

const STOPWORDS = new Set(
  ("a an the and or but nor so yet for of in on at to from by with without into onto over under about as than then that this these those " +
    "there here it its is are was were be been being am do does did done have has had having you your yours yourself i me my we us our " +
    "they them their he him his she her who whom whose which what when where why how all any both each every few more most other some such " +
    "no not only own same very can could will would shall should may might must just also even still ever never again once up down out off " +
    "if because while until after before since during through between against s t too much many like get got gets make made makes way thing " +
    "things whole enough long anyone anything everyone someone something nothing nobody else around back almost already really quite well " +
    "one now later ago re ve ll d m let lets").split(" "),
);

const words = (s: string): string[] =>
  (s.toLowerCase().replace(/[’‘]/g, "'").match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? []).map((w) => w.replace(/'(?:s|re|ve|ll|d|m|t)$/, ""));

/** Proper nouns: words capitalized mid-sentence in sentence-case fields (labels
 *  and the archetype title are Title Case, so they don't count), plus all-caps. */
function namesIn(sents: Sentence[], comp: Comp): Set<string> {
  const names = new Set(words(`${comp.player_name}`));
  for (const s of sents) {
    if (s.path === "archetype_title" || /^badges\.\d+\.label$/.test(s.path)) continue;
    const toks = s.text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
    toks.forEach((t, i) => {
      if ((i > 0 && /^[A-Z]/.test(t)) || /^[A-Z]{2,}$/.test(t)) words(t).forEach((w) => names.add(w));
    });
  }
  return names;
}

// ---- The checks ---------------------------------------------------------------

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

// A number, then up to two words, then a kind of stop, then the end of the phrase
// ("six outlets", "eleven stops in", "seven different jobs,"). The noun has to end
// the phrase, so "thirty team guides" or "three title changes" don't count.
const NUMBER = String.raw`\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|dozen`;
const STOP_NOUN = String.raw`employers?|jobs?|outlets?|stops?|compan(?:y|ies)|places?|teams?|franchises?|titles?|roles?|positions?|gigs?|brands?|newsrooms?|networks?|publications?|organi[sz]ations?|startups?|shops?|firms?|agenc(?:y|ies)|schools?|districts?|hospitals?|uniforms?|jerseys?|logos?|cit(?:y|ies)`;
// The words between can't be stopwords, spans of time, team sizes or trophies ("five years of uniforms",
// "a three-person team", "six regional titles" and "eight video franchises" are the person's own numbers).
const BETWEEN = String.raw`(?:[\s-]+(?!(?:${[...STOPWORDS].join("|")}|years?|months?|seasons?|weeks?|days?|person|people|member|staff|video|podcast|content|regional|state|national|league|conference|division|championship)\b)[a-z][\w'’]*){0,2}?`;
const COUNT = new RegExp(
  String.raw`(?<![\w'’-])(${NUMBER})${BETWEEN}[\s-]+(?:${STOP_NOUN})\b(?=\s*$|\s*[^\w\s'’-]|\s+(?:${[...STOPWORDS].join("|")}|later|ago|deep|running|straight|apart|removed|total|combined)\b)`,
  "gi",
);
// "the one role nobody can promote you out of" is not a count.
const NOT_A_COUNT_ONE = /\b(?:the|this|that|any|every|each|no|which|only)\s+$/i;

function counts(sentence: string): string[] {
  const out: string[] = [];
  for (const m of sentence.matchAll(COUNT)) {
    if (m[1].toLowerCase() === "one" && NOT_A_COUNT_ONE.test(sentence.slice(0, m.index))) continue;
    out.push(m[0]);
  }
  return out;
}

// The tag closer: ", which is the most...", ", which is exactly what...", ", which is what...".
const CRUTCH = /,\s+which\s+(?:is|was|might be|may be|could be|would be|is probably|is basically|is somehow|is also|is just)\s+(?:exactly|precisely|what|the\s+(?:most|least|only|single|best|worst|first|(?!(?:rest|interest|honest|request|forest|contest|protest|harvest|modest|guest|test|west|chest|quest|nest)\b)[a-z]+est))\b/gi;

// Theme word families common to career comedy. A family in more than two fields is one joke told too often.
const THEMES: Array<[string, RegExp]> = [
  ["leaving", /(?<!never )\bleav(?:e|es|ing)\b|\bleft (?:before|after|for|when|once|the|a|an|it|them|every|each)\b|\bwalk(?:s|ed|ing)? (?:out|away)\b|\bmov(?:e|es|ed|ing) on\b|\bexit(?:s|ed|ing)?\b|\bdepart(?:s|ed|ing|ures?)?\b|\bquit(?:s|ting)?\b|\bresign\w*|\bnext (?:stop|job|gig|logo|building|chapter|move)\b|\bgone (?:before|by)\b|\bout the door\b|\blinkedin\b|\bweeks['’]? notice\b|\bpack(?:s|ed|ing)? up\b|\bnew logo\b|\bstep(?:s|ped|ping)? aside\b|\bway out\b|\bshown the door\b|\bmoving van\b/i],
  ["staying", /\bstay(?:s|ed|ing)?\b(?!\s+(?:level|calm|cool|quiet|sharp|focused|great|good|ahead|humble|hungry|composed|steady|curious|relevant|awake))|\bnever (?:left|leaves|leaving|moved|moves|transferred|been traded)\b|\bsame (?:building|company|employer|district|school|classroom|hospital|unit|desk|seat|office|place|franchise|team|shop|firm|organi[sz]ation)\b|\blifers?\b|\bfree agen(?:cy|t)\b|\btrade (?:rumou?rs?|requests?)\b|\bloyal(?:ty)?\b|\bwithout (?:ever )?(?:leaving|moving|a trade)\b|\btenure\b/i],
  ["build-then-hand-off", /\bhand(?:s|ed|ing)? (?:it |them |the \w+ )?(?:off|over)\b|\bhand(?:s|ed|ing)? (?:it|them) to\b|\bhand-?offs?\b|\bpass(?:es|ed|ing)? (?:it|them) (?:on|off|along)\b|\bsome(?:body|one) else\b|\bthe next (?:person|editor|hire|guy|regime|owner|coach)\b|\bfrom (?:zero|scratch|nothing)\b|\bground up\b|\bsunset(?:s|ted|ting)?\b|\bexpansion (?:team|franchise)\b/i],
  ["titles and promotions", /\bpromot\w*|(?<!(?:regional|state|national|league|conference|division|world|championship) )\btitles?\b|\btitled\b|\bbusiness cards?\b|\borg chart\b|\bladder\b|\bcorner office\b|\bnameplate\b|\b(?:manager|management|principal|leadership) track\b/i],
  ["assists", /\bassists?\b|\bset(?:s|ting)? up (?:\w+ ){0,3}?(?:shots?|scorers?|buckets?|baskets?)\b|\b(?:takes?|took|taking) the (?:last |big |final |open )?shot\b|\bwhoever (?:takes|scores|shoots|gets the)\b|\bscreens? for\b|\bsetting screens\b|\bbylines?\b|\bother (?:people|guys|players|writers)(?:['’]s)? (?:score|scoring|shots?|buckets?)\b|\bshots go in\b/i],
  ["keeping score", /\bkeep(?:s|ing)? (?:the )?score\b|\bkept score\b|\bscorekeep\w*|\bscorecards?\b|\btally\b|\breceipts\b|\bgrudges?\b/i],
];

/** Content words of a sentence, names and stopwords set aside, as three-word phrases. */
function phrases(text: string, names: Set<string>): string[] {
  const w = words(text).filter((x) => !STOPWORDS.has(x) && !names.has(x) && !/^\d+$/.test(x));
  const out: string[] = [];
  for (let i = 0; i + 2 < w.length; i++) out.push(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
}

type Hit = { path: string; start: number; end: number; problem: VoiceProblem; note?: string };

function themeHits(sents: Sentence[], names: Set<string>): Hit[] {
  const pool = sents.filter((s) => isThemeUnit(s.unit));
  const groups: Array<{ label: string; sents: Sentence[] }> = THEMES.map(([name, re]) => ({
    label: `the ${name} joke`,
    sents: pool.filter((s) => re.test(s.text)),
  }));
  const byPhrase = new Map<string, Sentence[]>();
  for (const s of pool) for (const p of new Set(phrases(s.text, names))) byPhrase.set(p, [...(byPhrase.get(p) ?? []), s]);
  const seen = new Set<string>();
  for (const [p, ss] of byPhrase) {
    const key = ss.map((s) => `${s.path}@${s.start}`).join("|");
    if (seen.has(key)) continue; // a longer repeated run: one group, not one per three words
    seen.add(key);
    groups.push({ label: `the phrase "${p}"`, sents: ss });
  }
  const hits: Hit[] = [];
  for (const g of groups) {
    const units = [...new Set(g.sents.map((s) => s.unit))].sort((a, b) => rank(a) - rank(b));
    if (units.length <= 2) continue;
    const keep = units.includes("screenshot_line") ? ["screenshot_line", units.find((u) => u !== "screenshot_line")!] : units.slice(0, 2);
    const note = `${g.label} is already in the ${keep.join(" and the ")}; start from a different résumé fact`;
    for (const s of g.sents) if (!keep.includes(s.unit)) hits.push({ path: s.path, start: s.start, end: s.end, problem: "theme", note });
  }
  return hits;
}

// Six-word runs in the worked examples (their prose, not their field names).
let exampleRuns: Set<string> | null = null;
function examplesSixGrams(): Set<string> {
  if (exampleRuns) return exampleRuns;
  const w = words(FEW_SHOT_EXAMPLES.replace(/\\n/g, " "));
  exampleRuns = new Set();
  for (let i = 0; i + 5 < w.length; i++) {
    const run = w.slice(i, i + 6);
    if (run.filter((x) => !STOPWORDS.has(x)).length >= 2) exampleRuns.add(run.join(" "));
  }
  return exampleRuns;
}

function copiedRun(text: string): string | null {
  const runs = examplesSixGrams();
  const w = words(text);
  for (let i = 0; i + 5 < w.length; i++) {
    const run = w.slice(i, i + 6).join(" ");
    if (runs.has(run)) return run;
  }
  return null;
}

/** Every passage that breaks a rule, merged per field so no two overlap.
 *  `skip` leaves checks out (the tests run the worked examples without `copy`). */
export function findVoiceIssues(comp: Comp, careerText: string, opts: { skip?: VoiceProblem[] } = {}): RepairItem[] {
  const on = (p: VoiceProblem) => !opts.skip?.includes(p);
  const checkPronouns = on("pronoun") && !statesPronouns(careerText);
  const person = new Set(personPaths(comp));
  const sents = sentencesOf(comp);
  const hits: Hit[] = [];

  sents.forEach((s, i) => {
    if (checkPronouns && person.has(s.path) && PRONOUN.test(s.text)) hits.push({ ...s, problem: "pronoun" });
    if (on("isnt-shape")) {
      const next = sents[i + 1]?.path === s.path ? sents[i + 1] : undefined;
      if (SAME_SENTENCE.test(s.text)) hits.push({ ...s, problem: "isnt-shape" });
      else if (HAS_NEG.test(s.text) && next && OPENS_AFFIRM.test(next.text)) hits.push({ ...s, end: next.end, problem: "isnt-shape" });
    }
    if (on("count")) {
      const c = counts(s.text);
      if (c.length) hits.push({ ...s, problem: "count", note: `counts ${c.map((x) => `"${x}"`).join(", ")}; name them instead` });
    }
    if (on("copy")) {
      const run = copiedRun(s.text);
      if (run) hits.push({ ...s, problem: "copy", note: `repeats "${run}" from the examples` });
    }
  });

  if (on("crutch")) {
    // The first tag (screenshot_line first, then the full_report) stays; every later one goes.
    let kept = false;
    for (const s of [...sents].sort((a, b) => rank(a.unit) - rank(b.unit))) {
      const n = s.text.match(CRUTCH)?.length ?? 0;
      if (!n) continue;
      if (!kept && n === 1) kept = true;
      else hits.push({ ...s, problem: "crutch", note: "the report already has its one \", which is the most...\" tag" });
    }
  }

  if (on("theme")) hits.push(...themeHits(sents, namesIn(sents, comp)));

  // Merge per field, in field order, so overlapping hits become one passage.
  const items: RepairItem[] = [];
  for (const path of prosePaths(comp)) {
    const text = getAt(comp, path) as string;
    const mine = hits.filter((h) => h.path === path).sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number; problems: Set<VoiceProblem>; notes: Set<string> }> = [];
    for (const h of mine) {
      const last = merged[merged.length - 1];
      if (last && h.start < last.end) {
        last.end = Math.max(last.end, h.end);
        last.problems.add(h.problem);
        if (h.note) last.notes.add(h.note);
      } else merged.push({ start: h.start, end: h.end, problems: new Set([h.problem]), notes: new Set(h.note ? [h.note] : []) });
    }
    for (const m of merged) {
      const item: RepairItem = { id: String(items.length + 1), path, problems: [...m.problems], text: text.slice(m.start, m.end) };
      if (m.notes.size) item.notes = [...m.notes];
      items.push(item);
    }
  }
  return items;
}

// ---- The repair -----------------------------------------------------------------

export const REPAIR_SYSTEM = `You are the copy desk for Career Player Comp, a comedy product that compares a person's career to one NBA or WNBA player in a scouting report. You get passages from one report, each with its problems and notes, and, when a fix needs facts, the person's résumé. Rewrite each passage so every problem is gone. Unless a problem says otherwise, keep its facts, its joke and roughly its length, and change as few words as you can.

Problems:
- pronoun: the passage calls the person he, she, him, her, his, hers, himself or herself, and the résumé gives no pronouns. Write to the person as "you", or drop the pronoun. A pronoun for the basketball player can stay.
- isnt-shape: the passage says what something isn't, then what it is ("That's not X, that's Y"; "It isn't X. It's Y."). Say the true thing directly, as one statement.
- count: the passage counts employers, jobs, outlets, stops, places, teams or titles ("six outlets", "one company"). Name them from the résumé ("the same company" for one), or drop the count.
- crutch: the passage ends on a ", which is the most..." or ", which is exactly what..." tag the report has already used. Land the joke inside the sentence, without that tag.
- copy: the passage repeats words from the prompt's examples (the notes quote them). Say it in new words.
- theme: this joke or image is already in other fields (the notes say which). Write a new joke from a different résumé fact, in the same form and about the same length: a badge label stays a short Title Case label, a weakness stays a weakness. No two theme rewrites use the same fact.

Every rewrite: the funny part ends the sentence, with no sentence after it that explains it; no advice; no count of employers or stops; years only as the résumé's dates give them; nothing that says what something isn't, then what it is.

Return JSON only, nothing before or after: {"<id>": "<rewritten passage>", ...} with one entry for every id.`;

// No surrounding paragraph goes along: in round 5 Haiku pasted it back into its rewrite.
export function repairMessage(items: RepairItem[], careerText = ""): string {
  const needsFacts = items.some((it) => it.problems.includes("theme") || it.problems.includes("count"));
  return JSON.stringify({
    ...(needsFacts && careerText.trim() ? { resume: careerText } : {}),
    passages: items.map(({ id, path, problems, notes, text }) => ({ id, field: path, problems, ...(notes?.length ? { notes } : {}), text })),
  });
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
    if (typeof next !== "string" || !next.trim() || next.trim() === it.text.trim()) continue; // unchanged is not a repair
    if (typeof current !== "string" || !current.includes(it.text)) continue;
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
  const reply = await callModel(REPAIR_SYSTEM, repairMessage(found, careerText));
  const { comp: repaired, applied, rewrites } = applyRepair(comp, found, reply);
  return { comp: repaired, found, applied, rewrites, remaining: findVoiceIssues(repaired, careerText), called: true };
}

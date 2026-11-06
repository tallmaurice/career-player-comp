// The voice checks: a hit and a miss for each, the worked examples passing them,
// and the one-call repair. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { rootUrl } from "./setup.mts";

const vc = await import(rootUrl("lib/engine/voice-checks.ts"));
const { FEW_SHOT_EXAMPLES } = await import(rootUrl("lib/engine/system-prompt.ts"));

type Comp = Record<string, any>;
const examples: Comp[] = FEW_SHOT_EXAMPLES.split("COMP:\n")
  .slice(1)
  .map((b: string) => JSON.parse(b.slice(0, b.lastIndexOf("}") + 1)));

/** Example 1 with every prose field replaced by a two-word line, so it passes every check. */
function blank(): Comp {
  const c = structuredClone(examples[0]);
  c.player_name = "Test Player"; // not a worked example's player
  let n = 0;
  const line = () => `Quiet w${++n}.`;
  for (const k of ["archetype_title", "ovr_rationale", "card_summary", "screenshot_line", "why_this_player", "secondary_comp", "front_office_fit", "comp_tone"]) c[k] = line();
  c.full_report = [line(), line(), line()].join("\n\n");
  for (const b of c.badges) { b.label = line(); b.earned_by = line(); }
  c.strengths = c.strengths.map(line);
  c.weaknesses = c.weaknesses.map(line);
  c.season_stats = c.season_stats.map((s: Comp) => ({ ...s, line: line() }));
  c.contract.descriptor = line();
  c.draft.note = line();
  return c;
}
const problems = (c: Comp, career = "") => vc.findVoiceIssues(c, career).map((i: Comp) => `${i.path}:${i.problems.join("+")}`);

test("a blank report passes every check", () => assert.deepEqual(problems(blank()), []));

test("the worked examples follow every rule but the copy check (they are the examples)", () => {
  for (const ex of examples) assert.deepEqual(vc.findVoiceIssues(ex, "", { skip: ["copy"] }), []);
});

test("pronoun: he/she for the person is caught; for the player, or with stated pronouns, it isn't", () => {
  const c = blank();
  c.card_summary = "He rebuilt the desk in a year.";
  assert.deepEqual(problems(c), ["card_summary:pronoun"]);
  assert.deepEqual(problems(c, "Jordan Lee (He/Him)"), []);
  const d = blank();
  d.why_this_player = "He ran the offense from the elbow.";
  assert.deepEqual(problems(d), []);
});

test("isnt-shape: \"not X, it's Y\" is caught; a plain negation isn't", () => {
  const c = blank();
  c.screenshot_line = "That's not a career, that's a relay race.";
  assert.deepEqual(problems(c), ["screenshot_line:isnt-shape"]);
  c.screenshot_line = "You could not stop. That is the job.";
  assert.deepEqual(problems(c), []);
});

test("count: a number before stops is caught anywhere in the prose", () => {
  const c = blank();
  c.card_summary = "Six outlets in fifteen years.";
  c.weaknesses[0] = "Eleven stops since the Philly launch";
  c.full_report = "Quiet a1.\n\nQuiet a2, after seven different jobs.\n\nQuiet a3.";
  assert.deepEqual(problems(c), ["card_summary:count", "weaknesses.0:count", "full_report:count"]);
});

test("count: the person's own numbers, \"the one role\" and the stat_line are not counts", () => {
  const c = blank();
  c.card_summary = "Six regional titles and a three-person team grown to twelve.";
  c.screenshot_line = "You hold the one role nobody wants back.";
  c.ovr_rationale = "Fifteen years of uniforms, three title changes and eight video franchises.";
  c.stat_line.teams = "7 employers";
  assert.deepEqual(problems(c), []);
});

test("crutch: the second \", which is the most...\" tag is caught; the first stays", () => {
  const c = blank();
  c.screenshot_line = "You kept the receipts, which is exactly what a scorekeeper does.";
  assert.deepEqual(problems(c), []);
  c.card_summary = "You hired your own replacement, which is the most efficient exit in media.";
  assert.deepEqual(problems(c), ["card_summary:crutch"]);
});

test("copy: six words in a row from the worked examples are caught; five aren't", () => {
  const c = blank();
  c.comp_tone = "The most annoying combination available to a coworker.";
  assert.deepEqual(problems(c), ["comp_tone:copy"]);
  c.comp_tone = "The most annoying combination available, ever.";
  assert.deepEqual(problems(c), []);
});

test("theme: a joke in more than two fields keeps the screenshot_line and the best other", () => {
  const c = blank();
  c.screenshot_line = "Every time it starts working, you're updating LinkedIn.";
  c.full_report = "You left before the second season at BET.\n\nQuiet b2.\n\nYou walked out of SNY once it ran.";
  c.card_summary = "Gone before anyone could ask you to stay.";
  c.weaknesses[0] = "Shown the door before the maintenance phase";
  const out = problems(c);
  assert.deepEqual(out, ["card_summary:theme", "weaknesses.0:theme", "full_report:theme"]);
  const item = vc.findVoiceIssues(c, "").find((i: Comp) => i.path === "full_report");
  assert.equal(item.text, "You walked out of SNY once it ran.");
  assert.match(item.notes[0], /leaving joke is already in the screenshot_line and the full_report ¶1/);
});

test("theme: the same joke in two fields is fine", () => {
  const c = blank();
  c.screenshot_line = "Every time it starts working, you're updating LinkedIn.";
  c.card_summary = "Gone before anyone could see the second year.";
  assert.deepEqual(problems(c), []);
});

test("theme: works on a career unlike his (a teacher who stayed)", () => {
  const c = blank();
  c.screenshot_line = "Seventeen years at Westfield and the trade rumors never started.";
  c.card_summary = "A lifer in the social studies wing.";
  c.badges[0].earned_by = "Turned down the assistant principal track to stay in the classroom";
  c.contract.descriptor = "Loyalty deal for the teacher who never left";
  assert.deepEqual(problems(c), ["badges.0.earned_by:theme", "contract.descriptor:theme"]);
});

test("theme: a repeated three-word phrase counts; repeated names don't", () => {
  const c = blank();
  c.card_summary = "You color-code spreadsheet tabs for fun.";
  c.full_report = "Quiet c1 color-code spreadsheet tabs.\n\nQuiet c2.\n\nQuiet c3.";
  c.front_office_fit = "A team that lets you color-code spreadsheet tabs.";
  assert.deepEqual(problems(c), ["front_office_fit:theme"]);
  const d = blank();
  d.card_summary = "You ran Westfield Heights High.";
  d.full_report = "Quiet d1 at Westfield Heights High.\n\nQuiet d2.\n\nQuiet d3.";
  d.front_office_fit = "Back at Westfield Heights High.";
  assert.deepEqual(problems(d), []);
});

test("repair: one call with the résumé when a fix needs facts, rewrites spliced in, checked again", async () => {
  const c = blank();
  c.card_summary = "Six outlets in fifteen years. He kept moving.";
  const calls: string[] = [];
  const r = await vc.runVoiceRepair(c, "RÉSUMÉ TEXT", async (system: string, user: string) => {
    calls.push(user);
    assert.equal(system, vc.REPAIR_SYSTEM);
    return JSON.stringify({ "1": "Barstool, Complex and SNY in fifteen years.", "2": "You kept moving." });
  });
  assert.equal(calls.length, 1);
  const sent = JSON.parse(calls[0]);
  assert.equal(sent.resume, "RÉSUMÉ TEXT");
  assert.deepEqual(sent.passages.map((p: Comp) => p.problems), [["count"], ["pronoun"]]);
  assert.equal(r.comp.card_summary, "Barstool, Complex and SNY in fifteen years. You kept moving.");
  assert.deepEqual(r.remaining, []);
  assert.equal(c.card_summary, "Six outlets in fifteen years. He kept moving."); // the input isn't mutated
});

test("repair: no call when nothing is found; the résumé stays out when no fix needs it", async () => {
  let called = false;
  const r = await vc.runVoiceRepair(blank(), "", async () => ((called = true), "{}"));
  assert.equal(called, false);
  assert.equal(r.called, false);
  const c = blank();
  c.full_report = "Quiet e1.\n\nThat's not a desk, that's a bunker. Quiet e2.\n\nQuiet e3.";
  const sent = JSON.parse(vc.repairMessage(vc.findVoiceIssues(c, "RÉSUMÉ"), "RÉSUMÉ"));
  assert.equal(sent.resume, undefined);
  assert.deepEqual(Object.keys(sent.passages[0]), ["id", "field", "problems", "text"]);
});

test("repair: a rewrite that comes back unchanged doesn't count as applied", async () => {
  const c = blank();
  c.card_summary = "He rebuilt the desk.";
  const r = await vc.runVoiceRepair(c, "", async () => JSON.stringify({ "1": "He rebuilt the desk." }));
  assert.deepEqual(r.applied, []);
  assert.equal(r.remaining.length, 1);
});

test("pronoun: \"a man\", \"the guy\", \"this guy\" about the person are caught", () => {
  for (const phrase of ["A man who rebuilt the desk.", "The guy ran the room.", "This guy never left.", "A woman with a plan."]) {
    const c = blank();
    c.card_summary = phrase;
    assert.deepEqual(problems(c), ["card_summary:pronoun"], phrase);
  }
  const c = blank();
  c.why_this_player = "The guy ran the room."; // the player's field, not the person's
  assert.deepEqual(problems(c), []);
  c.card_summary = "A man who rebuilt the desk.";
  assert.deepEqual(problems(c, "She/her. Editor."), []); // stated pronouns: not checked
});

test("banned: slop words and the scaffolding phrases are caught anywhere in the prose; journeyman isn't", () => {
  for (const phrase of ["You leverage every room.", "A seamless handoff.", "The part worth saying out loud is the tenure.", "A robust résumé.", "She unlocked the desk.", "At the end of the day, you stayed."]) {
    const c = blank();
    c.full_report = `Quiet a1.\n\n${phrase}\n\nQuiet a3.`;
    assert.deepEqual(problems(c), ["full_report:banned"], phrase);
  }
  const c = blank();
  c.card_summary = "A journeyman with a lock on the desk and a long view.";
  assert.deepEqual(problems(c), []);
  c.card_summary = "Your journey ran through five desks.";
  assert.deepEqual(problems(c), ["card_summary:banned"]);
});

test("copy: a worked example's player sends the screenshot_line to the repair with the example's line", () => {
  const c = blank();
  c.player_name = "Nick Collison";
  c.screenshot_line = "Brand new line.";
  const items = vc.findVoiceIssues(c, "");
  assert.deepEqual(items.map((i: Comp) => `${i.path}:${i.problems}`), ["screenshot_line:copy"]);
  assert.match(items[0].notes[0], /manager track twice/);
  c.player_name = "Becky Hammon";
  assert.deepEqual(problems(c), []);
});

test("repair: the player always goes along; the résumé only for a count, a repeated joke or a copied line", () => {
  const c = blank();
  c.card_summary = "A seamless run.";
  let sent = JSON.parse(vc.repairMessage(vc.findVoiceIssues(c, "R"), "R", "Test Player"));
  assert.equal(sent.resume, undefined);
  assert.equal(sent.player, "Test Player");
  c.card_summary = "Six outlets in fifteen years.";
  sent = JSON.parse(vc.repairMessage(vc.findVoiceIssues(c, "R"), "R", "Test Player"));
  assert.equal(sent.resume, "R");
});

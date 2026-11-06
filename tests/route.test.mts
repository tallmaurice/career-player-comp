// The route wiring: the voice checks and their one repair run after parsing,
// a long résumé gets more room, and a failed repair never costs the user a report.
// The SDK is swapped for tests/fake-anthropic.mts; nothing calls the network.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { rootUrl } from "./setup.mts";

const FAKE_SDK = new URL("./fake-anthropic.mts", import.meta.url).href;
registerHooks({
  resolve: (spec, ctx, next) => (spec === "@anthropic-ai/sdk" ? { url: FAKE_SDK, shortCircuit: true } : next(spec, ctx)),
});
process.env.ANTHROPIC_API_KEY = "test-key";
for (const k of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) delete process.env[k];

const { POST } = await import(rootUrl("app/api/generate-comp/route.ts"));
const { FEW_SHOT_EXAMPLES } = await import(rootUrl("lib/engine/system-prompt.ts"));

// Example 1 (Chauncey Billups, in the pool) with plain two-word prose, so it passes every check.
function cleanComp(): Record<string, any> {
  const b = FEW_SHOT_EXAMPLES.split("COMP:\n")[1];
  const c = JSON.parse(b.slice(0, b.lastIndexOf("}") + 1));
  let n = 0;
  const line = () => `Quiet w${++n}.`;
  for (const k of ["archetype_title", "ovr_rationale", "card_summary", "screenshot_line", "why_this_player", "secondary_comp", "front_office_fit", "comp_tone"]) c[k] = line();
  c.full_report = [line(), line(), line()].join("\n\n");
  for (const x of c.badges) { x.label = line(); x.earned_by = line(); }
  c.strengths = c.strengths.map(line);
  c.weaknesses = c.weaknesses.map(line);
  c.season_stats = c.season_stats.map((s: any) => ({ ...s, line: line() }));
  c.contract.descriptor = line();
  c.draft.note = line();
  return c;
}

const answers = { q1: "a", q2: "b", q3: "c", q4: "d", q5: "e", q6: "f", q7: "g", q8: "h" };
const post = (careerText: string) =>
  POST(new Request("http://localhost/api/generate-comp", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify({ careerText, answers }),
  }));
const fake = () => (globalThis as any).__fake;
beforeEach(() => ((globalThis as any).__fake = { calls: [], comp: JSON.stringify(cleanComp()), repair: "{}" }));

test("a short résumé keeps the 2400-token cap, and a clean report makes no repair call", async () => {
  const res = await post("Editor at a newspaper, 2015 to 2020.");
  assert.equal(res.status, 200);
  assert.deepEqual(fake().calls.map((c: any) => c.kind), ["stream"]);
  assert.equal(fake().calls[0].params.max_tokens, 2400);
});

test("a long résumé gets 3600 tokens; a flagged passage goes to one Haiku repair and comes back fixed", async () => {
  const comp = cleanComp();
  comp.card_summary = "He rebuilt the desk in a year.";
  fake().comp = JSON.stringify(comp);
  fake().repair = JSON.stringify({ "1": "You rebuilt the desk in a year." });
  const res = await post("Editor at a newspaper. ".repeat(400));
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual(fake().calls.map((c: any) => c.kind), ["stream", "create"]);
  assert.equal(fake().calls[0].params.max_tokens, 3600);
  const repair = fake().calls[1].params;
  assert.equal(repair.model, "claude-haiku-5-5");
  assert.deepEqual(repair.thinking, { type: "disabled" });
  assert.equal(JSON.parse(repair.messages[0].content).passages[0].text, "He rebuilt the desk in a year.");
  assert.equal(body.comp.card_summary, "You rebuilt the desk in a year.");
});

test("a failed repair still returns the report, unrepaired", async () => {
  const comp = cleanComp();
  comp.card_summary = "He rebuilt the desk in a year.";
  fake().comp = JSON.stringify(comp);
  fake().repair = new Error("overloaded");
  const res = await post("Editor at a newspaper, 2015 to 2020.");
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.comp.card_summary, "He rebuilt the desk in a year.");
});

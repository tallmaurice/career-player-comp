// =============================================================================
// CPC rebuild A/B harness — OLD (pre-rebuild-stable) vs NEW (this branch).
// Needs a live ANTHROPIC_API_KEY. Cannot run in the build sandbox.
//
//   export ANTHROPIC_API_KEY=sk-ant-...
//   node --experimental-strip-types scripts/ab/run.ts            # 1 draw / profile / arm
//   node --experimental-strip-types scripts/ab/run.ts --draws 2  # more draws (more $)
//
// What it does, in ONE process (no git checkout dance):
//   - NEW arm: imports the REAL branch prompt (system-prompt.ts) + REAL retrieval
//     (retrieval.ts), so it tests exactly what ships.
//   - OLD arm: reconstructs the pre-rebuild-stable system string byte-exact via
//     `git show pre-rebuild-stable:...` (old full-pool prompt, no retrieval).
//   - Runs every profile in scripts/ab/profiles.json through BOTH arms, parses
//     each Comp, and scores the four rubric axes. Writes raw outputs + a summary.
//
// Output: scripts/ab/out/results-<timestamp>.json (raw) and a printed summary.
// =============================================================================
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

// REAL new-branch code (the things that changed):
import { SYSTEM_PROMPT } from "../../lib/engine/system-prompt.ts";
import { classifyCareer, selectCandidates } from "../../lib/engine/retrieval.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "../..");
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2400;

const draws = (() => {
  const i = process.argv.indexOf("--draws");
  return i >= 0 ? Math.max(1, parseInt(process.argv[i + 1] ?? "1", 10)) : 1;
})();

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Set ANTHROPIC_API_KEY first:  export ANTHROPIC_API_KEY=sk-ant-...");
  process.exit(1);
}
const client = new Anthropic({ apiKey });

const profiles = JSON.parse(readFileSync(join(here, "profiles.json"), "utf8"));
const pool = JSON.parse(readFileSync(join(repo, "lib/engine/player-pool.json"), "utf8"));

// ---- NEW arm: mirror lib/engine/index.ts user-message construction ----------
const NEW_LENS_BEST =
  "THIS IS THE ONLY PASS, so deliver the single best card on BOTH axes at once. Find the most precise, non-obvious player on the candidate roster whose real arc rhymes with this career move-for-move, AND land the sharpest, truest, most screenshot-worthy line the tape earns. Maximum accuracy and maximum earned bite together, inside every gate, never crossing into cruelty or the uncontrollable.";

const ANSWER_LABELS: Record<string, string> = {
  q1: "ALTITUDE", q2: "SCOPE", q3: "TEMPERAMENT", q4: "ARC", q5: "CONFLICT",
  q6: "SELF-IMAGE GAP", q7: "ENDGAME", q8: "MOTIVATION",
  q9: "SECRET WEAPON (the thing nobody says out loud)", q10: "RESUME SAFETY-NET",
};
const ORDER = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"];

function answerLines(answers: any): string {
  return ORDER.map((k) => {
    const v = answers[k];
    if (v == null || String(v).trim() === "") return k === "q9" || k === "q10" ? `${ANSWER_LABELS[k]}: (skipped)` : null;
    return `${ANSWER_LABELS[k]}: ${String(v).trim()}`;
  }).filter((l): l is string => l !== null).join("\n");
}

function newUserMessage(careerText: string, answers: any): string {
  const q = classifyCareer(careerText, answers);
  const cands = selectCandidates(q, pool, { size: 40 });
  const slim = cands.map((p: any) => ({
    name: p.name, position_era: p.position_era, league: p.league,
    archetype: p.tags.archetype, build: p.tags.build, trajectory: p.tags.trajectory,
    prominence: p.tags.prominence, era: p.tags.era, descriptors: p.tags.descriptors,
    hook: p.tags.hook, distinctive_detail: p.distinctive_detail, work_style: p.work_style,
  }));
  const roster = `CANDIDATE ROSTER (${slim.length} players, pre-matched to this career — relevant but varied; assign exactly ONE, read all of them first):\n${JSON.stringify(slim)}`;
  const career = careerText.trim()
    ? `CAREER DATA (primary signal):\n${careerText.trim()}`
    : "CAREER DATA: (none provided — no resume. The quiz answers ARE the tape. Build with full confidence from the behavioral pattern, per THIN OR MISSING RESUME.)";
  return [roster, "", career, "", "ANSWERS:", answerLines(answers), "", NEW_LENS_BEST, "", "Return valid JSON only, exactly the schema in the system prompt. No prose before or after."].join("\n");
}

// ---- OLD arm: reconstruct pre-rebuild-stable byte-exact from git -------------
const OLD_LENS_BEST =
  "THIS IS THE ONLY PASS, so deliver the single best card on BOTH axes at once. Find the most precise, non-obvious player in the pool whose real arc rhymes with this career move-for-move, AND land the sharpest, truest, most screenshot-worthy line the tape earns. Maximum accuracy and maximum earned bite together, inside every gate, never crossing into cruelty or the uncontrollable.";

async function buildOldSystemString(): Promise<string> {
  const gen = join(here, "out", ".gen");
  mkdirSync(gen, { recursive: true });
  const spSrc = execSync("git show pre-rebuild-stable:lib/engine/system-prompt.ts", { cwd: repo, maxBuffer: 1 << 24 }).toString();
  const poolSrc = execSync("git show pre-rebuild-stable:lib/engine/player-pool.json", { cwd: repo, maxBuffer: 1 << 24 }).toString();
  const spPath = join(gen, "old-system-prompt.ts");
  writeFileSync(spPath, spSrc);
  const oldPool = JSON.parse(poolSrc);
  const sp: any = await import(pathToFileURL(spPath).href);
  return (
    sp.SYSTEM_PROMPT_V7.replace(sp.PLAYER_POOL_SLOT, JSON.stringify(oldPool)) +
    sp.GRADES_ADDENDUM + sp.OVR_ADDENDUM + sp.TIER1_ADDENDUM + sp.TIER2_ADDENDUM + sp.VOICE_ADDENDUM + sp.POOL_ADDENDUM
  );
}

function oldUserMessage(careerText: string, answers: any): string {
  const career = careerText.trim()
    ? `CAREER DATA (primary signal):\n${careerText.trim()}`
    : "CAREER DATA: (none provided — no resume. The quiz answers ARE the tape. Build with full confidence from the behavioral pattern, per THIN OR MISSING RESUME.)";
  return [career, "", "ANSWERS:", answerLines(answers), "", OLD_LENS_BEST, "", "Return valid JSON only, exactly the schema in the system prompt. No prose before or after."].join("\n");
}

// ---- Call + parse -----------------------------------------------------------
function extractJson(text: string): any | null {
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1].trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

async function callArm(system: string, user: string): Promise<{ raw: string; comp: any | null }> {
  const msg = await client.messages.create({
    model: MODEL, max_tokens: MAX_TOKENS,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] as any,
    messages: [{ role: "user", content: user }],
  });
  const raw = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return { raw, comp: extractJson(raw) };
}

// ---- Metrics ----------------------------------------------------------------
const AI_SLOP = ["delve", "dive deep", "unlock", "empower", "seamless", "leverage", "elevate", "robust", "game-chang", "thought leader", "move the needle", "north star", "transformative", "tapestry"];
function metricsFor(comp: any): any {
  if (!comp) return { ok: false };
  const fr = String(comp.full_report ?? "");
  const allText = [comp.card_summary, comp.screenshot_line, fr, comp.why_this_player].map((x) => String(x ?? "")).join("\n");
  const emDash = (allText.match(/—/g) || []).length;
  const notXY = (allText.match(/\b(not|isn't|isn’t|won't|doesn't)\b[^.?!]{1,60}?,?\s+(it's|it’s|that's|that’s|the tape|he's|she's|they're)\b/gi) || []).length;
  const slop = AI_SLOP.filter((w) => allText.toLowerCase().includes(w));
  const paras = fr.split(/\n\n+/).map((p) => p.trim()).filter(Boolean).length;
  return {
    ok: true, player: comp.player_name, ovr: comp.ovr, pot: comp.pot,
    reportParas: paras, emDash, notXY, aiSlop: slop,
    screenshot_line: comp.screenshot_line,
  };
}

// ---- Run --------------------------------------------------------------------
const OLD_SYSTEM = await buildOldSystemString();
console.log(`OLD system string: ${OLD_SYSTEM.length} chars | NEW system string: ${SYSTEM_PROMPT.length} chars`);
console.log(`Running ${profiles.length} profiles x ${draws} draw(s) x 2 arms = ${profiles.length * draws * 2} calls...\n`);

const results: any[] = [];
for (const prof of profiles) {
  for (let d = 0; d < draws; d++) {
    const newUser = newUserMessage(prof.careerText, prof.answers);
    const oldUser = oldUserMessage(prof.careerText, prof.answers);
    const [oldR, newR] = await Promise.all([callArm(OLD_SYSTEM, oldUser), callArm(SYSTEM_PROMPT, newUser)]);
    const om = metricsFor(oldR.comp), nm = metricsFor(newR.comp);
    results.push({ id: prof.id, label: prof.label, draw: d, old: { ...om, raw: oldR.raw }, new: { ...nm, raw: newR.raw } });
    console.log(`${prof.id.padEnd(26)} OLD->${String(om.player ?? "FAIL").padEnd(22)} NEW->${nm.player ?? "FAIL"}`);
  }
}

// ---- Summary ----------------------------------------------------------------
function distinct(arm: "old" | "new"): Set<string> {
  return new Set(results.map((r) => r[arm].player).filter(Boolean));
}
function avg(arm: "old" | "new", key: string): number {
  const v = results.map((r) => r[arm][key]).filter((x) => typeof x === "number");
  return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : 0;
}
function slopCount(arm: "old" | "new"): number {
  return results.reduce((n, r) => n + (r[arm].aiSlop?.length || 0), 0);
}
const safetyIds = ["injection-attempt", "offensive-attempt"];
const safety = results.filter((r) => safetyIds.includes(r.id)).map((r) => ({
  id: r.id, oldPlayer: r.old.player, newPlayer: r.new.player,
  oldRedFlag: /lebron/i.test(String(r.old.player)) || r.old.ovr >= 97,
  newRedFlag: /lebron/i.test(String(r.new.player)) || r.new.ovr >= 97,
}));

function stocktonPair(arm: "old" | "new") {
  const a = results.find((r) => r.id === "stockton-swap-A")?.[arm].player;
  const b = results.find((r) => r.id === "stockton-swap-B")?.[arm].player;
  return { a, b, moved: a !== b, stocktonInA: /stockton/i.test(String(a)), stocktonInB: /stockton/i.test(String(b)) };
}

const summary = {
  distinctPlayers: { old: distinct("old").size, new: distinct("new").size, total: results.length },
  avgEmDash: { old: avg("old", "emDash"), new: avg("new", "emDash") },
  avgNotXY: { old: avg("old", "notXY"), new: avg("new", "notXY") },
  aiSlopHits: { old: slopCount("old"), new: slopCount("new") },
  avgReportParas: { old: avg("old", "reportParas"), new: avg("new", "reportParas") },
  reportParaOffTarget: {
    old: results.filter((r) => r.old.ok && r.old.reportParas !== 3).length,
    new: results.filter((r) => r.new.ok && r.new.reportParas !== 3).length,
  },
  safety, stocktonSwap: { old: stocktonPair("old"), new: stocktonPair("new") },
};

mkdirSync(join(here, "out"), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = join(here, "out", `results-${stamp}.json`);
writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2));

console.log("\n================= SUMMARY =================");
console.log(JSON.stringify(summary, null, 2));
console.log(`\nDistinct players — OLD: ${summary.distinctPlayers.old}  NEW: ${summary.distinctPlayers.new}  (of ${results.length} comps)`);
console.log(`Raw outputs + summary written to: ${outPath}`);
console.log("\nNow score by the rubric in scripts/ab/README.md (player spread is the headline; voice + safety + Stockton-swap are gates).");

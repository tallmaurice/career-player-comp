// =============================================================================
// Lane check — live generation validation for a pool-magnet fix. NEW arm only.
//
// Runs the CURRENT branch engine (real system-prompt.ts + retrieval.ts + pool)
// over the invisible-value lane profiles and counts which players actually get
// PICKED. This is the generation-side proof the deterministic magnet-audit
// can't give: retrieval decides the at-bats, this shows the swings.
//
//   export ANTHROPIC_API_KEY=sk-ant-...
//   node --experimental-strip-types scripts/ab/lane-check.ts            # lane slice (~13 calls)
//   node --experimental-strip-types scripts/ab/lane-check.ts --all      # every profile
//   node --experimental-strip-types scripts/ab/lane-check.ts --focus "Shane Battier"
//
// PASS for the Battier fix: Battier 0-1 picks across the lane slice, no other
// single player taking 3+ of the lane, picks spread across the quiet-value
// cluster (Parish / A.C. Green / Haslem / Bobby Jones / P.J. Brown / Cooper /
// Tucker / Bowen / James Jones ...).
// =============================================================================
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SYSTEM_PROMPT } from "../../lib/engine/system-prompt.ts";
import { classifyCareer, selectCandidates } from "../../lib/engine/retrieval.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "../..");
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2400;

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Set ANTHROPIC_API_KEY first:  export ANTHROPIC_API_KEY=sk-ant-...");
  process.exit(1);
}
const client = new Anthropic({ apiKey });

const FOCUS = (() => {
  const i = process.argv.indexOf("--focus");
  return i >= 0 ? process.argv[i + 1] ?? "Shane Battier" : "Shane Battier";
})();
const ALL = process.argv.includes("--all");

// The lane slice: every media-ops profile + the general profiles whose careers
// read as quiet/underrated/behind-the-scenes value.
const LANE_EXTRAS = new Set([
  "glue-quiet-coordinator",
  "specialist-deep-niche",
  "teacher-lifer-20yr",
  "nurse-devoted",
  "forklift-warehouse-lead",
]);

const profiles = JSON.parse(readFileSync(join(here, "profiles.json"), "utf8")).filter(
  (p: any) => ALL || p.group === "media-ops" || LANE_EXTRAS.has(p.id),
);
const pool = JSON.parse(readFileSync(join(repo, "lib/engine/player-pool.json"), "utf8"));

const ANSWER_LABELS: Record<string, string> = {
  q1: "ALTITUDE", q2: "SCOPE", q3: "TEMPERAMENT", q4: "ARC", q5: "CONFLICT",
  q6: "SELF-IMAGE GAP", q7: "ENDGAME", q8: "MOTIVATION",
  q9: "SECRET WEAPON (the thing nobody says out loud)", q10: "RESUME SAFETY-NET",
};
const ORDER = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"];
const LENS_BEST =
  "THIS IS THE ONLY PASS, so deliver the single best card on BOTH axes at once. Find the most precise, non-obvious player on the candidate roster whose real arc rhymes with this career move-for-move, AND land the sharpest, truest, most screenshot-worthy line the tape earns. Maximum accuracy and maximum earned bite together, inside every gate, never crossing into cruelty or the uncontrollable.";

function answerLines(answers: any): string {
  return ORDER.map((k) => {
    const v = answers[k];
    if (v == null || String(v).trim() === "") return k === "q9" || k === "q10" ? `${ANSWER_LABELS[k]}: (skipped)` : null;
    return `${ANSWER_LABELS[k]}: ${String(v).trim()}`;
  }).filter((l): l is string => l !== null).join("\n");
}

function userMessage(careerText: string, answers: any): { msg: string; focusRank: number } {
  const q = classifyCareer(careerText, answers);
  const cands = selectCandidates(q, pool, { size: 40 });
  const focusRank = cands.findIndex((c: any) => c.name === FOCUS) + 1; // 0 = not in roster
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
  const msg = [roster, "", career, "", "ANSWERS:", answerLines(answers), "", LENS_BEST, "", "Return valid JSON only, exactly the schema in the system prompt. No prose before or after."].join("\n");
  return { msg, focusRank };
}

function extractJson(text: string): any | null {
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1].trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

const picks = new Map<string, string[]>();
console.log(`Lane check: ${profiles.length} profiles, NEW arm only, focus=${FOCUS}\n`);
for (const prof of profiles) {
  const { msg, focusRank } = userMessage(prof.careerText, prof.answers);
  try {
    const res = await client.messages.create({
      model: MODEL, max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }] as any,
      messages: [{ role: "user", content: msg }],
    });
    const raw = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const comp = extractJson(raw);
    const player = comp?.player_name ?? "(parse failed)";
    const list = picks.get(player) ?? [];
    list.push(prof.id);
    picks.set(player, list);
    const focusNote = focusRank > 0 ? `  [${FOCUS} in roster @${focusRank}]` : `  [${FOCUS} not in roster]`;
    console.log(`${prof.id.padEnd(26)} -> ${String(player).padEnd(22)} ovr=${comp?.ovr ?? "?"} "${comp?.archetype_title ?? ""}"${focusNote}`);
  } catch (e) {
    console.log(`${prof.id.padEnd(26)} -> ERROR ${e instanceof Error ? e.message : e}`);
  }
}

console.log(`\n--- PICK DISTRIBUTION ---`);
const sorted = [...picks.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [name, ids] of sorted) {
  const flag = ids.length >= 3 ? "  << MAGNET WATCH" : "";
  console.log(`${String(ids.length).padStart(2)}x ${name.padEnd(24)} ${ids.join(", ")}${flag}`);
}
const focusPicks = picks.get(FOCUS)?.length ?? 0;
console.log(`\n${FOCUS}: picked ${focusPicks}/${profiles.length}.  PASS = 0-1 for the lane slice, and no other single name at 3+.`);

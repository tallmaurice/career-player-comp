// Pool-magnet audit — deterministic, in-sandbox, NO API key.
// Run: node --experimental-strip-types scripts/magnet-audit.ts
//
// The spread test proves the pool COVERAGE is wide; this audit answers the
// opposite question: which individual players land in too many shortlists
// (magnets), and why. A magnet that sits high in the MMR order of most rosters
// gets over-picked by the model even when generation behaves — retrieval hands
// it the at-bat every time.
//
// Reports:
//   1. Magnet leaderboard — shortlist appearance rate + mean MMR rank, all profiles.
//   2. The "invisible value" lane — per media-ops profile, top-10 by RAW
//      relevance score (pre-MMR), with scores: is one player dominating the
//      lane, and who is supposed to compete with them?
//   3. Tag-breadth outliers — players whose fingerprint spans the most values
//      on the scored axes (broad tags = broad attraction).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { classifyCareer, selectCandidates, scorePlayer } from "../lib/engine/retrieval.ts";

const here = dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(readFileSync(join(here, "../lib/engine/player-pool.json"), "utf8"));
const profiles = JSON.parse(readFileSync(join(here, "ab/profiles.json"), "utf8"));

const SIZE = 40;
const FOCUS = process.argv[2] ?? "Shane Battier";

interface Appearance { profile: string; rank: number; group?: string }
const appearances = new Map<string, Appearance[]>();

for (const prof of profiles) {
  const q = classifyCareer(prof.careerText, prof.answers);
  const cands = selectCandidates(q, pool, { size: SIZE });
  cands.forEach((c: any, rank: number) => {
    const list = appearances.get(c.name) ?? [];
    list.push({ profile: prof.id, rank: rank + 1, group: prof.group });
    appearances.set(c.name, list);
  });
}

// ---- 1. Magnet leaderboard ---------------------------------------------------
const rows = [...appearances.entries()]
  .map(([name, apps]) => ({
    name,
    n: apps.length,
    meanRank: apps.reduce((s, a) => s + a.rank, 0) / apps.length,
    top5: apps.filter((a) => a.rank <= 5).length,
  }))
  .sort((a, b) => b.n - a.n || a.meanRank - b.meanRank);

console.log(`\n=== MAGNET LEADERBOARD (${profiles.length} profiles, shortlist=${SIZE}) ===`);
console.log(`appear = shortlists landed in; meanRank = avg position in the roster order the model sees; top5 = times in the roster's first 5\n`);
for (const r of rows.slice(0, 20)) {
  console.log(
    `${r.name.padEnd(24)} appear=${String(r.n).padStart(2)}/${profiles.length}  meanRank=${r.meanRank.toFixed(1).padStart(5)}  top5=${r.top5}`,
  );
}

// ---- 2. Focus player deep-dive ------------------------------------------------
const focusApps = appearances.get(FOCUS) ?? [];
console.log(`\n=== FOCUS: ${FOCUS} ===`);
console.log(`Shortlists: ${focusApps.length}/${profiles.length}`);
for (const a of focusApps.sort((x, y) => x.rank - y.rank)) {
  console.log(`  rank ${String(a.rank).padStart(2)}  ${a.profile}${a.group ? `  [${a.group}]` : ""}`);
}

// ---- 3. The "invisible value" lane: raw-score top-10 per media-ops profile ----
console.log(`\n=== INVISIBLE-VALUE LANE — raw relevance top-10 (pre-MMR) ===`);
for (const prof of profiles.filter((p: any) => p.group === "media-ops")) {
  const q = classifyCareer(prof.careerText, prof.answers);
  const scored = pool
    .map((p: any) => ({ name: p.name, score: scorePlayer(q, p) }))
    .sort((a: any, b: any) => b.score - a.score);
  const line = scored
    .slice(0, 10)
    .map((s: any, i: number) => `${i + 1}.${s.name} ${s.score.toFixed(1)}`)
    .join("  ");
  console.log(`\n${prof.id}\n  ${line}`);
}

// ---- 4. Tag-breadth outliers ---------------------------------------------------
const breadth = pool
  .map((p: any) => ({
    name: p.name,
    arch: p.tags.archetype.length,
    build: p.tags.build.length,
    traj: p.tags.trajectory.length,
    desc: p.tags.descriptors.length,
    total:
      p.tags.archetype.length + p.tags.build.length + p.tags.trajectory.length + p.tags.descriptors.length,
  }))
  .sort((a: any, b: any) => b.total - a.total);
const avg = breadth.reduce((s: number, b: any) => s + b.total, 0) / breadth.length;
console.log(`\n=== TAG BREADTH (scored axes; pool avg total=${avg.toFixed(1)}) ===`);
for (const b of breadth.slice(0, 15)) {
  console.log(
    `${b.name.padEnd(24)} total=${String(b.total).padStart(2)}  arch=${b.arch} build=${b.build} traj=${b.traj} desc=${b.desc}`,
  );
}
const focusB = breadth.find((b: any) => b.name === FOCUS);
if (focusB) {
  const rank = breadth.indexOf(focusB) + 1;
  console.log(`\n${FOCUS}: total=${focusB.total} (rank ${rank}/${pool.length}, pool avg ${avg.toFixed(1)})`);
}

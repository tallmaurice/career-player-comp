// Deterministic, in-sandbox proof that retrieval delivers VARIETY (no API key).
// Run: node --experimental-strip-types scripts/retrieval-spread-test.ts
//
// Checks: (1) pool coverage — how many of the 204 surface across the battery
// (the headline anti-clustering metric), (2) per-profile internal variety (no
// single archetype dominates a shortlist), (3) determinism (same query twice ->
// identical shortlist), (4) the Stockton school-swap sanity (the two near-
// identical resumes get near-identical shortlists — retrieval is career-driven,
// not word-matched).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { classifyCareer, selectCandidates } from "../lib/engine/retrieval.ts";

const here = dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(readFileSync(join(here, "../lib/engine/player-pool.json"), "utf8"));
const profiles = JSON.parse(readFileSync(join(here, "ab/profiles.json"), "utf8"));

const SIZE = 40;
const seen = new Map<string, number>();
let totalArchetypeMax = 0;
const perProfile: { id: string; distinctArch: number; topArch: string; topArchN: number; sample: string[] }[] = [];

for (const prof of profiles) {
  const q = classifyCareer(prof.careerText, prof.answers);
  const cands = selectCandidates(q, pool, { size: SIZE });
  // determinism: run again, compare names in order
  const again = selectCandidates(q, pool, { size: SIZE });
  const deterministic = cands.map((c: any) => c.name).join("|") === again.map((c: any) => c.name).join("|");
  if (!deterministic) console.log(`!! NON-DETERMINISTIC: ${prof.id}`);

  const archCount: Record<string, number> = {};
  for (const c of cands) {
    seen.set(c.name, (seen.get(c.name) ?? 0) + 1);
    const a = c.tags.archetype[0] ?? "_";
    archCount[a] = (archCount[a] ?? 0) + 1;
  }
  const topArch = Object.entries(archCount).sort((a, b) => b[1] - a[1])[0];
  totalArchetypeMax = Math.max(totalArchetypeMax, topArch[1]);
  perProfile.push({
    id: prof.id,
    distinctArch: Object.keys(archCount).length,
    topArch: topArch[0],
    topArchN: topArch[1],
    sample: cands.slice(0, 6).map((c: any) => c.name),
  });
}

console.log(`\n=== RETRIEVAL SPREAD TEST (${profiles.length} profiles, shortlist=${SIZE}) ===\n`);
for (const p of perProfile) {
  console.log(`${p.id.padEnd(26)} distinctArch=${p.distinctArch}  topArch=${p.topArch}(${p.topArchN}/${SIZE})  e.g. ${p.sample.join(", ")}`);
}

const coverage = seen.size;
console.log(`\n--- HEADLINE: POOL COVERAGE ---`);
console.log(`Distinct players surfaced across the battery: ${coverage} / ${pool.length}  (${Math.round((coverage / pool.length) * 100)}%)`);
console.log(`Max times any single archetype dominated one shortlist: ${totalArchetypeMax}/${SIZE} (cap is ${Math.ceil(SIZE / 4)})`);

// players that NEVER surface
const never = pool.filter((p: any) => !seen.has(p.name)).map((p: any) => p.name);
console.log(`Players never surfaced (${never.length}): ${never.slice(0, 30).join(", ")}${never.length > 30 ? " ..." : ""}`);

// Stockton swap overlap
const A = profiles.find((p: any) => p.id === "stockton-swap-A");
const B = profiles.find((p: any) => p.id === "stockton-swap-B");
if (A && B) {
  const ca = new Set(selectCandidates(classifyCareer(A.careerText, A.answers), pool, { size: SIZE }).map((c: any) => c.name));
  const cb = selectCandidates(classifyCareer(B.careerText, B.answers), pool, { size: SIZE }).map((c: any) => c.name);
  const overlap = cb.filter((n: string) => ca.has(n)).length;
  console.log(`\n--- STOCKTON SWAP (retrieval is career-driven, not word-matched) ---`);
  console.log(`Shortlist overlap A vs B (school is the only diff): ${overlap}/${SIZE} — should be ~${SIZE} (near-identical), and John Stockton's presence should be identical in both.`);
  const stocktonInA = ca.has("John Stockton");
  const stocktonInB = cb.includes("John Stockton");
  console.log(`John Stockton in A: ${stocktonInA}, in B: ${stocktonInB} (must match — the school name must not move the shortlist).`);
}

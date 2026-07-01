# CPC Tag Vocabulary (rebuild-variation)

The controlled, fixed vocabulary used for **retrieval**: every player carries a
`tags` object; an incoming career is classified into the SAME vocabulary; the
shortlist is scored by overlap across all axes, then spread for variety.

**Rules for taggers:**
- Use ONLY the listed values. Never invent a value for the closed axes.
- Multi-value axes: assign EVERY value the career genuinely earns (usually 1–3),
  never just one if more fit — a volume scorer who became a defensive specialist
  gets both. But do not pad: only values the record actually supports.
- The point of a rich fingerprint is that two players who share a top-line
  archetype (e.g. Haslem vs Battier, both glue) DIFFER on every other axis. Tag
  the differences, not just the headline.
- `hook` is the one freeform field: a single sentence naming what makes THIS
  player a specific, non-generic comp — the structural rhyme a career would have
  to match. Not a bio; the *comp logic*.

---

## Axis 1 — `archetype` (multi-value, 1–3) — what KIND of contributor
Maps the quiz TEMPERAMENT question. The strongest career-match signal.

| value | meaning |
|---|---|
| `closer` | takes and makes the high-leverage shot; wants the ball when it matters |
| `facilitator` | makes everyone around them better; sets up the play, runs the offense |
| `anchor` | the steadying force; holds the floor/locker room; does the dirty defensive/structural work |
| `specialist` | elite at one specific thing, narrow and deep |
| `spark` | energy/momentum changer; off-the-bench jolt; tempo and emotion |
| `do-it-all` | positionless generalist; fills whatever the team is missing |

## Axis 2 — `build` (multi-value, 1–2) — builder-vs-joiner type
Maps the quiz ALTITUDE question. How they relate to the thing they're known for.

| value | meaning |
|---|---|
| `founder` | built it from nothing; created the thing |
| `turnaround` | took something broken and fixed it; rebuilt/reinvented a situation |
| `operator` | ran something already working and kept it humming; steward of a machine |
| `glue` | made a good team better from inside it; force-multiplier, not the headline |
| `craftsman` | got elite at one specific craft; mastery as the whole game |

## Axis 3 — `trajectory` (multi-value, 1–2) — career shape over time
Maps the quiz ARC question. Use the rich set; the quiz produces the first five.

| value | meaning |
|---|---|
| `lifer` | one lane / one place, gone deep, never left |
| `steady-prime` | a long, steady climb up one ladder; reliable sustained peak |
| `reinventor` | one or more full reinventions; changed games/identities |
| `journeyman` | many stops, always lands on their feet; survivor |
| `late-bloomer` | a slow burn that took years to click, then did |
| `slow-climb` | undrafted/overlooked start, climbed the hard way |
| `injury-arc` | a major derailment (injury/setback) and what came after |
| `org-capped` | ceiling capped by a bad situation/org, not by ability |
| `franchise-architect` | built and then ran the institution across roles |
| `chased-the-ring` | left a home for a better shot at winning |
| `political-exit` | a peak cut short by a falling-out / forced departure |

## Axis 4 — `prominence` (SINGLE value) — how high they rose
A calibration + variety axis. Keeps a modest career from pulling 40 superstars.
Derived for the query from seniority/scope signals, loosely.

| value | meaning |
|---|---|
| `apex` | inner-circle all-time great (Jordan/LeBron/Kareem tier) |
| `star` | franchise-level star, widely known |
| `starter` | solid long-time starter, respected, not a household name |
| `role` | valued role player; known to ball-watchers, not casuals |
| `deep-cut` | obscure even to many fans; the connoisseur's pick |

## Axis 5 — `era` (SINGLE value) — for variety/flavor only (not query-matched)
Derive from `position_era`.

`60s-70s` · `80s` · `90s` · `2000s` · `2010s` · `current`
(Span careers: use the decade of their defining peak.)

## Axis 6 — `descriptors` (multi-value, 2–5) — the selective fingerprint
Apply a tag ONLY when it is genuinely DEFINING for this player — not "true of
many." Selectivity is the point: a descriptor that lands on a third of the pool
discriminates nothing. These match résumé keywords + the sharper quiz signals.

`clutch` · `defensive-anchor` · `undrafted` · `system-dependent` ·
`injury-comeback` · `longevity` · `one-team-loyal` · `ring-chaser` ·
`underdog` · `vocal-leader` · `quiet-leader` · `positionless` ·
`elite-specialist` · `volume-scorer` · `locker-room-glue` · `coach-on-floor` ·
`journeyman-survivor` · `org-capped` · `overlooked` · `high-pedigree` ·
`won-it-all` · `never-won-big` · `defensive-stopper` · `two-way` · `iron-man`

## `hook` (freeform, ONE sentence)
What makes THIS player a specific comp — the structural rhyme a career must
match to earn them. The hook must carry a CONSTRAINING career-shape condition,
never a universally flattering pitch: a hook like "value invisible in the box
score" with no gate matches every underrated career and turns the player into a
pool magnet (this is exactly how Battier over-fired at launch). Example
(Battier, post-audit): "The comp for a high-pedigree specialist who joins teams
that are already good and does the specific unglamorous work that tips them to
great — the credentialed final piece who chose winning over numbers, not the
overlooked grinder."

---

## Query mapping (deterministic, in code — for reference)
- `archetype` ← quiz Q3 TEMPERAMENT option
- `build` ← quiz Q1 ALTITUDE option
- `trajectory` ← quiz Q4 ARC option
- `prominence` ← quiz Q2 SCOPE + Q7 ENDGAME + résumé seniority keywords
- `descriptors` ← résumé keyword scan + quiz Q6/Q8 + Q9/Q10 free text
- `era` ← not queried; used only to spread the shortlist across eras

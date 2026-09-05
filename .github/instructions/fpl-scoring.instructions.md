---
description: "Use when: ranking FPL transfer candidates, suggesting a captain pick, or computing a player score for the FPL dashboard. Defines the exact, reproducible scoring formula (form + fixture difficulty + value + underlying, scaled by availability) and how to show the breakdown."
name: "FPL Scoring"
applyTo: ["server/**", "client/**"]
---

# FPL scoring — transfer & captain suggestions

Use one transparent, reproducible score. **Always show the breakdown** (each component's value and weight) — never a black-box ranking. All inputs come from the verified fields in `fpl-api-quirks.instructions.md`.

## Normalization
Normalize each raw component to **0–100** before weighting, so the components are comparable:
- **Form** → `form` (last ~5 GWs). Scale: `min(100, form / 10 * 100)` (10 pts/GW ≈ max).
- **Value** → `value_season` (points per million). Scale against the league: `value_season / max_value_season * 100` (max over all players, or over the same position for transfer candidates).
- **Fixture difficulty (next 3 GWs)** → average FDR of the player's next 3 fixtures. FDR is a **1-5 scale (1=easiest, 5=hardest)**. Lower is better. Scale: `(5 - avgFDR) / 4 * 100` (avgFDR=1 → 100, avgFDR=5 → 0). *(Corrected: the original `(6 - avgFDR)/4*100` produced 25–125, violating the 0–100 normalization and contradicting these endpoints.)*
- **Underlying (xGI per 90)** → `expected_goal_involvements_per_90` (xG+xA per 90 minutes). Scale against the pool: `xgi90 / max_xgi90 * 100` (max over all players for captain, or over the same position for transfer candidates — same scoping as Value above). **Reliability gate:** below `MIN_MINUTES_FOR_XGI` (180 minutes) a player's own `xgi90` normalizes to the neutral midpoint (not their real value) AND they're excluded when computing `max_xgi90` for everyone else — a per-90 stat is a raw extrapolation and is nonsensical at low sample size (see the "Per-90 stats and small-sample distortion" note in `fpl-api-quirks.instructions.md`).

## Transfer-candidate score (next 3 gameweeks)
Weighted sum, weights sum to 100:
- **Form: 30%**
- **Fixture difficulty (next 3 GWs): 30%**
- **Value: 20%**
- **Underlying (xGI/90): 20%**

`rawScore = 0.30*formN + 0.30*fixtureN + 0.20*valueN + 0.20*underlyingN`
`score = rawScore * availabilityMultiplier` — see Availability below; this is the actual ranking score.

For a replacement candidate, also require:
- Same position as the player being replaced (or a valid squad slot).
- Fits the remaining budget (price ≤ bank + price of the player being sold).
- Not already in the squad.

Rank the top 5 by `score`. Show, per candidate: form (raw + normalized), avg FDR next 3 (raw + normalized), value (raw + normalized), underlying (raw + normalized), and both `rawScore` (as `preAvailabilityScore`) and the final `score`. See the Double/Blank Gameweek correction below — it can override the fixture component's normalized value for the gameweek being planned for.

## Captain score (single next gameweek)
Same components, but **weighted toward the fixture(s) of the specific gameweek being planned for**:
- **Form: 35%**
- **Fixture difficulty (that gameweek): 35%** — use the actual fixture(s) *of that gameweek*, not "whichever real match comes next chronologically" (those can differ — see Double/Blank Gameweek correction below). Normalize with `(5 - FDR) / 4 * 100`.
- **Value: 10%**
- **Underlying (xGI/90): 20%**

`rawScore = 0.35*formN + 0.35*fixtureN + 0.10*valueN + 0.20*underlyingN`
`captainScore = rawScore * availabilityMultiplier`

Only consider players in the **starting XI** for the upcoming gameweek. Show the same breakdown per candidate.

## Availability multiplier (chance of playing)

`chance_of_playing_this_round` (falling back to `chance_of_playing_next_round`, falling back to 100 when both are `null` — see the quirks doc) answers a different question than the 4 weighted components above: not "how good is this player if they play" but "how likely are they to play at all". Model it as a **multiplier on the final weighted score**, not a 5th normalized-and-weighted component — diluting a 25%-chance-of-playing player into one nudge among five components would barely move their rank, when in reality their expected contribution really is roughly a quarter of a fully-fit player's.

`availabilityMultiplier = clamp(availabilityPct, 0, 100) / 100`
`score = rawScore * availabilityMultiplier`

Always expose **both** `rawScore` (as `preAvailabilityScore`) and the final `score` — a breakdown whose components sum to a number other than the final score, with no explanation, looks like a bug even when it's working as designed. Armbanding a doubtful captain is one of the most common real FPL mistakes this exists to catch.

## Penalty order (informational only, not scored)

`penalties_order` (1 = the club's first-choice taker) is surfaced as a badge only — **never weighted into the score**. How many penalties a team is awarded over a run of fixtures is too unpredictable to model as a formula input without implying false precision the data doesn't support.

## Double/Blank Gameweek correction

A team can have 0 fixtures (Blank Gameweek) or 2+ fixtures (Double Gameweek) in a given gameweek. This must be read from the **actual fixtures of the gameweek being planned for**, not from "next 3/1 real matches chronologically" — that list skips a blank silently (jumping to a later gameweek's fixture and hiding that the player scores 0 in the one being planned for) and can't distinguish a double's two legs from two fixtures in different future gameweeks.

- **Blank Gameweek (0 fixtures that gameweek):** force the fixture component's normalized value to **0**, not the neutral-midpoint fallback below — this is a known guaranteed zero, not missing data. Applies to both transfer and captain scoring, and matters most for captain: armbanding a player with a blank wastes the whole pick (0 × 2 = 0).
- **Double Gameweek (2+ fixtures that gameweek):** add a flat bonus (`SCORING.dgwBonus`, +20) to the fixture component's normalized value (capped at 100) for both transfer and captain scoring — two scoring chances is real extra expected value a single-fixture-shaped average can't express. For captain specifically, use the **average** difficulty of both legs as the base FDR before adding the bonus.
- Always record which adjustment fired (`'blank'` / `'double'` / `null`) alongside the component's raw/normalized/weight/points breakdown, and surface it in the UI (a BLANK/DGW badge) — this is exactly the kind of invisible number shift the "never a black box" rule exists to prevent.

## Notes
- If a component is missing/null for a reason other than a confirmed blank (e.g. a player with literally no fixture data scheduled anywhere yet), treat its normalized value as the neutral midpoint (50) and note it in the breakdown. A confirmed Blank Gameweek is not this case — see above, it's forced to 0.
- Keep weights in one place (a config object) so they are easy to tune, and echo the weights used in the UI.

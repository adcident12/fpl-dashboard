---
description: "Use when: ranking FPL transfer candidates, suggesting a captain pick, or computing a player score for the FPL dashboard. Defines the exact, reproducible scoring formula (form + fixture difficulty + value) and how to show the breakdown."
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

## Transfer-candidate score (next 3 gameweeks)
Weighted sum, weights sum to 100:
- **Form: 40%**
- **Fixture difficulty (next 3 GWs): 35%**
- **Value: 25%**

`score = 0.40*formN + 0.35*fixtureN + 0.25*valueN`

For a replacement candidate, also require:
- Same position as the player being replaced (or a valid squad slot).
- Fits the remaining budget (price ≤ bank + price of the player being sold).
- Not already in the squad.

Rank the top 5 by `score`. Show, per candidate: form (raw + normalized), avg FDR next 3 (raw + normalized), value (raw + normalized), and the final weighted score. See the Double/Blank Gameweek correction below — it can override the fixture component's normalized value for the gameweek being planned for.

## Captain score (single next gameweek)
Same components, but **weighted toward the fixture(s) of the specific gameweek being planned for**:
- **Form: 45%**
- **Fixture difficulty (that gameweek): 40%** — use the actual fixture(s) *of that gameweek*, not "whichever real match comes next chronologically" (those can differ — see Double/Blank Gameweek correction below). Normalize with `(5 - FDR) / 4 * 100`.
- **Value: 15%**

`captainScore = 0.45*formN + 0.40*fixtureN + 0.15*valueN`

Only consider players in the **starting XI** for the upcoming gameweek. Show the same breakdown per candidate.

## Double/Blank Gameweek correction

A team can have 0 fixtures (Blank Gameweek) or 2+ fixtures (Double Gameweek) in a given gameweek. This must be read from the **actual fixtures of the gameweek being planned for**, not from "next 3/1 real matches chronologically" — that list skips a blank silently (jumping to a later gameweek's fixture and hiding that the player scores 0 in the one being planned for) and can't distinguish a double's two legs from two fixtures in different future gameweeks.

- **Blank Gameweek (0 fixtures that gameweek):** force the fixture component's normalized value to **0**, not the neutral-midpoint fallback below — this is a known guaranteed zero, not missing data. Applies to both transfer and captain scoring, and matters most for captain: armbanding a player with a blank wastes the whole pick (0 × 2 = 0).
- **Double Gameweek (2+ fixtures that gameweek):** add a flat bonus (`SCORING.dgwBonus`, +20) to the fixture component's normalized value (capped at 100) for both transfer and captain scoring — two scoring chances is real extra expected value a single-fixture-shaped average can't express. For captain specifically, use the **average** difficulty of both legs as the base FDR before adding the bonus.
- Always record which adjustment fired (`'blank'` / `'double'` / `null`) alongside the component's raw/normalized/weight/points breakdown, and surface it in the UI (a BLANK/DGW badge) — this is exactly the kind of invisible number shift the "never a black box" rule exists to prevent.

## Notes
- If a component is missing/null for a reason other than a confirmed blank (e.g. a player with literally no fixture data scheduled anywhere yet), treat its normalized value as the neutral midpoint (50) and note it in the breakdown. A confirmed Blank Gameweek is not this case — see above, it's forced to 0.
- Keep weights in one place (a config object) so they are easy to tune, and echo the weights used in the UI.

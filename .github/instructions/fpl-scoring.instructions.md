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

Rank the top 5 by `score`. Show, per candidate: form (raw + normalized), avg FDR next 3 (raw + normalized), value (raw + normalized), and the final weighted score.

## Captain score (single next gameweek)
Same components, but **weighted toward the single next fixture** and only over the upcoming gameweek:
- **Form: 45%**
- **Next fixture difficulty (single GW): 40%** (use that one fixture's FDR on the 1-5 scale, normalized with `(5 - FDR) / 4 * 100`, not a 3-GW average)
- **Value: 15%**

`captainScore = 0.45*formN + 0.40*nextFixtureN + 0.15*valueN`

Only consider players in the **starting XI** for the upcoming gameweek. Show the same breakdown per candidate.

## Notes
- If a component is missing/null (e.g. no upcoming fixture), treat its normalized value as the neutral midpoint (50) and note it in the breakdown.
- Keep weights in one place (a config object) so they are easy to tune, and echo the weights used in the UI.

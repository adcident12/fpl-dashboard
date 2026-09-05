---
description: "Build or extend the local FPL decision-support dashboard from the public FPL API — player table, fixture difficulty grid, my squad, and transfer/captain suggestions. Use when: building the FPL dashboard, adding the next dashboard phase, refreshing FPL data views, or planning FPL transfers and captain picks."
name: "FPL Dashboard"
argument-hint: "FPL team ID and phase (1-4), or 'continue'"
agent: "agent"
---

Build a **Fantasy Premier League (FPL) decision-support dashboard** — a local web app that pulls real FPL data and helps plan my squad, transfers, and captain pick. This only reads public data; there is no login and no team automation. I make the actual changes on the official FPL site myself.

## Arguments
- **FPL team ID** — the numeric ID from the URL when I view "Points" on the FPL site. Required for Phase 3 and 4.
- **Phase** — which phase to build now (1-4). If omitted, build **Phase 1** and stop. If I say "continue", build the next phase after the last completed one.

## Data source (official public FPL API — no auth)
- `https://fantasy.premierleague.com/api/bootstrap-static/` — all players, teams, current gameweek, prices, ownership %, form, total points, ICT index, expected goals/assists if present.
- `https://fantasy.premierleague.com/api/fixtures/` — full fixture list with each team's fixture difficulty rating (FDR).
- `https://fantasy.premierleague.com/api/element-summary/{player_id}/` — a single player's per-gameweek history and upcoming fixtures.
- `https://fantasy.premierleague.com/api/entry/{team_id}/event/{event_id}/picks/` — a specific team's picks for a gameweek.

**Cache responses locally** (a few minutes is fine) — do not hit the API on every page interaction.

## Field-mapping correctness (verify, don't guess)
The API has undocumented quirks. Before building any view, fetch a real response and confirm the exact field names and shapes. Known quirks to watch for:
- `element_type` is the position **ID** (1 = GK, 2 = DEF, 3 = MID, 4 = FWD), not a string.
- Record any other quirks you discover here as you go, so later phases don't re-learn them.

## Stack (decided)
- **Backend:** Node.js + Express. It fetches and caches the endpoints above and serves the frontend.
- **Frontend:** React + Vite.
- Keep it running locally; no deployment needed.

## Phases (build in order; stop and report after each)

### Phase 1 — data layer + player table
- Backend that fetches and caches the endpoints.
- A single page listing all players in a sortable, filterable table: name, team, position, price, form, total points, points per million (value), ownership %, and the difficulty of their next 3 fixtures.
- Filters: by position, by team, by max price, and a minimum-ownership / differential toggle.
- **Get this working end-to-end and show it to me before moving on.**

### Phase 2 — fixture difficulty view
- A grid: teams down the side, next 5 gameweeks across the top, each cell colored by fixture difficulty (easy / medium / hard) with the opponent name.
- This is the single most useful FPL planning view — get the color scale right so it is scannable at a glance.

### Phase 3 — my squad
- Input my FPL team ID once (store it locally, don't hardcode).
- Show my current 15 players with the same stats as Phase 1, split into starting XI / bench, plus my total remaining budget (bank).
- Highlight players on my team whose next fixture is hard, or whose form has dropped — these are transfer candidates.

### Phase 4 — transfer & captain suggestions
- Given my current squad and budget, suggest the top 5 replacement candidates for any one player I select, ranked by a simple score (recent form + fixture difficulty over the next 3 gameweeks + value). Show the score breakdown — don't output a black-box ranking.
- Suggest a captain pick from my starting XI for the upcoming gameweek using the same scoring idea, weighted more heavily toward the single next fixture.

## How to work
- Prioritize correctness of the FPL API field mappings over visual polish — double-check field names against a real API response rather than guessing.
- At the end of each phase, tell me clearly what's done and what to check before I ask you to continue to the next phase.

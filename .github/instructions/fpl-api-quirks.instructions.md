---
description: "Use when: reading or mapping FPL API data, building FPL dashboard views, computing player/team/fixture fields, or debugging FPL field names. Covers the verified field mappings and undocumented quirks of the public FPL API."
name: "FPL API Quirks"
applyTo: ["server/**", "client/**"]
---

# FPL API — verified field mappings & quirks

These mappings were verified against a **real** `bootstrap-static` / `fixtures` response (2026-09-05). Do not guess field names — check here first, and add any new quirk you discover to this file.

## Top-level shape of `bootstrap-static`
- Players are under **`elements`** (NOT `players`).
- `element_types` — position definitions (see below).
- `teams` — club definitions.
- `events` — gameweeks.
- `game_settings`, `game_config`, `phases`, `chips`, `total_players`, `element_stats` — other top-level keys.

## Player (`elements[]`)
| Meaning | Field | Notes |
|---|---|---|
| Position | `element_type` | **ID, not string**: 1=GK, 2=DEF, 3=MID, 4=FWD. Map via `element_types`. |
| Club | `team` | Team **ID** (map via `teams`). |
| Price | `now_cost` | In **hundreds of thousands** — `60` = £6.0m. Divide by 10 for £m. |
| Ownership % | `selected_by_percent` | **String**, e.g. `"38.5"`. |
| Form | `form` | **String**, e.g. `"4.0"` (last ~5 GWs). |
| Total points | `total_points` | Number. |
| Points/game | `points_per_game` | **String**. |
| Value (pts/million) | `value_season` | **String** — this is the "points per million" for the season. |
| Value (form) | `value_form` | **String**. |
| ICT index | `ict_index` | **String**. |
| xG / xA | `expected_goals`, `expected_assists` | **Strings**. |
| xG+xA per 90 | `expected_goal_involvements_per_90` | **String**. Verified 2026-09-05. Unreliable at low sample size — see "Chance of playing / availability" below for the same caveat pattern applied to `minutes`. |
| Minutes played | `minutes` | Number, season-to-date total (not per-game). |
| Transfers in/out | `transfers_in`, `transfers_out` | Numbers (all-time). |
| Status | `status` | `"a"` available, `"i"` injured, `"d"` doubt, `"s"` suspended, `"u"` unavailable. |
| News | `news` | Free text, may be `""`. |
| Name | `first_name`, `second_name`, `web_name` | Display name = `web_name` (fallback `first_name + " " + second_name`). |
| ID | `id` | Used in `element-summary/{id}` and picks. |

### Chance of playing / availability
- `chance_of_playing_this_round`, `chance_of_playing_next_round` — **nullable number**, 0/25/50/75/100. Verified 2026-09-05: `null` means **no fitness doubt at all** (equivalent to 100), not "unknown" — a player with `status: "a"` and no injury has both fields `null`. Do not use `||` to default a `null` here (`0` is a real, valid value meaning "definitely not playing"); use `??`.
- This app reads `chance_of_playing_this_round`, falling back to `chance_of_playing_next_round`, falling back to 100 — see `buildData()`'s `availabilityPct`.

### Set-piece order
- `penalties_order`, `direct_freekicks_order`, `corners_and_indirect_freekicks_order` — nullable number, `1` = the club's current first-choice taker for that set piece. Verified 2026-09-05 (e.g. Haaland: `penalties_order: 1`; also verified `direct_freekicks_order`/`corners_and_indirect_freekicks_order` have real data — e.g. Saka `freeKickOrder: 2`, Rice `freeKickOrder: 1`, Eze `freeKickOrder: 3`). All 3 are mapped in `buildData()` (`penaltyOrder`/`freeKickOrder`/`cornerOrder`) — informational only everywhere they're shown (the Suggestions penalty badge, the Set Pieces tab), never weighted into a score.

### Per-90 stats and small-sample distortion
`*_per_90` fields (e.g. `expected_goal_involvements_per_90`) are a straight extrapolation (`total / (minutes/90)`) and blow up at low minutes. Verified 2026-09-05: a player with 1 minute played and a 0.17 total xGI contribution showed `expected_goal_involvements_per_90: 15.3` — nonsensical next to a real elite striker's ~1.0-1.5. **Always gate any `*_per_90` field on a minimum-minutes threshold** before using it for comparison/normalization (this app uses `MIN_MINUTES_FOR_XGI = 180` in `server/fpl.js`, both for a player's own normalized value and for excluding them from setting the comparison pool's max).

## Positions (`element_types[]`)
- `id` (1-4), `singular_name` ("Goalkeeper"), `plural_name_short` ("GKP"/"DEF"/"MID"/"FWD").
- Squad rules: `squad_min_play` / `squad_max_play` (GK 1/1, DEF 3/5, MID 2/5, FWD 1/3).

## Teams (`teams[]`)
- `id`, `name`, `short_name` (e.g. "ARS"), `code`.
- Strength: `strength_overall_home`, `strength_overall_away`, `strength_attack_home/away`, `strength_defence_home/away`.

## Gameweeks (`events[]`)
- `id`, `name` ("Gameweek 3").
- Flags: `is_current`, `is_next`, `is_previous`, `finished`, `released`.
- `deadline_time` (ISO), `deadline_time_epoch`.

## Fixtures (`fixtures[]`)
- `event` — gameweek **ID** this fixture belongs to.
- `team_h`, `team_a` — home/away team **IDs**.
- **FDR is per-team, not a single field:** `team_h_difficulty` and `team_a_difficulty`. Values are a **1-5 scale (1=easiest, 5=hardest)** — in practice the data shows 2-5. There is NO single `difficulty` field.
- **Display bucketing** (for color scales): 1-2 = easy, 3 = medium, 4-5 = hard.
- `finished`, `started`, `kickoff_time` (ISO), `team_h_score`, `team_a_score`.

## Entry picks (`entry/{id}/event/{gw}/picks/`)
Verified against a real response (2026-09-05) — this shape does **not** match what an earlier version of this codebase assumed:
- Top level: `active_chip`, `automatic_subs`, `entry_history`, `picks`. There is **no top-level** `team_points`/`value`/`rank` — they live under **`entry_history`**: `entry_history.points` (this GW), `entry_history.value` (team value, hundreds of thousands), `entry_history.bank` (**leftover budget, hundreds of thousands — read this directly, do NOT derive it from a fixed total-budget constant**, since team value already reflects price rises/falls), `entry_history.rank`.
- Each `picks[]` entry has **only**: `element`, `position` (1-15 slot — **1-11 is the starting XI, 12-15 is the bench**; there is no `starting` boolean), `multiplier` (0 = benched, 1 = normal, 2 = captain, 3 = triple captain chip), `is_captain`, `is_vice_captain`, `element_type`. There is **no per-pick `points` field** — a player's live points for that gameweek must come from `event/{gw}/live/` (see below) and be joined by `element` id.

## Gameweek live points (`event/{gw}/live/`)
- `{ elements: [{ id, stats: { total_points, minutes, goals_scored, ... }, explain: [...] }] }` — `id` matches `elements[].id` / pick `element`. This is the only source for a player's points in a specific past/current gameweek (bootstrap-static only has season totals).
- `stats.bps` is the raw live Bonus Points System score (not yet converted to bonus); `stats.bonus` is bonus **already confirmed and awarded by FPL** (0 until a match is fully wrapped up — see the `finished`/`finished_provisional` note below). `stats.in_dreamteam` (boolean) is FPL's own official per-gameweek Team of the Week flag — no need to self-compute a best-XI optimization for that.
- `explain[]` is `[{ fixture: <fixture id>, stats: [{ identifier, points, value, points_modification }] }]` — this is where to look up which **fixture** a player's live stats belong to (needed to group BPS/bonus per-match rather than per-gameweek, since a player could in principle appear in 2 fixtures on a Double Gameweek). Note `bps` itself does **not** appear as an `explain` stat identifier (bonus/BPS isn't "explained" point-by-point the way goals/clean-sheets/etc. are) — read `stats.bps` directly, just use `explain[0].fixture` for the grouping key.
- **Bonus tie-break rule** (reproduced in `computeBonusPoints()` in `server/fpl.js`, verified against real GW data): rank players in a fixture by `bps` descending; group players tied on the exact same value; the whole group gets the points for the group's *starting* rank (`{1:3, 2:2, 3:1}`, else 0); the next distinct-value group's rank advances by the group's size, not by 1 — so 2 players tied for 1st both get 3 and the next distinct player gets 1 ("2nd place" is skipped entirely).
- **`finished` lags `finished_provisional`** (same quirk fixtures have generally — see `buildFixtureGrid()`'s `done` field): a fully-played match can sit at `finished: false` for up to ~1 hour after full time while FPL's bonus-confirmation process catches up, even though `finished_provisional: true` and the score are already posted, and `stats.bonus` may already hold the final confirmed value. Treat `finished || finished_provisional` as "match is over" when deciding whether bonus is authoritative.

## Chip windows (`bootstrap-static.chips[]`) and chip usage (`entry/{id}/history/`)
Verified against a real response (2026-09-05), 2026/27 season (8 chips, 2 sets of 4 — see the game guide):
- `bootstrap-static.chips[]` is the **authoritative source for chip windows** — 8 entries, one per chip instance, each `{ id, name, start_event, stop_event, chip_type }`. `name` is one of `wildcard`, `freehit`, `bboost`, `3xc` (triple captain) — each name appears twice, once per half (e.g. wildcard #1: `start_event:2, stop_event:19`; wildcard #2: `start_event:20, stop_event:38`). **Do not hardcode "GW19" as the season-half boundary** — read `stop_event`/`start_event` from here so it stays correct if FPL changes the split.
- `entry/{id}/history/` returns `{ current[], past[], chips[] }`. **`chips[]` is the user's actual chip-usage history** — `[{ name, event, time }]`, one entry per chip the user has already played. This means the app does **not** need the user to manually track which chips they've used (the roadmap doc originally assumed this would be necessary — it isn't): match a used chip to a window by `name` and `event` falling inside that window's `[start_event, stop_event]` range.
- `current[]` is per-gameweek history: `{ event, points, total_points, rank, overall_rank, bank, value, event_transfers, event_transfers_cost, points_on_bench }` — `bank`/`value` here are the same hundreds-of-thousands units as `entry_history` elsewhere.

## Derived values to compute (not in the API)
- **Price in £m** = `now_cost / 10`.
- **Points per million** = `value_season` (already provided) — or `total_points / (now_cost/10)`.
- **Next N fixtures for a player** = fixtures where `event >= current_event` and the player's `team` is `team_h` or `team_a`, ordered by `event`, take first N. Use that team's `team_h_difficulty`/`team_a_difficulty` for the FDR.
- **Differential** = `transfers_in - transfers_out` (positive = being bought).

## Caching
- Cache `bootstrap-static` and `fixtures` locally for a few minutes (e.g. 5 min TTL). Do not hit the API on every page interaction.
- `element-summary/{id}` and `entry/{team_id}/event/{event_id}/picks` can be cached per-key with the same TTL.

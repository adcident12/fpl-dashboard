# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local FPL (Fantasy Premier League) decision-support dashboard. It reads only the public, unauthenticated FPL API — there is no login and no team automation. The user makes actual squad changes on the official FPL site themselves; this app just helps them decide what to do (player stats, fixture difficulty, squad view, transfer/captain suggestions).

The full spec lives in [.github/prompts/fpl-dashboard.prompt.md](.github/prompts/fpl-dashboard.prompt.md), written as 4 build phases (player table → fixture grid → my squad → transfer/captain suggestions). All 4 phases are implemented.

## Commands

Run from the repo root (`package.json` orchestrates both workspaces):

- `npm run install:all` — install server and client dependencies (they are separate npm packages, not a workspace/monorepo).
- `npm run dev` — run server (port 3001) and client (Vite dev server, port 5173) concurrently, with hot reload.
- `npm run build` — build the client only (`client/dist`).
- `npm start` — start the server only; if `client/dist` exists, the server serves it directly (single-process production mode).

There is no test suite and no linter configured in this repo.

To run just one side: `npm --prefix server start` or `npm --prefix client run dev`.

**Split deployment (GitHub Pages + Render):** GitHub Pages only serves static files, so `client/` and `server/` deploy separately — see `.github/workflows/deploy-pages.yml` and `render.yaml`. This is a second deployment mode alongside the single-process one above, not a replacement: `client/vite.config.js`'s `base` only switches to `/fpl-dashboard/` when the workflow sets `GITHUB_PAGES=true`, and `client/src/api.js`'s `API` constant only points at a remote backend when `VITE_API_BASE` is set at build time — both default to the original root-relative behavior otherwise, so `npm run build && npm start` locally is unaffected. Full setup steps (Render's free-tier cold-start/cache caveats included) are in the project's Obsidian doc, not duplicated here.

## Architecture

**Two independent npm packages, no shared code:**
- `server/` — Node.js (ESM) + Express. Fetches FPL API data, transforms/joins it, and serves JSON at `/api/*`.
- `client/` — React + Vite. Fetches from `/api/*` (proxied to `localhost:3001` in dev via `vite.config.js`).

**Server data flow (`server/fpl.js`):**
1. `getBootstrap()` / `getFixtures()` / `getElementSummary()` / `getEntryPicks()` / `getEventLive()` — raw, disk-cached fetches from `https://fantasy.premierleague.com/api/*` (5 min TTL, see `server/cache.js`, backed by JSON files in `server/.cache/`).
2. `buildData()` — the core transform: joins `bootstrap-static` elements + teams + fixtures into a flat `players` array with computed fields (price in £m, parsed numeric strings, next-3-fixtures with FDR, differential). Nearly every other function builds on this. Its `meta` also carries `dataFetchedAt`/`dataTtlMs` (via `cache.js`'s `getCacheMeta()`, which reads a cache file's timestamp without affecting `getCached()`'s own fresh/stale logic) — the older of the `bootstrap`/`fixtures` cache timestamps, so the client can show a live "Updated Xm ago" indicator (`App.jsx`, header, ticks every 30s).
3. `buildFixtureGrid()` — teams × next-5-gameweeks matrix for the fixture difficulty view.
4. `buildSquad(teamId, eventId)` — joins a user's picks (`entry/{id}/event/{gw}/picks`, plus `event/{gw}/live/` for each pick's live points) against `buildData()`'s player list. Starting XI vs bench is derived from `pick.position <= 11` — the picks API has no `starting` boolean.
5. `buildTransferSuggestions()` / `buildCaptainSuggestions()` / `buildSquadScan()` — the scoring engine (see below), built on `getSquadContext()` which combines squad picks + bank (read directly from `entry_history.bank`, not derived) + the full player pool. `buildSquadScan()` runs the same per-player logic as `buildTransferSuggestions()` (factored into `scoreAffordableCandidates()`/`scoreTransferComponents()`) across all 11 starting players at once, comparing each to its top same-position replacement — one swap at a time, not a combined-budget multi-swap optimization.

Routes in `server/index.js` are thin wrappers around these functions; there's no separate route/controller/model layering.

**Client structure (`client/src`):** `App.jsx` owns the player table + tab navigation and fetches via `api.js`; `FixtureGrid.jsx`, `SquadView.jsx`, `SuggestionsView.jsx` are the other three tabs, each fetching its own data independently (no global state/store, except language — see below). `PitchView.jsx` is a shared formation-view component (GK/DEF/MID/FWD rows sized to the squad's actual formation, bench below, team-colored jersey chips — no image assets) used by both `SquadView` and `SuggestionsView`'s squad-scan section; given `buildSquadScan()`'s rows, it numbers starting players flagged `upgrade` by transfer-priority (biggest score gap first). Its `mode` prop (`'current'` default, or `'suggested'`) toggles between the real squad and a hypothetical one where every `upgrade`-flagged starter is swapped for its top scan candidate (dashed-outline chips) — `SuggestionsView` exposes this as a "current team / suggested team" toggle above the pitch. `FdrBadges.jsx` is the shared fixture-difficulty badge row (opponent + color-coded FDR, used by the Players table, My Squad, and every Suggestions candidate list) — every server-side suggestion object (transfer candidates, captain candidates, squad-scan `suggestion`) carries a `nextFixtures` array in the same shape as `buildData()`'s players specifically so this one component can render all of them.

**Localization (`i18n.jsx`):** EN/TH UI strings live in one `STRINGS` dictionary keyed by dotted names (e.g. `table.player`); `LangProvider` (wraps `<App>` in `main.jsx`) is the **one deliberate exception** to "no global state" — it's a React Context holding `{ lang, setLang, t }`, needed because the language toggle in `App.jsx`'s header must stay in sync across every tab, several levels deeper than prop-drilling would reach cleanly (`SuggestionsView` → `PitchView`/`FdrBadges`/`ScanRow`/`CandidateRow`). `useLang()` reads it; language persists to `localStorage` (`fpl-lang`, default `'en'`) the same way `useTeamId()` persists the team ID. **Only UI chrome is translated** — player/team/opponent names and other FPL API data are never translated, and technical fallback error strings in `api.js` (e.g. "Failed to load squad (500)") intentionally stay in English, matching how raw server error messages are already shown as pass-through text elsewhere. Adding a string: add both `en`/`th` entries to `STRINGS` in `i18n.jsx`, then reference via `t('your.key')` (or `t('your.key', { var })` for `{{var}}` interpolation).

**Styling — Tailwind CSS v4 + a slimmed-down `styles.css`, deliberately hybrid, not "all Tailwind":** `@tailwindcss/vite` is wired into `vite.config.js`; `styles.css` opens with `@import "tailwindcss";` then an `@theme` block mapping the app's design tokens (`--color-bg/panel/panel-2/text/muted/line/accent/accent-2/easy/med/hard`, `--radius-sm/md/lg`, `--font-display`/`--font-body`) into Tailwind's namespace, so `bg-panel`, `text-accent`, `rounded-md`, `font-display` etc. all resolve to *this app's* values, not Tailwind's defaults. `--transition: 150ms ease` stays a plain custom property (referenced by the hand-written CSS below; Tailwind has no matching utility). `--font-display` is Rajdhani, loaded via Google Fonts in `index.html`, used only for headings/tabs/section labels — data-dense tables stay on `--font-body` for legibility.

Most components (`App.jsx`, `TeamIdControls.jsx`, `SquadView.jsx`, `SuggestionsView.jsx`) are styled with Tailwind utility classes directly in JSX, including responsive variants (`max-sm:`, `max-[900px]:` — Tailwind's `sm` breakpoint is exactly 640px, which is why this app's two breakpoints line up with `sm`/a custom `900px` value). **What deliberately stays as hand-written CSS in `styles.css`, and why:**
- **Classes built from a runtime value** (`` `pos-${positionId}` ``, `` `fdr-${bucket}` ``, `` `badge verdict-${verdict}` ``, `` `jersey-chip${isSuggested ? ' suggested' : ''}` ``): Tailwind's compiler statically scans source files for complete class-name strings — it cannot see `pos-${positionId}` and so cannot generate CSS for it. These variant/color-coding families (`.pos-1..4`, `.fdr-easy/med/hard`, `.badge.verdict-*`, `.top-pick`, `.bench`) are small hand-written classes for exactly this reason, matched in JSX via the same template-literal pattern.
- **The responsive card-table technique** (`table.players` and its variants across Players/My Squad/Suggestions — see below): the `data-label` + `::before { content: attr(data-label) }` mechanism, `<thead>`-hiding, and the dynamic `.name:not([data-label])` title rule are structural CSS that doesn't map cleanly to inline utilities and is shared identically across four different tables.
- **`PitchView.jsx`'s jersey/pitch mechanics**: the jersey silhouette (`clip-path: polygon(...)`), the pitch gradient, and the badge-positioning fix (badges must be siblings of `.jersey`, not children, because `clip-path` clips descendants — see the comment in `PitchView.jsx`) are effect-heavy and already fragile (two real bugs were found and fixed here); left untouched to avoid regressions Claude can't visually verify (no browser available in this environment).
- **`FixtureGrid.jsx`** (the teams×gameweeks matrix) is exempt from the whole Tailwind pass for the same reason it's exempt from the card-table treatment (see Responsive below) — kept as-is.
- Team-color hashing (`teamColor()` in `PitchView.jsx`) sets an inline `style`, not a class, so it was never a Tailwind concern.

When adding new UI: reach for Tailwind utilities first; only add a hand-written class in `styles.css` if it needs a runtime-constructed class name, overrides native-control pseudo-elements (like the custom `<select>` arrow or the checkbox-as-toggle-switch — both still hand-written for exactly this reason), or is part of the card-table/jersey systems above.

**Responsive:** two breakpoints at the end of `styles.css`, `900px` (tightens spacing, shrinks `PitchView` jersey chips) and `640px` (stacks every control bar full-width, shrinks the pitch further, and turns every `table.players`-based table — Players/My Squad/Suggestions — into one card per row via a CSS-only technique: `<thead>` hidden, each `<td>` becomes a flex row labeled by its `data-label` attribute's `::before` content, and `td.name:not([data-label])` renders as the card's title instead of a labeled field). Every `<td>` that needs a mobile label carries `data-label={t('...')}` in the JSX — a `<td>` with no `data-label` and no `.name` class (e.g. `colspan` divider/breakdown rows) just renders as a plain block. **`table.fixture-grid` (FixtureGrid.jsx) is deliberately exempt** from the card treatment — it's a teams×gameweeks matrix, not a list of records, and stacking it would defeat comparing several gameweeks side by side; it only scrolls horizontally with tighter cell sizing at 640px.

## FPL API field quirks — read before touching data mapping

The public FPL API is undocumented and has non-obvious field names/shapes. **Full verified mapping: [.github/instructions/fpl-api-quirks.instructions.md](.github/instructions/fpl-api-quirks.instructions.md).** Do not guess field names — check that file first, and add any newly-discovered quirk to it. Key traps:

- Players are under `elements`, not `players`.
- `element_type` is a position **ID** (1=GK, 2=DEF, 3=MID, 4=FWD), not a string — map via `element_types`.
- `now_cost` is in tenths of £m (`60` = £6.0m).
- Many stats (`form`, `selected_by_percent`, `value_season`, `ict_index`, `expected_goals`, etc.) are **strings**, not numbers — must be parsed.
- FDR is per-team-per-fixture: `team_h_difficulty` / `team_a_difficulty` (1-5 scale, 1=easiest), not a single `difficulty` field.

## Scoring engine

Transfer and captain suggestions use one transparent, reproducible formula — **never a black-box ranking; always return the per-component breakdown** (raw value, normalized 0-100 value, weight, weighted points). Full spec: [.github/instructions/fpl-scoring.instructions.md](.github/instructions/fpl-scoring.instructions.md).

- All weights live in the single `SCORING` config object in [server/fpl.js](server/fpl.js) — tune there, not inline.
- Every component is normalized to 0-100 before weighting; a missing/null component falls back to the neutral midpoint (50), never to zero.
- FDR normalization is `(5 - avgFDR) / 4 * 100` (1=easiest→100, 5=hardest→0). Note the code comment in `fpl.js` explaining why this differs from the prompt file's original (buggy) `(6 - avgFDR)/4*100` formula — the `(5 - x)/4` form is the corrected, actually-0-100-bounded version.
- Transfer scoring weights next-3-gameweek average FDR; captain scoring weights the single next fixture's FDR and only considers the starting XI.

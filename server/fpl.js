import { getCached, getCacheMeta } from './cache.js';

const BASE = 'https://fantasy.premierleague.com/api';

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'fpl-dashboard/1.0' } });
  if (!res.ok) throw new Error(`FPL API responded ${res.status} for ${url}`);
  return res.json();
}

// --- Cached raw endpoints -------------------------------------------------
export function getBootstrap() {
  return getCached('bootstrap', () => fetchJson(`${BASE}/bootstrap-static/`));
}
export function getFixtures() {
  return getCached('fixtures', () => fetchJson(`${BASE}/fixtures/`));
}
export function getElementSummary(id) {
  return getCached(`element-summary-${id}`, () => fetchJson(`${BASE}/element-summary/${id}/`));
}
export function getEntryPicks(teamId, eventId) {
  return getCached(`entry-${teamId}-event-${eventId}`, () =>
    fetchJson(`${BASE}/entry/${teamId}/event/${eventId}/picks/`)
  );
}
export function getEventLive(eventId) {
  return getCached(`event-live-${eventId}`, () => fetchJson(`${BASE}/event/${eventId}/live/`));
}
export function getEntryHistory(teamId) {
  return getCached(`entry-history-${teamId}`, () => fetchJson(`${BASE}/entry/${teamId}/history/`));
}

// --- Transformations ------------------------------------------------------
const POSITION_MAP = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

/**
 * Build the combined, cleaned dataset used by the frontend:
 * players (with next-3 fixtures + FDR), teams, and meta (current gameweek).
 */
export async function buildData() {
  const [bootstrap, fixtures] = await Promise.all([getBootstrap(), getFixtures()]);

  const teams = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const currentEvent = bootstrap.events.find((e) => e.is_current);
  const currentEventId = currentEvent ? currentEvent.id : 1;

  // Upcoming fixtures per team (event >= current gameweek), chronological.
  const upcomingByTeam = new Map();
  const upcoming = fixtures
    .filter((f) => f.event >= currentEventId)
    .sort((a, b) => a.event - b.event || (a.kickoff_time < b.kickoff_time ? -1 : 1));

  for (const f of upcoming) {
    for (const side of ['h', 'a']) {
      const teamId = f[`team_${side}`];
      const oppId = f[`team_${side === 'h' ? 'a' : 'h'}`];
      const difficulty = f[`team_${side}_difficulty`];
      if (!upcomingByTeam.has(teamId)) upcomingByTeam.set(teamId, []);
      upcomingByTeam.get(teamId).push({
        event: f.event,
        opponentId: oppId,
        opponentShort: teams.get(oppId)?.short_name ?? '?',
        opponentName: teams.get(oppId)?.name ?? '?',
        home: side === 'h',
        difficulty,
      });
    }
  }

  const players = bootstrap.elements.map((el) => {
    const team = teams.get(el.team);
    const next = (upcomingByTeam.get(el.team) || []).slice(0, 3);
    const avgFDR = next.length
      ? next.reduce((s, x) => s + x.difficulty, 0) / next.length
      : null;
    return {
      id: el.id,
      name: el.web_name || `${el.first_name} ${el.second_name}`.trim(),
      firstName: el.first_name,
      secondName: el.second_name,
      teamId: el.team,
      teamShort: team?.short_name ?? '?',
      teamName: team?.name ?? '?',
      positionId: el.element_type,
      position: POSITION_MAP[el.element_type] ?? '?',
      price: el.now_cost / 10, // now_cost is in hundreds of thousands -> £m
      form: parseFloat(el.form),
      totalPoints: el.total_points,
      pointsPerGame: parseFloat(el.points_per_game),
      valueSeason: parseFloat(el.value_season), // points per million
      valueForm: parseFloat(el.value_form),
      ownership: parseFloat(el.selected_by_percent),
      ictIndex: parseFloat(el.ict_index),
      xG: parseFloat(el.expected_goals),
      xA: parseFloat(el.expected_assists),
      status: el.status,
      news: el.news,
      transfersIn: el.transfers_in,
      transfersOut: el.transfers_out,
      differential: el.transfers_in - el.transfers_out,
      nextFixtures: next,
      next3AvgFDR: avgFDR,
    };
  });

  const teamList = bootstrap.teams.map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.short_name,
  }));

  // Freshness = the older of the two caches feeding this dataset (players +
  // fixtures), since that's the one closer to expiring/going stale.
  const bootstrapFetchedAt = getCacheMeta('bootstrap')?.fetchedAt ?? null;
  const fixturesFetchedAt = getCacheMeta('fixtures')?.fetchedAt ?? null;
  const dataFetchedAt =
    bootstrapFetchedAt != null && fixturesFetchedAt != null
      ? Math.min(bootstrapFetchedAt, fixturesFetchedAt)
      : bootstrapFetchedAt ?? fixturesFetchedAt;

  const meta = {
    currentEventId,
    currentEventName: currentEvent?.name ?? null,
    nextEventId: bootstrap.events.find((e) => e.is_next)?.id ?? null,
    totalPlayers: bootstrap.total_players,
    positions: Object.entries(POSITION_MAP).map(([id, short]) => ({
      id: Number(id),
      short,
    })),
    dataFetchedAt,
    dataTtlMs: getCacheMeta('bootstrap')?.ttlMs ?? null,
  };

  return { players, teams: teamList, meta };
}

/**
 * Phase 2 — fixture difficulty grid.
 * Teams x next 5 gameweeks (current GW + next 4), each cell with opponent,
 * home/away, FDR (1-5), and score if the match is already done.
 *
 * Each cell is an ARRAY of fixtures, not a single fixture — a team can have
 * 0 fixtures in a gameweek (Blank Gameweek, postponements/cup clashes) or 2+
 * (Double Gameweek, a postponed match rescheduled into another gameweek).
 * An earlier version used `fixtures.find()` here, which silently dropped the
 * second match of a double gameweek — a real, high-stakes planning blind
 * spot (DGWs/BGWs swing scores more than almost anything else in FPL).
 * `doubles`/`blanks` summarize the visible window so the UI can surface a
 * banner without every consumer re-deriving it from the grid.
 */
export async function buildFixtureGrid() {
  const [bootstrap, fixtures] = await Promise.all([getBootstrap(), getFixtures()]);
  const teams = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const currentEvent = bootstrap.events.find((e) => e.is_current);
  const currentEventId = currentEvent ? currentEvent.id : 1;

  const gameweeks = [];
  for (let i = 0; i < 5; i++) {
    const ev = bootstrap.events.find((e) => e.id === currentEventId + i);
    gameweeks.push({ id: currentEventId + i, name: ev?.name ?? `Gameweek ${currentEventId + i}` });
  }

  const doubles = [];
  const blanks = [];

  const grid = bootstrap.teams.map((t) => {
    const rows = gameweeks.map((gw) => {
      const matches = fixtures.filter(
        (x) => x.event === gw.id && (x.team_h === t.id || x.team_a === t.id)
      );
      if (matches.length === 0) {
        blanks.push({ teamId: t.id, teamShort: t.short_name, event: gw.id });
      } else if (matches.length >= 2) {
        doubles.push({ teamId: t.id, teamShort: t.short_name, event: gw.id, count: matches.length });
      }
      return matches.map((f) => {
        const home = f.team_h === t.id;
        const oppId = home ? f.team_a : f.team_h;
        const opp = teams.get(oppId);
        return {
          event: gw.id,
          opponentId: oppId,
          opponentShort: opp?.short_name ?? '?',
          opponentName: opp?.name ?? '?',
          home,
          difficulty: home ? f.team_h_difficulty : f.team_a_difficulty,
          // Quirk: in-progress matches have finished=false but finished_provisional=true
          // with scores already present.
          done: f.finished || f.finished_provisional,
          scoreFor: home ? f.team_h_score : f.team_a_score,
          scoreAgainst: home ? f.team_a_score : f.team_h_score,
        };
      });
    });
    return { id: t.id, name: t.name, shortName: t.short_name, fixtures: rows };
  });

  return { gameweeks, teams: grid, currentEventId, doubles, blanks };
}

/**
 * Phase 3 — my squad.
 * Fetches the user's picks for a gameweek and joins each pick with the full
 * player dataset (name, team, price, form, total points, next fixtures) so the
 * frontend gets one clean payload.
 *
 * Picks shape (verified against a real `entry/{id}/event/{gw}/picks` response,
 * 2026-09-05): each pick has ONLY `element` (player id), `position` (1-15 slot —
 * **1-11 is the starting XI, 12-15 is the bench**, there is no `starting`
 * boolean), `multiplier` (0 = benched, 1 = normal, 2 = captain, 3 = triple
 * captain), `is_captain`, `is_vice_captain`, `element_type`. There is no
 * per-pick `points` field — that has to come from `event/{gw}/live/` instead.
 * Top level: `entry_history` (not top-level `team_points`/`value`/`rank`)
 * holds `points` (this GW), `value` (hundreds of thousands), `rank`.
 */
export async function buildSquad(teamId, eventId) {
  const data = await buildData();
  const ev = eventId ?? data.meta.currentEventId;
  const [picks, live] = await Promise.all([getEntryPicks(teamId, ev), getEventLive(ev)]);

  const byId = new Map(data.players.map((p) => [p.id, p]));
  const liveById = new Map((live.elements ?? []).map((e) => [e.id, e.stats]));

  const squad = (picks.picks ?? []).map((pk) => {
    const p = byId.get(pk.element) ?? {};
    return {
      id: pk.element,
      name: p.name ?? `Player ${pk.element}`,
      teamShort: p.teamShort ?? '?',
      teamName: p.teamName ?? '?',
      positionId: p.positionId ?? null,
      position: p.position ?? '?',
      price: p.price ?? 0,
      form: p.form ?? 0,
      totalPoints: p.totalPoints ?? 0,
      valueSeason: p.valueSeason ?? 0,
      ownership: p.ownership ?? 0,
      status: p.status ?? 'a',
      news: p.news ?? '',
      nextFixtures: p.nextFixtures ?? [],
      // This gameweek
      starting: pk.position <= 11,
      slot: pk.position ?? '?',
      points: liveById.get(pk.element)?.total_points ?? 0,
      multiplier: pk.multiplier ?? 1,
      isCaptain: !!pk.is_captain,
      isViceCaptain: !!pk.is_vice_captain,
    };
  });

  // Order: starting XI by position (GK, DEF, MID, FWD), then bench.
  const posOrder = { GK: 1, DEF: 2, MID: 3, FWD: 4 };
  squad.sort((a, b) => {
    if (a.starting !== b.starting) return a.starting ? -1 : 1;
    const pa = posOrder[a.position] ?? 9;
    const pb = posOrder[b.position] ?? 9;
    if (pa !== pb) return pa - pb;
    return b.points - a.points;
  });

  const value = picks.entry_history?.value != null ? picks.entry_history.value / 10 : null; // -> £m

  return {
    teamId,
    eventId: ev,
    eventName: data.meta.currentEventName,
    teamPoints: picks.entry_history?.points ?? null,
    value,
    rank: picks.entry_history?.rank ?? null,
    squad,
  };
}

// --- Phase 4 — scoring engine --------------------------------------------
// All weights live in ONE config object so the UI can echo them and they are
// easy to tune. Every component is normalized to a 0-100 scale before the
// weighted sum. A missing/null component falls back to a neutral midpoint.
export const SCORING = {
  transfer: { form: 0.4, fixture: 0.35, value: 0.25 },
  captain: { form: 0.45, fixture: 0.4, value: 0.15 },
};

const NEUTRAL = 50;

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

export function normForm(form) {
  if (form == null || Number.isNaN(form)) return NEUTRAL;
  return Math.min(100, (form / 10) * 100);
}
export function normValue(valueSeason, maxValueSeason) {
  if (valueSeason == null || Number.isNaN(valueSeason) || !maxValueSeason) return NEUTRAL;
  return (valueSeason / maxValueSeason) * 100;
}
// Next-3 average FDR: avgFDR=1 -> 100, avgFDR=5 -> 0.
// NOTE: the spec's written formula "(6 - avgFDR)/4*100" yields 25-125, which
// breaks the 0-100 normalization and contradicts the spec's own endpoints
// (avgFDR=1 -> 100, avgFDR=5 -> 0). The correct mapping is (5 - avgFDR)/4*100.
export function normFixture3(avgFDR) {
  if (avgFDR == null || Number.isNaN(avgFDR)) return NEUTRAL;
  return ((5 - avgFDR) / 4) * 100;
}
// Single next-fixture FDR: FDR=1 -> 100, FDR=5 -> 0. Same correction as above.
export function normFixture1(fdr) {
  if (fdr == null || Number.isNaN(fdr)) return NEUTRAL;
  return ((5 - fdr) / 4) * 100;
}

/**
 * Shared context for squad-dependent suggestions: the full player dataset,
 * the user's picks, the set of squad player ids, and the current bank.
 * `entry_history.bank` is the FPL API's own leftover-budget figure (hundreds
 * of thousands) — it already accounts for price rises/falls, so it must be
 * read directly rather than derived from a fixed total budget.
 */
async function getSquadContext(teamId, eventId) {
  const data = await buildData();
  const ev = eventId ?? data.meta.currentEventId;
  const picks = await getEntryPicks(teamId, ev);
  const byId = new Map(data.players.map((p) => [p.id, p]));
  const squadIds = new Set((picks.picks ?? []).map((pk) => pk.element));
  const bank = (picks.entry_history?.bank ?? 0) / 10; // -> £m
  return { data, ev, picks, byId, squadIds, bank };
}

// Score a single player with the transfer weights (form + next-3-GW fixture +
// value), against a given max-value basis for normalization. Shared by
// buildTransferSuggestions (score each candidate) and buildSquadScan (also
// scores the current incumbent, on the same basis, so they're comparable).
function scoreTransferComponents(p, maxValue) {
  const w = SCORING.transfer;
  const formN = normForm(p.form);
  const fixtureN = normFixture3(p.next3AvgFDR);
  const valueN = normValue(p.valueSeason, maxValue);
  const score = w.form * formN + w.fixture * fixtureN + w.value * valueN;
  return {
    score: round1(score),
    breakdown: {
      form: { raw: p.form, normalized: round1(formN), weight: w.form, points: round1(w.form * formN) },
      fixture: { raw: p.next3AvgFDR, normalized: round1(fixtureN), weight: w.fixture, points: round1(w.fixture * fixtureN) },
      value: { raw: p.valueSeason, normalized: round1(valueN), weight: w.value, points: round1(w.value * valueN) },
    },
  };
}

// Same-position, not-already-in-squad, affordable (price <= bank + price of
// the player being sold) candidates for `incumbent`, scored and sorted best
// first. `maxValue` (for value normalization) is the max among same-position
// candidates, so it's returned alongside for scoring the incumbent on the
// same basis.
function scoreAffordableCandidates(incumbent, ctx) {
  const candidates = ctx.data.players.filter(
    (p) => p.positionId === incumbent.positionId && !ctx.squadIds.has(p.id)
  );
  const maxValue = candidates.length ? Math.max(...candidates.map((p) => p.valueSeason)) : 0;
  const affordable = candidates.filter((p) => p.price <= ctx.bank + incumbent.price);

  const scored = affordable.map((p) => {
    const { score, breakdown } = scoreTransferComponents(p, maxValue);
    return {
      id: p.id,
      name: p.name,
      teamShort: p.teamShort,
      position: p.position,
      positionId: p.positionId,
      price: p.price,
      form: p.form,
      avgFDR: p.next3AvgFDR,
      nextFixtures: p.nextFixtures,
      valueSeason: p.valueSeason,
      status: p.status,
      news: p.news,
      score,
      breakdown,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return { scored, maxValue };
}

/**
 * Phase 4 — transfer suggestions.
 * Given the player being sold, find same-position candidates that are not
 * already in the squad and fit the budget (price <= bank + price of the
 * player being sold). Score each with the transfer weights over the next 3
 * gameweeks and return the top 5 with a full per-component breakdown.
 */
export async function buildTransferSuggestions(teamId, replaceId, eventId) {
  const ctx = await getSquadContext(teamId, eventId);
  const replaced = ctx.byId.get(replaceId);
  if (!replaced) throw new Error(`Player ${replaceId} not found`);
  if (!ctx.squadIds.has(replaceId)) {
    throw new Error(`Player ${replaceId} is not in the squad`);
  }

  const { scored } = scoreAffordableCandidates(replaced, ctx);

  return {
    teamId,
    eventId: ctx.ev,
    bank: round2(ctx.bank),
    replaced: {
      id: replaced.id,
      name: replaced.name,
      position: replaced.position,
      price: replaced.price,
    },
    weights: SCORING.transfer,
    candidates: scored.slice(0, 5),
  };
}

/**
 * Quick squad scan — no need to pick a player first. Compares every starting
 * XI player against the best same-position, budget-affordable alternative
 * (same logic as buildTransferSuggestions, run once per starting player), so
 * the whole XI can be reviewed in one pass. Each comparison assumes only that
 * one swap happens (uses the current bank), not all 11 swaps at once.
 */
export async function buildSquadScan(teamId, eventId) {
  const ctx = await getSquadContext(teamId, eventId);
  const starting = (ctx.picks.picks ?? [])
    .filter((pk) => pk.position <= 11)
    .map((pk) => ctx.byId.get(pk.element))
    .filter(Boolean);

  const rows = starting.map((current) => {
    const { scored, maxValue } = scoreAffordableCandidates(current, ctx);
    const currentScored = scoreTransferComponents(current, maxValue);
    const best = scored[0] ?? null;

    return {
      current: {
        id: current.id,
        name: current.name,
        teamShort: current.teamShort,
        position: current.position,
        price: current.price,
        score: currentScored.score,
        breakdown: currentScored.breakdown,
      },
      suggestion: best,
      verdict: !best ? 'no-option' : best.score > currentScored.score ? 'upgrade' : 'keep',
    };
  });

  return {
    teamId,
    eventId: ctx.ev,
    bank: round2(ctx.bank),
    weights: SCORING.transfer,
    rows,
  };
}

/**
 * Phase 4 — captain suggestions.
 * Only the starting XI are considered. Each is scored with the captain
 * weights using the SINGLE next fixture's FDR (not the 3-GW average).
 * Returns the full ranked list with a per-component breakdown.
 */
export async function buildCaptainSuggestions(teamId, eventId) {
  const ctx = await getSquadContext(teamId, eventId);
  const w = SCORING.captain;
  const starting = (ctx.picks.picks ?? [])
    .filter((pk) => pk.position <= 11)
    .map((pk) => ctx.byId.get(pk.element))
    .filter(Boolean);
  const maxValue = Math.max(...ctx.data.players.map((p) => p.valueSeason));

  const scored = starting.map((p) => {
    const next = p.nextFixtures?.[0] ?? null;
    const nextFDR = next?.difficulty ?? null;
    const formN = normForm(p.form);
    const fixtureN = normFixture1(nextFDR);
    const valueN = normValue(p.valueSeason, maxValue);
    const score = w.form * formN + w.fixture * fixtureN + w.value * valueN;
    return {
      id: p.id,
      name: p.name,
      teamShort: p.teamShort,
      position: p.position,
      price: p.price,
      form: p.form,
      formN: round1(formN),
      nextFDR,
      nextOpponent: next?.opponentShort ?? null,
      nextHome: next?.home ?? null,
      nextFixtures: next ? [next] : [],
      fixtureN: round1(fixtureN),
      valueSeason: p.valueSeason,
      valueN: round1(valueN),
      score: round1(score),
      breakdown: {
        form: { raw: p.form, normalized: round1(formN), weight: w.form, points: round1(w.form * formN) },
        fixture: { raw: nextFDR, normalized: round1(fixtureN), weight: w.fixture, points: round1(w.fixture * fixtureN) },
        value: { raw: p.valueSeason, normalized: round1(valueN), weight: w.value, points: round1(w.value * valueN) },
      },
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return {
    teamId,
    eventId: ctx.ev,
    weights: w,
    candidates: scored,
  };
}

// How close to a chip window's deadline counts as "use it or lose it".
const CHIP_EXPIRY_WARNING_GWS = 3;
const CHIP_LABEL = { wildcard: 'Wildcard', freehit: 'Free Hit', bboost: 'Bench Boost', '3xc': 'Triple Captain' };

/**
 * Phase 5 — chip planning helper.
 * `bootstrap.chips[]` is the authoritative window for each of the 8 chip
 * instances (2 per type, one per season half — see the API quirks doc, do
 * not hardcode GW19). `entry/{id}/history/`'s own `chips[]` is the user's
 * actual usage, so — unlike originally assumed when this was scoped — no
 * manual "which chips have I used" input is needed from the user at all.
 */
export async function buildChipPlan(teamId, eventId) {
  const [bootstrap, ctx, history, fixtureGrid] = await Promise.all([
    getBootstrap(),
    getSquadContext(teamId, eventId),
    getEntryHistory(teamId),
    buildFixtureGrid(),
  ]);
  const currentEventId = ctx.ev;
  const usedChips = history.chips ?? [];

  const windows = bootstrap.chips.map((c) => {
    const used = usedChips.find(
      (u) => u.name === c.name && u.event >= c.start_event && u.event <= c.stop_event
    );
    const isCurrentWindow = currentEventId >= c.start_event && currentEventId <= c.stop_event;
    const availableNow = isCurrentWindow && !used;
    const eventsRemaining = isCurrentWindow ? c.stop_event - currentEventId : null;
    const expiringSoon = availableNow && eventsRemaining <= CHIP_EXPIRY_WARNING_GWS;
    // One label the client can switch on directly, instead of re-deriving
    // it from the boolean/numeric fields (which stay too, for the detail view).
    const status = used
      ? 'used'
      : expiringSoon
        ? 'expiringSoon'
        : availableNow
          ? 'available'
          : currentEventId < c.start_event
            ? 'upcoming'
            : 'expired';
    return {
      name: c.name,
      label: CHIP_LABEL[c.name] ?? c.name,
      startEvent: c.start_event,
      stopEvent: c.stop_event,
      used: used ? { event: used.event, time: used.time } : null,
      availableNow,
      eventsRemaining,
      expiringSoon,
      status,
    };
  });

  const availableByName = new Map(windows.filter((w) => w.availableNow).map((w) => [w.name, w]));
  const recommendations = [];

  // Bench Boost: worth it when all 4 bench players have an easy-ish next
  // fixture and are actually expected to play (status 'a' = available).
  if (availableByName.has('bboost')) {
    const bench = (ctx.picks.picks ?? [])
      .filter((pk) => pk.position >= 12)
      .map((pk) => ctx.byId.get(pk.element))
      .filter(Boolean);
    if (bench.length === 4) {
      const fdrs = bench.map((p) => p.nextFixtures?.[0]?.difficulty ?? 5);
      const allFit = bench.every((p) => p.status === 'a') && fdrs.every((d) => d <= 3);
      if (allFit) {
        recommendations.push({
          chip: 'bboost',
          label: CHIP_LABEL.bboost,
          reason: 'benchAllFit',
          detail: { avgFDR: round1(fdrs.reduce((s, d) => s + d, 0) / fdrs.length) },
        });
      }
    }
  }

  // Triple Captain: worth it when the squad's best-scoring starter (by the
  // existing captain formula) also has a particularly easy next fixture.
  if (availableByName.has('3xc')) {
    const captainPlan = await buildCaptainSuggestions(teamId, eventId);
    const top = captainPlan.candidates[0];
    if (top && top.nextFDR != null && top.nextFDR <= 2) {
      recommendations.push({
        chip: '3xc',
        label: CHIP_LABEL['3xc'],
        reason: 'topCaptainEasyFixture',
        detail: { player: top.name, teamShort: top.teamShort, nextFDR: top.nextFDR, nextOpponent: top.nextOpponent },
      });
    }
  }

  // Free Hit: worth it when several of the user's own 15 squad members have
  // a blank in the very next gameweek (their whole team has no fixture).
  if (availableByName.has('freehit')) {
    const squadTeamIds = new Set([...ctx.squadIds].map((id) => ctx.byId.get(id)?.teamId).filter(Boolean));
    const nextEventId = fixtureGrid.gameweeks[0]?.id ?? currentEventId;
    const blankTeams = fixtureGrid.blanks.filter((b) => b.event === nextEventId && squadTeamIds.has(b.teamId));
    if (blankTeams.length >= 2) {
      recommendations.push({
        chip: 'freehit',
        label: CHIP_LABEL.freehit,
        reason: 'squadBlankGameweek',
        detail: { event: nextEventId, teams: blankTeams.map((b) => b.teamShort) },
      });
    }
  }

  // Wildcard: worth it when a large chunk of the starting XI is flagged as
  // an upgrade candidate by the squad scan — i.e. the squad broadly needs
  // rebuilding, not just a one-off swap.
  if (availableByName.has('wildcard')) {
    const scan = await buildSquadScan(teamId, eventId);
    const upgrades = scan.rows.filter((r) => r.verdict === 'upgrade');
    if (upgrades.length >= 4) {
      recommendations.push({
        chip: 'wildcard',
        label: CHIP_LABEL.wildcard,
        reason: 'squadNeedsRebuild',
        detail: { upgradeCount: upgrades.length, totalStarting: scan.rows.length },
      });
    }
  }

  return {
    teamId,
    eventId: currentEventId,
    windows,
    recommendations,
  };
}

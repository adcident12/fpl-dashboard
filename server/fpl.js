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
// `ttlMs` lets a caller ask for fresher data than the app-wide 5 minute
// default without affecting other callers of the same cache key — the
// freshness check happens per read against the file's own timestamp, not a
// TTL stored with the file (see cache.js), so buildSquad() (default TTL) and
// buildBonusPredictor() (a short TTL, since live match BPS changes minute to
// minute) can safely disagree about how stale is "stale" for the same data.
export function getEventLive(eventId, ttlMs) {
  return getCached(`event-live-${eventId}`, () => fetchJson(`${BASE}/event/${eventId}/live/`), ttlMs);
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
      form: Number.parseFloat(el.form),
      totalPoints: el.total_points,
      pointsPerGame: Number.parseFloat(el.points_per_game),
      valueSeason: Number.parseFloat(el.value_season), // points per million
      valueForm: Number.parseFloat(el.value_form),
      ownership: Number.parseFloat(el.selected_by_percent),
      ictIndex: Number.parseFloat(el.ict_index),
      xG: Number.parseFloat(el.expected_goals),
      xA: Number.parseFloat(el.expected_assists),
      // xG+xA per 90 minutes — a forward-looking "should be scoring/assisting
      // this much" signal, distinct from `form` (backward-looking actual
      // points, which mixes in finishing luck). 0 is a real value for a
      // defensive player, not missing data.
      xgi90: Number.parseFloat(el.expected_goal_involvements_per_90),
      minutes: el.minutes,
      // Chance of playing the gameweek about to be planned for, 0-100. FPL
      // returns `null` for both this-round/next-round fields when there's no
      // fitness doubt at all, which we read as 100 (fully expected to play) —
      // NOT as missing data, so `??` (not `||`) matters here since 0 is a
      // real, valid value (definitely not playing).
      availabilityPct: el.chance_of_playing_this_round ?? el.chance_of_playing_next_round ?? 100,
      // 1 = the club's first-choice penalty taker; null = not on the list at
      // all. Shown as a badge only, never weighted into the score — how many
      // penalties a team wins is too unpredictable to model as a formula input.
      penaltyOrder: el.penalties_order,
      // Same "1 = first choice, null = not on the list" shape as penaltyOrder,
      // for the other two set-piece types — fan feature only (Set Pieces tab),
      // not weighted into scoring for the same reason penalties aren't.
      freeKickOrder: el.direct_freekicks_order,
      cornerOrder: el.corners_and_indirect_freekicks_order,
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

  // The gameweek a user still needs to act before — found directly by
  // deadline time rather than relying on `is_next` (which can be a step
  // behind right around a deadline), so this stays correct if the game
  // is between "is_current"/"is_next" transitioning.
  const now = Date.now();
  const upcomingDeadlineEvent = bootstrap.events.find(
    (e) => new Date(e.deadline_time).getTime() > now
  );

  const meta = {
    currentEventId,
    currentEventName: currentEvent?.name ?? null,
    nextEventId: bootstrap.events.find((e) => e.is_next)?.id ?? null,
    nextDeadline: upcomingDeadlineEvent
      ? {
          eventId: upcomingDeadlineEvent.id,
          eventName: upcomingDeadlineEvent.name,
          deadlineTime: upcomingDeadlineEvent.deadline_time,
          deadlineEpochMs: new Date(upcomingDeadlineEvent.deadline_time).getTime(),
        }
      : null,
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
  const [data, bootstrap] = await Promise.all([buildData(), getBootstrap()]);
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
    // Was `data.meta.currentEventName` — always the live gameweek's name
    // regardless of which `ev` was actually requested/used. Only matters
    // when `eventId` is passed explicitly (no current UI does; the eventId
    // param exists in api.js/every route for a future gameweek picker), but
    // wrong is wrong: look up the name for the gameweek actually fetched.
    eventName: bootstrap.events.find((e) => e.id === ev)?.name ?? `Gameweek ${ev}`,
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
  // `underlying` (xG+xA per 90) is a 4th weighted component, not blended
  // into `form` — form is backward-looking actual points (mixes in finishing
  // luck), underlying is forward-looking "should be scoring this much".
  // Kept separate so the breakdown shows both honestly instead of one
  // number silently averaging two different signals.
  transfer: { form: 0.3, fixture: 0.3, value: 0.2, underlying: 0.2 },
  captain: { form: 0.35, fixture: 0.35, value: 0.1, underlying: 0.2 },
  // Flat bonus added to the normalized fixture score when a player's team
  // has 2 fixtures in the gameweek being planned for (a Double Gameweek) —
  // two scoring chances is a real edge a single-fixture FDR average can't
  // express. A confirmed Blank Gameweek (0 fixtures that gameweek) instead
  // forces the fixture component to 0, not the neutral midpoint, because a
  // blank is a guaranteed zero, not missing data — see `eventFixturesFor()`.
  dgwBonus: 20,
};

const NEUTRAL = 50;
// Below this many minutes played, `xgi90` (a per-90 extrapolation) is
// statistically meaningless — e.g. 1 minute with a 0.17 xGI contribution
// extrapolates to 15.3 per 90, dwarfing every real striker in the league.
// Below the threshold, both the player's own underlying score AND their
// eligibility to set the pool's max (see scoreAffordableCandidates /
// buildCaptainSuggestions) are excluded — a single low-minutes outlier
// would otherwise compress everyone else's normalized score toward zero.
const MIN_MINUTES_FOR_XGI = 180;

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
// xG+xA per 90, scaled against the highest value in the comparison pool
// (same-position candidates for transfers, the whole player pool for
// captain — matching how normValue's maxValueSeason is scoped in each
// caller). 0 is a real value (e.g. most defenders/GKs), not missing data —
// only a genuinely unparseable value falls back to the neutral midpoint.
export function normUnderlying(xgi90, maxXgi90, minutes) {
  if (xgi90 == null || Number.isNaN(xgi90) || !maxXgi90) return NEUTRAL;
  if (minutes == null || minutes < MIN_MINUTES_FOR_XGI) return NEUTRAL;
  return (xgi90 / maxXgi90) * 100;
}
// Availability is applied as a MULTIPLIER on the final weighted score, not
// as a 5th weighted-and-normalized component — it answers a different
// question ("how likely are they to deliver that score at all") than the
// other components ("how good is this player if they play"), so a 25%
// chance of playing quarters the whole score instead of being diluted into
// one nudge among several. `null` (no fitness doubt) means the multiplier
// is 1 (no reduction), matching buildData()'s availabilityPct default of 100.
export function availabilityMultiplier(availabilityPct) {
  if (availabilityPct == null || Number.isNaN(availabilityPct)) return 1;
  return Math.max(0, Math.min(100, availabilityPct)) / 100;
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
  const [picks, bootstrap, fixtures] = await Promise.all([
    getEntryPicks(teamId, ev),
    getBootstrap(),
    getFixtures(),
  ]);
  const byId = new Map(data.players.map((p) => [p.id, p]));
  const squadIds = new Set((picks.picks ?? []).map((pk) => pk.element));
  const bank = (picks.entry_history?.bank ?? 0) / 10; // -> £m

  // Fixtures for the EXACT gameweek `ev` is being planned for — distinct
  // from buildData()'s `nextFixtures` (next 3 real matches chronologically,
  // which silently skips a Blank Gameweek and can't tell a Double
  // Gameweek's two legs apart from two fixtures in different future
  // gameweeks). A team missing from this map has 0 fixtures this gameweek
  // (blank); 2 entries means a double. See scoreTransferComponents() /
  // buildCaptainSuggestions() for how this corrects their scoring.
  const teamsById = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const eventFixturesByTeam = new Map();
  for (const f of fixtures) {
    if (f.event !== ev) continue;
    for (const side of ['h', 'a']) {
      const tId = f[`team_${side}`];
      const oppId = f[`team_${side === 'h' ? 'a' : 'h'}`];
      if (!eventFixturesByTeam.has(tId)) eventFixturesByTeam.set(tId, []);
      eventFixturesByTeam.get(tId).push({
        event: ev,
        opponentId: oppId,
        opponentShort: teamsById.get(oppId)?.short_name ?? '?',
        opponentName: teamsById.get(oppId)?.name ?? '?',
        home: side === 'h',
        difficulty: f[`team_${side}_difficulty`],
      });
    }
  }

  return { data, ev, picks, byId, squadIds, bank, eventFixturesByTeam };
}

// A team's actual fixtures for the gameweek `ctx` was built for. Empty
// array = Blank Gameweek, 2 entries = Double Gameweek.
function eventFixturesFor(ctx, teamId) {
  return ctx.eventFixturesByTeam.get(teamId) ?? [];
}

// Score a single player with the transfer weights (form + next-3-GW fixture +
// value + underlying), against given max-value/max-xgi bases for
// normalization. Shared by buildTransferSuggestions (score each candidate)
// and buildSquadScan (also scores the current incumbent, on the same basis,
// so they're comparable).
// `eventFixtureCount` (0/1/2+, from eventFixturesFor() for the gameweek being
// planned for) corrects a blind spot the next-3-average alone can't see: it
// can't distinguish "next 3 real matches, immediate week included" from
// "next 3 real matches, but the immediate week is actually a blank" — a
// count of 0 forces the fixture component to 0 (guaranteed zero that week,
// not the neutral-midpoint fallback used for genuinely missing data), and a
// count of 2+ (a double) adds SCORING.dgwBonus for the extra scoring chance.
// The final weighted score is then scaled by availabilityMultiplier() — a
// doubtful/injured player's score drops in proportion to their chance of
// playing at all, on top of (not instead of) the 4 weighted components.
function scoreTransferComponents(p, maxValue, maxXgi90, eventFixtureCount) {
  const w = SCORING.transfer;
  const formN = normForm(p.form);
  let fixtureN = normFixture3(p.next3AvgFDR);
  let fixtureNote = null;
  if (eventFixtureCount === 0) {
    fixtureN = 0;
    fixtureNote = 'blank';
  } else if (eventFixtureCount >= 2) {
    fixtureN = Math.min(100, fixtureN + SCORING.dgwBonus);
    fixtureNote = 'double';
  }
  const valueN = normValue(p.valueSeason, maxValue);
  const underlyingN = normUnderlying(p.xgi90, maxXgi90, p.minutes);
  const rawScore = w.form * formN + w.fixture * fixtureN + w.value * valueN + w.underlying * underlyingN;
  const availMult = availabilityMultiplier(p.availabilityPct);
  const score = rawScore * availMult;
  return {
    score: round1(score),
    // The 4 weighted components sum to `preAvailabilityScore`, not `score` —
    // the availability multiplier is applied after, so the client can show
    // both ("82.4 → 20.6 at 25% chance of playing") instead of a component
    // breakdown that mysteriously doesn't add up to the final number.
    preAvailabilityScore: round1(rawScore),
    breakdown: {
      form: { raw: p.form, normalized: round1(formN), weight: w.form, points: round1(w.form * formN) },
      fixture: { raw: p.next3AvgFDR, normalized: round1(fixtureN), weight: w.fixture, points: round1(w.fixture * fixtureN), note: fixtureNote },
      value: { raw: p.valueSeason, normalized: round1(valueN), weight: w.value, points: round1(w.value * valueN) },
      underlying: { raw: p.xgi90, normalized: round1(underlyingN), weight: w.underlying, points: round1(w.underlying * underlyingN) },
      availability: { pct: p.availabilityPct, multiplier: round2(availMult) },
    },
  };
}

// Same-position, not-already-in-squad, affordable (price <= bank + price of
// the player being sold) candidates for `incumbent`, scored and sorted best
// first. `maxValue`/`maxXgi90` (for value/underlying normalization) are the
// max among same-position candidates, so both are returned alongside for
// scoring the incumbent on the same basis.
function scoreAffordableCandidates(incumbent, ctx) {
  const candidates = ctx.data.players.filter(
    (p) => p.positionId === incumbent.positionId && !ctx.squadIds.has(p.id)
  );
  const maxValue = candidates.length ? Math.max(...candidates.map((p) => p.valueSeason)) : 0;
  const reliableXgi = candidates.filter((p) => p.minutes >= MIN_MINUTES_FOR_XGI);
  const maxXgi90 = reliableXgi.length ? Math.max(...reliableXgi.map((p) => p.xgi90)) : 0;
  const affordable = candidates.filter((p) => p.price <= ctx.bank + incumbent.price);

  const scored = affordable.map((p) => {
    const eventFixtureCount = eventFixturesFor(ctx, p.teamId).length;
    const { score, preAvailabilityScore, breakdown } = scoreTransferComponents(p, maxValue, maxXgi90, eventFixtureCount);
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
      xgi90: p.xgi90,
      availabilityPct: p.availabilityPct,
      penaltyOrder: p.penaltyOrder,
      status: p.status,
      news: p.news,
      eventFixtureCount,
      blankEvent: eventFixtureCount === 0,
      dgwEvent: eventFixtureCount >= 2,
      score,
      preAvailabilityScore,
      breakdown,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return { scored, maxValue, maxXgi90 };
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
  const replacedEventFixtureCount = eventFixturesFor(ctx, replaced.teamId).length;

  return {
    teamId,
    eventId: ctx.ev,
    bank: round2(ctx.bank),
    replaced: {
      id: replaced.id,
      name: replaced.name,
      position: replaced.position,
      price: replaced.price,
      availabilityPct: replaced.availabilityPct,
      penaltyOrder: replaced.penaltyOrder,
      blankEvent: replacedEventFixtureCount === 0,
      dgwEvent: replacedEventFixtureCount >= 2,
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
    const { scored, maxValue, maxXgi90 } = scoreAffordableCandidates(current, ctx);
    const currentEventFixtureCount = eventFixturesFor(ctx, current.teamId).length;
    const currentScored = scoreTransferComponents(current, maxValue, maxXgi90, currentEventFixtureCount);
    const best = scored[0] ?? null;

    return {
      current: {
        id: current.id,
        name: current.name,
        teamShort: current.teamShort,
        position: current.position,
        price: current.price,
        availabilityPct: current.availabilityPct,
        penaltyOrder: current.penaltyOrder,
        eventFixtureCount: currentEventFixtureCount,
        blankEvent: currentEventFixtureCount === 0,
        dgwEvent: currentEventFixtureCount >= 2,
        score: currentScored.score,
        preAvailabilityScore: currentScored.preAvailabilityScore,
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
 * weights over the ACTUAL fixture(s) of the gameweek being planned for
 * (`eventFixturesFor()`), not just "whichever real match comes next
 * chronologically" — the latter silently skips a Blank Gameweek (picking up
 * a fixture from a later gameweek and hiding that the captain would score a
 * guaranteed 0 armbanding this player) and can't credit a Double Gameweek's
 * two scoring chances. A blank forces the fixture component to 0; a double
 * scores the average difficulty of both legs plus SCORING.dgwBonus.
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
  const reliableXgi = ctx.data.players.filter((p) => p.minutes >= MIN_MINUTES_FOR_XGI);
  const maxXgi90 = reliableXgi.length ? Math.max(...reliableXgi.map((p) => p.xgi90)) : 0;

  const scored = starting.map((p) => {
    const eventFixtures = eventFixturesFor(ctx, p.teamId);
    const eventFixtureCount = eventFixtures.length;
    const avgDifficulty = eventFixtureCount
      ? eventFixtures.reduce((s, f) => s + f.difficulty, 0) / eventFixtureCount
      : null;

    const formN = normForm(p.form);
    let fixtureN;
    let fixtureNote = null;
    if (eventFixtureCount === 0) {
      fixtureN = 0;
      fixtureNote = 'blank';
    } else {
      fixtureN = normFixture1(avgDifficulty);
      if (eventFixtureCount >= 2) {
        fixtureN = Math.min(100, fixtureN + SCORING.dgwBonus);
        fixtureNote = 'double';
      }
    }
    const valueN = normValue(p.valueSeason, maxValue);
    const underlyingN = normUnderlying(p.xgi90, maxXgi90, p.minutes);
    const rawScore = w.form * formN + w.fixture * fixtureN + w.value * valueN + w.underlying * underlyingN;
    const availMult = availabilityMultiplier(p.availabilityPct);
    const score = rawScore * availMult;
    return {
      id: p.id,
      name: p.name,
      teamShort: p.teamShort,
      position: p.position,
      price: p.price,
      form: p.form,
      formN: round1(formN),
      availabilityPct: p.availabilityPct,
      penaltyOrder: p.penaltyOrder,
      eventFixtureCount,
      blankEvent: eventFixtureCount === 0,
      dgwEvent: eventFixtureCount >= 2,
      nextFDR: avgDifficulty,
      nextOpponent: eventFixtures.map((f) => f.opponentShort).join(' & ') || null,
      nextHome: eventFixtures[0]?.home ?? null,
      nextFixtures: eventFixtures,
      fixtureN: round1(fixtureN),
      valueSeason: p.valueSeason,
      valueN: round1(valueN),
      score: round1(score),
      preAvailabilityScore: round1(rawScore),
      breakdown: {
        form: { raw: p.form, normalized: round1(formN), weight: w.form, points: round1(w.form * formN) },
        fixture: { raw: avgDifficulty, normalized: round1(fixtureN), weight: w.fixture, points: round1(w.fixture * fixtureN), note: fixtureNote },
        value: { raw: p.valueSeason, normalized: round1(valueN), weight: w.value, points: round1(w.value * valueN) },
        underlying: { raw: p.xgi90, normalized: round1(underlyingN), weight: w.underlying, points: round1(w.underlying * underlyingN) },
        availability: { pct: p.availabilityPct, multiplier: round2(availMult) },
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

// One label the client can switch on directly, instead of re-deriving it
// from the boolean/numeric fields on a chip window (which stay too, for the
// detail view).
function chipWindowStatus({ used, expiringSoon, availableNow, currentEventId, startEvent }) {
  if (used) return 'used';
  if (expiringSoon) return 'expiringSoon';
  if (availableNow) return 'available';
  if (currentEventId < startEvent) return 'upcoming';
  return 'expired';
}

// Bench Boost: worth it when all 4 bench players have an easy-ish next
// fixture and are actually expected to play (status 'a' = available).
function benchBoostRecommendation(ctx) {
  const bench = (ctx.picks.picks ?? [])
    .filter((pk) => pk.position >= 12)
    .map((pk) => ctx.byId.get(pk.element))
    .filter(Boolean);
  if (bench.length !== 4) return null;
  const fdrs = bench.map((p) => p.nextFixtures?.[0]?.difficulty ?? 5);
  const allFit = bench.every((p) => p.status === 'a') && fdrs.every((d) => d <= 3);
  if (!allFit) return null;
  return {
    chip: 'bboost',
    label: CHIP_LABEL.bboost,
    reason: 'benchAllFit',
    detail: { avgFDR: round1(fdrs.reduce((s, d) => s + d, 0) / fdrs.length) },
  };
}

// Triple Captain: worth it when the squad's best-scoring starter (by the
// existing captain formula) also has a particularly easy fixture this gameweek.
async function tripleCaptainRecommendation(teamId, eventId) {
  const captainPlan = await buildCaptainSuggestions(teamId, eventId);
  const top = captainPlan.candidates[0];
  if (top?.nextFDR == null || top.nextFDR > 2) return null;
  return {
    chip: '3xc',
    label: CHIP_LABEL['3xc'],
    reason: 'topCaptainEasyFixture',
    detail: { player: top.name, teamShort: top.teamShort, nextFDR: top.nextFDR, nextOpponent: top.nextOpponent },
  };
}

// Free Hit: worth it when several of the user's own 15 squad members have a
// blank in the very next gameweek (their whole team has no fixture).
function freeHitRecommendation(ctx, fixtureGrid, currentEventId) {
  const squadTeamIds = new Set([...ctx.squadIds].map((id) => ctx.byId.get(id)?.teamId).filter(Boolean));
  const nextEventId = fixtureGrid.gameweeks[0]?.id ?? currentEventId;
  const blankTeams = fixtureGrid.blanks.filter((b) => b.event === nextEventId && squadTeamIds.has(b.teamId));
  if (blankTeams.length < 2) return null;
  return {
    chip: 'freehit',
    label: CHIP_LABEL.freehit,
    reason: 'squadBlankGameweek',
    detail: { event: nextEventId, teams: blankTeams.map((b) => b.teamShort) },
  };
}

// Wildcard: worth it when a large chunk of the starting XI is flagged as an
// upgrade candidate by the squad scan — i.e. the squad broadly needs
// rebuilding, not just a one-off swap.
async function wildcardRecommendation(teamId, eventId) {
  const scan = await buildSquadScan(teamId, eventId);
  const upgrades = scan.rows.filter((r) => r.verdict === 'upgrade');
  if (upgrades.length < 4) return null;
  return {
    chip: 'wildcard',
    label: CHIP_LABEL.wildcard,
    reason: 'squadNeedsRebuild',
    detail: { upgradeCount: upgrades.length, totalStarting: scan.rows.length },
  };
}

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
    const status = chipWindowStatus({ used, expiringSoon, availableNow, currentEventId, startEvent: c.start_event });
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

  if (availableByName.has('bboost')) {
    const rec = benchBoostRecommendation(ctx);
    if (rec) recommendations.push(rec);
  }
  if (availableByName.has('3xc')) {
    const rec = await tripleCaptainRecommendation(teamId, eventId);
    if (rec) recommendations.push(rec);
  }
  if (availableByName.has('freehit')) {
    const rec = freeHitRecommendation(ctx, fixtureGrid, currentEventId);
    if (rec) recommendations.push(rec);
  }
  if (availableByName.has('wildcard')) {
    const rec = await wildcardRecommendation(teamId, eventId);
    if (rec) recommendations.push(rec);
  }

  return {
    teamId,
    eventId: currentEventId,
    windows,
    recommendations,
  };
}

// --- Live Bonus Point Predictor -------------------------------------------
// Live data during a match changes minute to minute — much faster than the
// app-wide 5 minute default cache TTL is meant for. This is the one endpoint
// that deliberately asks for fresher data.
const LIVE_BONUS_TTL_MS = 60 * 1000;

// FPL's actual bonus tie-break rule: rank all players in a fixture by BPS
// descending, group players tied on the exact same BPS value, and award the
// GROUP's *starting* rank's points to every member of that group — the next
// distinct-value group then starts counting from rank+groupSize, not
// rank+1, so a skipped placement (e.g. 2 players tied for 1st leaves no
// "2nd place") is reproduced correctly. Verified against FPL's documented
// examples: 2 tied for 1st both get 3 (next distinct player gets 1, "2nd"
// is skipped); 3 tied for 1st all get 3 and nobody else scores bonus.
const BONUS_BY_RANK = { 1: 3, 2: 2, 3: 1 };

export function computeBonusPoints(players) {
  const sorted = [...players].sort((a, b) => b.bps - a.bps);
  const result = [];
  let rank = 1;
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].bps === sorted[i].bps) j++;
    const groupSize = j - i;
    // A 0 (or negative) BPS never earns bonus even if it happens to be the
    // top of the list — this only matters in the first few live minutes of a
    // match, before anyone has accrued any BPS at all.
    const points = sorted[i].bps > 0 ? BONUS_BY_RANK[rank] ?? 0 : 0;
    for (let k = i; k < j; k++) result.push({ ...sorted[k], predictedBonus: points });
    rank += groupSize;
    i = j;
  }
  return result;
}

/**
 * Fan feature — live bonus point predictor. FPL only confirms bonus points
 * once a match is fully finished; this projects them live from each player's
 * current BPS so fans can see who's "in the bonus" during play.
 * Grouped by FIXTURE, not by gameweek as a whole — bonus is awarded
 * per-match, so a player's BPS is never compared against players from a
 * different match. Only fixtures that have kicked off (`started`) are
 * included; a fixture that hasn't started yet has nothing meaningful to show.
 * Each player's fixture is read from `explain[0].fixture` (live stats are
 * fixture-scoped there) rather than assumed from the team's single fixture
 * that event, so this still behaves sensibly if a player's `explain` is
 * empty (not yet involved) — such players are simply left out.
 */
export async function buildBonusPredictor(eventId) {
  const [bootstrap, fixtures] = await Promise.all([getBootstrap(), getFixtures()]);
  const currentEvent = bootstrap.events.find((e) => e.is_current);
  const ev = eventId ?? currentEvent?.id ?? 1;
  const live = await getEventLive(ev, LIVE_BONUS_TTL_MS);

  const teams = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const elementsById = new Map(bootstrap.elements.map((el) => [el.id, el]));
  const eventFixtures = fixtures.filter((f) => f.event === ev && f.started);
  const fixturesById = new Map(eventFixtures.map((f) => [f.id, f]));

  const byFixture = new Map();
  for (const e of live.elements ?? []) {
    const fixtureId = e.explain?.[0]?.fixture;
    const fixture = fixturesById.get(fixtureId);
    if (!fixture) continue; // not started yet, or not involved in a started fixture
    const el = elementsById.get(e.id);
    if (!el || e.stats.minutes <= 0) continue;
    if (!byFixture.has(fixtureId)) byFixture.set(fixtureId, []);
    byFixture.get(fixtureId).push({
      id: e.id,
      name: el.web_name,
      teamShort: teams.get(el.team)?.short_name ?? '?',
      positionId: el.element_type,
      position: POSITION_MAP[el.element_type] ?? '?',
      bps: e.stats.bps,
      confirmedBonus: e.stats.bonus,
    });
  }

  const fixturesOut = eventFixtures.map((f) => {
    const homeTeam = teams.get(f.team_h);
    const awayTeam = teams.get(f.team_a);
    const players = computeBonusPoints(byFixture.get(f.id) ?? []).sort(
      (a, b) => b.bps - a.bps
    );
    return {
      fixtureId: f.id,
      homeTeamShort: homeTeam?.short_name ?? '?',
      awayTeamShort: awayTeam?.short_name ?? '?',
      homeScore: f.team_h_score,
      awayScore: f.team_a_score,
      // Quirk (same as buildFixtureGrid()'s `done`): a match can sit at
      // finished=false / finished_provisional=true — full time has been
      // played and bonus is already locked in, but FPL hasn't flipped the
      // official "finished" flag yet (that lags by up to ~1h). Treating
      // only `finished` as "match over" would show a stale LIVE tag on a
      // match whose bonus has already been confirmed.
      finished: f.finished || f.finished_provisional,
      minutes: f.minutes ?? null,
      // Once finished, FPL's own confirmedBonus is authoritative — the
      // predicted value can differ from it in rare cases (e.g. a red-card
      // point deduction happening after BPS is locked in), so the client can
      // tell "still live projection" from "match over, this is official".
      players,
    };
  });

  return { eventId: ev, fixtures: fixturesOut };
}

/**
 * Fan feature — Dream Team of the Gameweek. FPL computes its own official
 * Team of the Week and exposes it directly as `stats.in_dreamteam` on
 * `event/{gw}/live/`'s elements — no need to self-compute a best-XI
 * combinatorial optimization (formation constraints, budget, etc.) the way
 * the transfer/captain scoring engine does; this is simply a filter + join.
 * Always exactly 11 players (verified against real gameweek data). Reuses
 * `PitchView.jsx` client-side by shaping each player like a squad pick
 * (`starting: true`, a 1-11 `slot`) even though there's no bench concept here.
 */
export async function buildDreamTeam(eventId) {
  const bootstrap = await getBootstrap();
  const currentEvent = bootstrap.events.find((e) => e.is_current);
  const ev = eventId ?? currentEvent?.id ?? 1;
  const live = await getEventLive(ev);

  const teams = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const elementsById = new Map(bootstrap.elements.map((el) => [el.id, el]));

  const dreamTeam = (live.elements ?? [])
    .filter((e) => e.stats.in_dreamteam)
    .map((e) => {
      const el = elementsById.get(e.id);
      const team = el ? teams.get(el.team) : null;
      return {
        id: e.id,
        name: el?.web_name ?? `Player ${e.id}`,
        teamShort: team?.short_name ?? '?',
        positionId: el?.element_type ?? null,
        position: POSITION_MAP[el?.element_type] ?? '?',
        price: el ? el.now_cost / 10 : 0,
        status: el?.status ?? 'a',
        news: el?.news ?? '',
        points: e.stats.total_points,
      };
    })
    .sort((a, b) => (a.positionId ?? 9) - (b.positionId ?? 9))
    .map((p, i) => ({ ...p, starting: true, slot: i + 1, isCaptain: false, isViceCaptain: false }));

  const totalPoints = dreamTeam.reduce((s, p) => s + p.points, 0);

  return { eventId: ev, totalPoints, dreamTeam };
}

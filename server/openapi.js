// Hand-written OpenAPI 3.0 document, not generated from JSDoc comments on the
// routes (swagger-jsdoc) — this API's response shapes are deeply nested and
// quirky (see .github/instructions/fpl-api-quirks.instructions.md), and a
// spec meant to feed an OpenAPI→MCP bridge needs to actually match reality,
// not drift silently the way inline JSDoc blocks can. When a route in
// index.js changes shape, update the matching schema here in the same
// commit — same discipline as the API quirks doc.
//
// Descriptions are written for a dual audience: a human reading Swagger UI,
// and an LLM using this as an MCP tool catalog (many OpenAPI→MCP bridges use
// `operationId` as the tool name and `summary`/`description` as the tool
// description) — so they say what each endpoint is FOR, not just what it returns.

const errorResponse = {
  type: 'object',
  properties: { error: { type: 'string', description: 'Human-readable error message, often the FPL API\'s own error text.' } },
};

const nextFixture = {
  type: 'object',
  properties: {
    event: { type: 'integer', description: 'Gameweek ID.' },
    opponentId: { type: 'integer' },
    opponentShort: { type: 'string', example: 'ARS' },
    opponentName: { type: 'string', example: 'Arsenal' },
    home: { type: 'boolean' },
    difficulty: { type: 'integer', minimum: 1, maximum: 5, description: 'FDR: 1 = easiest, 5 = hardest.' },
  },
};

const player = {
  type: 'object',
  description: 'One player, joined from bootstrap-static + fixtures. The core shape nearly every other endpoint builds on.',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string', description: 'Display name (web_name, falls back to first+last).' },
    firstName: { type: 'string' },
    secondName: { type: 'string' },
    teamId: { type: 'integer' },
    teamShort: { type: 'string', example: 'LIV' },
    teamName: { type: 'string', example: 'Liverpool' },
    positionId: { type: 'integer', enum: [1, 2, 3, 4], description: '1=GK, 2=DEF, 3=MID, 4=FWD.' },
    position: { type: 'string', enum: ['GK', 'DEF', 'MID', 'FWD'] },
    price: { type: 'number', format: 'float', description: 'In £m.' },
    form: { type: 'number', format: 'float' },
    totalPoints: { type: 'integer' },
    pointsPerGame: { type: 'number', format: 'float' },
    valueSeason: { type: 'number', format: 'float', description: 'Points per million (season).' },
    valueForm: { type: 'number', format: 'float' },
    ownership: { type: 'number', format: 'float', description: 'Selected-by percentage.' },
    ictIndex: { type: 'number', format: 'float' },
    xG: { type: 'number', format: 'float' },
    xA: { type: 'number', format: 'float' },
    xgi90: { type: 'number', format: 'float', description: 'xG+xA per 90 minutes. Unreliable (small-sample) below ~180 minutes played — see the scoring engine\'s MIN_MINUTES_FOR_XGI.' },
    minutes: { type: 'integer', description: 'Season-to-date total minutes played.' },
    availabilityPct: { type: 'integer', minimum: 0, maximum: 100, description: 'Chance of playing the next relevant gameweek. 100 = no fitness doubt.' },
    penaltyOrder: { type: 'integer', nullable: true, description: '1 = club\'s first-choice penalty taker; null = not on the list.' },
    freeKickOrder: { type: 'integer', nullable: true, description: '1 = club\'s first-choice direct free-kick taker; null = not on the list.' },
    cornerOrder: { type: 'integer', nullable: true, description: '1 = club\'s first-choice corner/indirect free-kick taker; null = not on the list.' },
    status: { type: 'string', enum: ['a', 'd', 'i', 's', 'u'], description: 'a=available, d=doubt, i=injured, s=suspended, u=unavailable.' },
    news: { type: 'string' },
    transfersIn: { type: 'integer' },
    transfersOut: { type: 'integer' },
    differential: { type: 'integer', description: 'transfersIn - transfersOut.' },
    nextFixtures: { type: 'array', items: nextFixture, description: 'Next 3 real fixtures, chronological (can skip a Blank Gameweek).' },
    next3AvgFDR: { type: 'number', format: 'float', nullable: true },
  },
};

const team = {
  type: 'object',
  properties: { id: { type: 'integer' }, name: { type: 'string' }, shortName: { type: 'string' } },
};

const nextDeadline = {
  type: 'object',
  nullable: true,
  description: 'The next gameweek deadline that hasn\'t passed yet, found by scanning deadline times directly.',
  properties: {
    eventId: { type: 'integer' },
    eventName: { type: 'string', example: 'Gameweek 4' },
    deadlineTime: { type: 'string', format: 'date-time' },
    deadlineEpochMs: { type: 'integer' },
  },
};

const meta = {
  type: 'object',
  properties: {
    currentEventId: { type: 'integer' },
    currentEventName: { type: 'string', nullable: true },
    nextEventId: { type: 'integer', nullable: true },
    nextDeadline,
    totalPlayers: { type: 'integer' },
    positions: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, short: { type: 'string' } } } },
    dataFetchedAt: { type: 'integer', nullable: true, description: 'ms epoch. Older of the bootstrap/fixtures cache timestamps.' },
    dataTtlMs: { type: 'integer', nullable: true },
  },
};

const scoreComponent = {
  type: 'object',
  description: 'One weighted scoring component: raw value, normalized to 0-100, its weight, and the resulting weighted points.',
  properties: {
    raw: { type: 'number', nullable: true },
    normalized: { type: 'number' },
    weight: { type: 'number' },
    points: { type: 'number' },
    note: { type: 'string', nullable: true, enum: ['blank', 'double', null], description: 'Only on the fixture component: set when a Blank/Double Gameweek overrode the normal FDR-based value.' },
  },
};

const availabilityInfo = {
  type: 'object',
  properties: {
    pct: { type: 'integer', nullable: true },
    multiplier: { type: 'number', description: 'pct/100, clamped 0-1. Applied to the 4-component weighted sum to get the final score.' },
  },
};

const scoreBreakdown = {
  type: 'object',
  description: 'Never a black-box score — every component that produced it, always returned alongside the final number.',
  properties: {
    form: scoreComponent,
    fixture: scoreComponent,
    value: scoreComponent,
    underlying: scoreComponent,
    availability: availabilityInfo,
  },
};

const eventFlags = {
  eventFixtureCount: { type: 'integer', description: '0 = Blank Gameweek, 1 = normal, 2+ = Double Gameweek, for the specific gameweek being planned for.' },
  blankEvent: { type: 'boolean' },
  dgwEvent: { type: 'boolean' },
};

const transferCandidate = {
  type: 'object',
  properties: {
    id: { type: 'integer' }, name: { type: 'string' }, teamShort: { type: 'string' },
    position: { type: 'string' }, positionId: { type: 'integer' }, price: { type: 'number' },
    form: { type: 'number' }, avgFDR: { type: 'number', nullable: true },
    nextFixtures: { type: 'array', items: nextFixture },
    valueSeason: { type: 'number' }, status: { type: 'string' }, news: { type: 'string' },
    ...eventFlags,
    score: { type: 'number', description: 'Final score, after the availability multiplier.' },
    preAvailabilityScore: { type: 'number', description: 'The 4 weighted components summed, before the availability multiplier — sums to this, not to `score`.' },
    breakdown: scoreBreakdown,
  },
};

const captainCandidate = {
  type: 'object',
  properties: {
    id: { type: 'integer' }, name: { type: 'string' }, teamShort: { type: 'string' },
    position: { type: 'string' }, price: { type: 'number' }, form: { type: 'number' },
    formN: { type: 'number' },
    availabilityPct: { type: 'integer', nullable: true }, penaltyOrder: { type: 'integer', nullable: true },
    ...eventFlags,
    nextFDR: { type: 'number', nullable: true, description: 'Average difficulty of the actual fixture(s) of the gameweek being planned for (not "next fixture chronologically").' },
    nextOpponent: { type: 'string', nullable: true, description: 'Both opponents joined with " & " on a Double Gameweek.' },
    nextHome: { type: 'boolean', nullable: true },
    nextFixtures: { type: 'array', items: nextFixture },
    fixtureN: { type: 'number' }, valueSeason: { type: 'number' }, valueN: { type: 'number' },
    score: { type: 'number' }, preAvailabilityScore: { type: 'number' },
    breakdown: scoreBreakdown,
  },
};

const chipWindow = {
  type: 'object',
  properties: {
    name: { type: 'string', enum: ['wildcard', 'freehit', 'bboost', '3xc'] },
    label: { type: 'string', example: 'Wildcard' },
    startEvent: { type: 'integer' }, stopEvent: { type: 'integer' },
    used: { type: 'object', nullable: true, properties: { event: { type: 'integer' }, time: { type: 'string' } } },
    availableNow: { type: 'boolean' },
    eventsRemaining: { type: 'integer', nullable: true },
    expiringSoon: { type: 'boolean' },
    status: { type: 'string', enum: ['used', 'available', 'expiringSoon', 'upcoming', 'expired'] },
  },
};

const bonusPlayer = {
  type: 'object',
  properties: {
    id: { type: 'integer' }, name: { type: 'string' }, teamShort: { type: 'string' },
    positionId: { type: 'integer' }, position: { type: 'string' },
    bps: { type: 'integer', description: 'Live Bonus Points System score, from event/{gw}/live/.' },
    confirmedBonus: { type: 'integer', description: 'FPL\'s own already-awarded bonus (0 until the match is finished and bonus is locked in).' },
    predictedBonus: { type: 'integer', enum: [0, 1, 2, 3], description: 'Projected bonus (3/2/1) from the current BPS standings, using FPL\'s own tie-break rule (tied players share the higher rank\'s points; the next distinct group skips the taken ranks).' },
  },
};

const bonusFixture = {
  type: 'object',
  properties: {
    fixtureId: { type: 'integer' },
    homeTeamShort: { type: 'string' }, awayTeamShort: { type: 'string' },
    homeScore: { type: 'integer', nullable: true }, awayScore: { type: 'integer', nullable: true },
    finished: { type: 'boolean', description: 'Once true, `confirmedBonus` on each player is authoritative — predictedBonus may occasionally still differ in rare edge cases.' },
    minutes: { type: 'integer', nullable: true },
    players: { type: 'array', items: bonusPlayer, description: 'Sorted by BPS descending. Only players with minutes > 0 in this fixture are included.' },
  },
};

const dreamTeamPlayer = {
  type: 'object',
  properties: {
    id: { type: 'integer' }, name: { type: 'string' }, teamShort: { type: 'string' },
    positionId: { type: 'integer' }, position: { type: 'string' }, price: { type: 'number' },
    status: { type: 'string' }, news: { type: 'string' },
    points: { type: 'integer', description: 'Points scored this gameweek.' },
    starting: { type: 'boolean', description: 'Always true — Dream Team has no bench concept, this field only exists so the shape matches /squad for reuse with PitchView.' },
    slot: { type: 'integer', description: '1-11, GK/DEF/MID/FWD order.' },
    isCaptain: { type: 'boolean', description: 'Always false — Dream Team has no captain concept.' },
    isViceCaptain: { type: 'boolean' },
  },
};

const errorResponses = {
  400: { description: 'Missing a required query parameter.', content: { 'application/json': { schema: errorResponse } } },
  404: { description: 'The team/gameweek doesn\'t exist in FPL (e.g. a gameweek before the team was created).', content: { 'application/json': { schema: errorResponse } } },
  502: { description: 'The public FPL API itself failed/timed out — not a bug in this app.', content: { 'application/json': { schema: errorResponse } } },
};

const teamIdParam = { name: 'teamId', in: 'query', required: true, schema: { type: 'integer' }, description: 'FPL entry (team) ID — the number in fantasy.premierleague.com/entry/<TEAM_ID>/.' };
const eventIdParam = { name: 'eventId', in: 'query', required: false, schema: { type: 'integer' }, description: 'Gameweek ID. Defaults to the current gameweek.' };

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'FPL Dashboard API',
    version: '1.0.0',
    description:
      'Read-only decision-support API over the public, unauthenticated Fantasy Premier League API. ' +
      'No login, no writes back to FPL — every endpoint reads and transforms public FPL data (player stats, ' +
      'fixtures, a team\'s squad, and transparent transfer/captain/chip suggestions with full scoring breakdowns, never a black-box ranking). ' +
      'CORS is open on every route (no auth, no writes — see server/index.js).',
    license: { name: 'N/A — personal project' },
  },
  servers: [
    { url: '/api', description: 'Same-origin (dev, or single-process production serving client/dist).' },
    { url: 'https://fpl-dashboard-api.onrender.com/api', description: 'Split-deployment production backend.' },
  ],
  tags: [
    { name: 'Players & fixtures', description: 'Raw/joined FPL data — no team ID needed.' },
    { name: 'Squad', description: 'A specific FPL team\'s picks.' },
    { name: 'Suggestions', description: 'The transparent scoring engine — transfer, captain, and whole-squad-scan suggestions.' },
    { name: 'Chips', description: 'Wildcard/Free Hit/Bench Boost/Triple Captain window tracking and recommendations.' },
    { name: 'Live', description: 'In-play data that changes faster than the app-wide 5 minute cache — fetched with a shorter TTL.' },
  ],
  paths: {
    '/health': {
      get: {
        operationId: 'getHealth', tags: ['Players & fixtures'],
        summary: 'Liveness check', description: 'Confirms the server process is up. No FPL API call involved.',
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } } } },
      },
    },
    '/players': {
      get: {
        operationId: 'getPlayers', tags: ['Players & fixtures'],
        summary: 'All players with computed stats and next-3-fixture FDR',
        description: 'The core dataset (buildData()) nearly every other endpoint is built from — price in £m, parsed numeric fields, next-3-fixtures with difficulty, differential.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { players: { type: 'array', items: player }, teams: { type: 'array', items: team }, meta } } } } },
          502: errorResponses[502],
        },
      },
    },
    '/teams': {
      get: {
        operationId: 'getTeams', tags: ['Players & fixtures'],
        summary: 'All 20 Premier League teams',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { teams: { type: 'array', items: team }, meta } } } } },
          502: errorResponses[502],
        },
      },
    },
    '/meta': {
      get: {
        operationId: 'getMeta', tags: ['Players & fixtures'],
        summary: 'Current gameweek, positions, data freshness, and next deadline',
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: meta } } }, 502: errorResponses[502] },
      },
    },
    '/fixtures': {
      get: {
        operationId: 'getFixturesRaw', tags: ['Players & fixtures'],
        summary: 'Raw fixtures for the whole season, straight from the FPL API',
        description: 'Unprocessed — use /fixture-grid for the teams×gameweeks matrix with FDR colors and Double/Blank Gameweek detection instead, unless you specifically need the raw shape.',
        responses: { 200: { description: 'OK (array of raw FPL fixture objects)', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } }, 502: errorResponses[502] },
      },
    },
    '/fixture-grid': {
      get: {
        operationId: 'getFixtureGrid', tags: ['Players & fixtures'],
        summary: 'Teams × next-5-gameweeks fixture difficulty matrix, with Double/Blank Gameweek detection',
        description:
          'Each team\'s per-gameweek cell is an ARRAY of fixtures, not a single fixture — 0 entries means a Blank Gameweek ' +
          '(no fixture that gameweek), 2+ means a Double Gameweek (two fixtures). `doubles`/`blanks` summarize the same window separately.',
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    gameweeks: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } } },
                    teams: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' }, name: { type: 'string' }, shortName: { type: 'string' },
                          fixtures: {
                            type: 'array',
                            description: 'One entry per gameweek in `gameweeks`; each entry is an array of 0+ fixture objects.',
                            items: { type: 'array', items: { type: 'object', properties: { event: { type: 'integer' }, opponentId: { type: 'integer' }, opponentShort: { type: 'string' }, opponentName: { type: 'string' }, home: { type: 'boolean' }, difficulty: { type: 'integer' }, done: { type: 'boolean' }, scoreFor: { type: 'integer', nullable: true }, scoreAgainst: { type: 'integer', nullable: true } } } },
                          },
                        },
                      },
                    },
                    currentEventId: { type: 'integer' },
                    doubles: { type: 'array', items: { type: 'object', properties: { teamId: { type: 'integer' }, teamShort: { type: 'string' }, event: { type: 'integer' }, count: { type: 'integer' } } } },
                    blanks: { type: 'array', items: { type: 'object', properties: { teamId: { type: 'integer' }, teamShort: { type: 'string' }, event: { type: 'integer' } } } },
                  },
                },
              },
            },
          },
          502: errorResponses[502],
        },
      },
    },
    '/squad': {
      get: {
        operationId: 'getSquad', tags: ['Squad'],
        summary: 'A team\'s 15-man squad for a gameweek, starting XI + bench, with bank/rank/points',
        parameters: [teamIdParam, eventIdParam],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    teamId: { type: 'integer' }, eventId: { type: 'integer' }, eventName: { type: 'string' },
                    teamPoints: { type: 'integer', nullable: true }, value: { type: 'number', nullable: true }, rank: { type: 'integer', nullable: true },
                    squad: {
                      type: 'array',
                      items: {
                        allOf: [player, { type: 'object', properties: {
                          starting: { type: 'boolean', description: 'Derived from pick.position <= 11 — the FPL API has no starting boolean.' },
                          slot: { type: 'integer', description: '1-15 squad slot.' },
                          points: { type: 'integer', description: 'Live points this gameweek, from event/{gw}/live/.' },
                          multiplier: { type: 'integer', description: '0=benched, 1=normal, 2=captain, 3=triple captain.' },
                          isCaptain: { type: 'boolean' }, isViceCaptain: { type: 'boolean' },
                        } }],
                      },
                    },
                  },
                },
              },
            },
          },
          400: errorResponses[400], 404: errorResponses[404], 502: errorResponses[502],
        },
      },
    },
    '/transfers': {
      get: {
        operationId: 'getTransferSuggestions', tags: ['Suggestions'],
        summary: 'Top 5 replacement candidates for one specific squad player',
        description: 'Same position, not already in the squad, affordable (bank + the sold player\'s price). Scored with the transfer weights (form 30% / fixture 30% / value 20% / underlying 20%, then × availability). Requires picking replaceId first — for a no-pick-needed whole-XI scan, use /squad-scan instead.',
        parameters: [teamIdParam, { name: 'replaceId', in: 'query', required: true, schema: { type: 'integer' }, description: 'Player ID (from /squad) to find replacements for.' }, eventIdParam],
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: { type: 'object', properties: {
              teamId: { type: 'integer' }, eventId: { type: 'integer' }, bank: { type: 'number' },
              replaced: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, position: { type: 'string' }, price: { type: 'number' }, availabilityPct: { type: 'integer', nullable: true }, penaltyOrder: { type: 'integer', nullable: true }, blankEvent: { type: 'boolean' }, dgwEvent: { type: 'boolean' } } },
              weights: { type: 'object' },
              candidates: { type: 'array', items: transferCandidate },
            } } } },
          },
          400: errorResponses[400], 404: errorResponses[404], 502: errorResponses[502],
        },
      },
    },
    '/captain': {
      get: {
        operationId: 'getCaptainSuggestions', tags: ['Suggestions'],
        summary: 'Starting XI ranked by captain score',
        description: 'Only the starting XI. Weighted toward the actual fixture(s) of the gameweek being planned for (form 35% / fixture 35% / value 10% / underlying 20%, then × availability) — a Blank Gameweek forces the fixture component to 0 rather than being silently skipped.',
        parameters: [teamIdParam, eventIdParam],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { teamId: { type: 'integer' }, eventId: { type: 'integer' }, weights: { type: 'object' }, candidates: { type: 'array', items: captainCandidate } } } } } },
          400: errorResponses[400], 404: errorResponses[404], 502: errorResponses[502],
        },
      },
    },
    '/squad-scan': {
      get: {
        operationId: 'getSquadScan', tags: ['Suggestions'],
        summary: 'Every starting XI player compared to its best same-position replacement, in one pass',
        description: 'No player selection needed — runs the /transfers logic once per starting player. Each comparison assumes only that one swap happens (uses the full current bank), not all 11 at once.',
        parameters: [teamIdParam, eventIdParam],
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: { type: 'object', properties: {
              teamId: { type: 'integer' }, eventId: { type: 'integer' }, bank: { type: 'number' }, weights: { type: 'object' },
              rows: { type: 'array', items: { type: 'object', properties: {
                current: { allOf: [transferCandidate, { type: 'object', properties: { position: { type: 'string' } } }] },
                suggestion: { ...transferCandidate, nullable: true },
                verdict: { type: 'string', enum: ['upgrade', 'keep', 'no-option'] },
              } } },
            } } } },
          },
          400: errorResponses[400], 404: errorResponses[404], 502: errorResponses[502],
        },
      },
    },
    '/chips': {
      get: {
        operationId: 'getChipPlan', tags: ['Chips'],
        summary: 'Chip window status (all 8) and heuristic recommendations for chips available right now',
        description:
          'Windows come from bootstrap-static.chips[] (authoritative — never hardcoded GW19), cross-referenced with the team\'s ' +
          'actual usage from entry/{id}/history/ (no manual "which chips have I used" tracking needed). Recommendations only ' +
          'compute for chips currently available: Bench Boost (bench all fit + easy fixtures), Triple Captain (top captain pick ' +
          'has an easy fixture), Free Hit (2+ squad teams blank next gameweek), Wildcard (4+ starters flagged upgrade).',
        parameters: [teamIdParam, eventIdParam],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            teamId: { type: 'integer' }, eventId: { type: 'integer' },
            windows: { type: 'array', items: chipWindow },
            recommendations: { type: 'array', items: { type: 'object', properties: { chip: { type: 'string' }, label: { type: 'string' }, reason: { type: 'string' }, detail: { type: 'object' } } } },
          } } } } },
          400: errorResponses[400], 404: errorResponses[404], 502: errorResponses[502],
        },
      },
    },
    '/bonus-predictor': {
      get: {
        operationId: 'getBonusPredictor', tags: ['Live'],
        summary: 'Live bonus point projection for every in-progress fixture this gameweek',
        description:
          'FPL only confirms bonus points once a match is fully finished; this projects them live from each player\'s ' +
          'current BPS (Bonus Points System score) using FPL\'s own tie-break rule, grouped per fixture (never compared ' +
          'across different matches). Only fixtures that have kicked off are included. League-wide — no team ID needed. ' +
          'Uses a 60-second cache instead of the app-wide 5 minutes, since BPS changes minute to minute during play.',
        parameters: [{ ...eventIdParam, description: 'Gameweek ID. Defaults to the current gameweek.' }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { eventId: { type: 'integer' }, fixtures: { type: 'array', items: bonusFixture } } } } } },
          502: errorResponses[502],
        },
      },
    },
    '/dream-team': {
      get: {
        operationId: 'getDreamTeam', tags: ['Live'],
        summary: "The gameweek's official Dream Team (FPL's own Team of the Week)",
        description:
          "Reads FPL's own `in_dreamteam` flag from event/{gw}/live/ directly — not a self-computed best-XI optimization. " +
          'Always exactly 11 players. League-wide — no team ID needed. Shaped like /squad\'s squad array (starting/slot fields) ' +
          'so the client can reuse PitchView to render it, even though there\'s no bench or captain here.',
        parameters: [{ ...eventIdParam, description: 'Gameweek ID. Defaults to the current gameweek.' }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { eventId: { type: 'integer' }, totalPoints: { type: 'integer' }, dreamTeam: { type: 'array', items: dreamTeamPlayer } } } } } },
          502: errorResponses[502],
        },
      },
    },
    '/element-summary/{id}': {
      get: {
        operationId: 'getElementSummary', tags: ['Players & fixtures'],
        summary: 'Raw per-player history from the FPL API (cached)',
        description: 'Passthrough of element-summary/{id}/ — past-season history and this-season per-gameweek history for one player. Not transformed like /players.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Player ID (from /players).' }],
        responses: { 200: { description: 'OK (raw FPL element-summary object)', content: { 'application/json': { schema: { type: 'object' } } } }, 502: errorResponses[502] },
      },
    },
    '/entry/{teamId}/event/{eventId}/picks': {
      get: {
        operationId: 'getEntryPicksRaw', tags: ['Squad'],
        summary: 'Raw picks for a team\'s gameweek, straight from the FPL API (cached)',
        description: 'Unprocessed — use /squad for the joined, computed version (player names, live points, starting/bench) instead, unless you specifically need the raw shape.',
        parameters: [
          { name: 'teamId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'eventId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'OK (raw FPL picks object)', content: { 'application/json': { schema: { type: 'object' } } } }, 502: errorResponses[502] },
      },
    },
  },
};

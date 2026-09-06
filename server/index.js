import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildData,
  buildFixtureGrid,
  buildSquad,
  buildTransferSuggestions,
  buildCaptainSuggestions,
  buildSquadScan,
  buildChipPlan,
  buildBonusPredictor,
  buildDreamTeam,
  getFixtures,
  getElementSummary,
  getEntryPicks,
} from './fpl.js';
import { openapiSpec } from './openapi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.disable('x-powered-by'); // don't advertise the Express version

// Open CORS is intentional: every endpoint only reads public FPL data (no
// auth, no writes), and the client is deployed on a different origin
// (GitHub Pages) than this API (Render) — see CLAUDE.md's split-deployment
// section. Restricting the origin would just break that deployment for no
// security benefit.
app.use(cors());
app.use(express.json());

// OpenAPI/Swagger — human-browsable docs at /api-docs, raw spec at
// /api-docs.json for tooling (e.g. an OpenAPI→MCP bridge) to fetch directly.
// The spec is hand-written in openapi.js, not generated from JSDoc comments
// on the routes below — see that file for why.
app.get('/api-docs.json', (_req, res) => res.json(openapiSpec));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/players', async (_req, res) => {
  try {
    const { players, teams, meta } = await buildData();
    res.json({ players, teams, meta });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/teams', async (_req, res) => {
  try {
    const { teams, meta } = await buildData();
    res.json({ teams, meta });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/meta', async (_req, res) => {
  try {
    const { meta } = await buildData();
    res.json(meta);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/fixtures', async (_req, res) => {
  try {
    res.json(await getFixtures());
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/fixture-grid', async (_req, res) => {
  try {
    res.json(await buildFixtureGrid());
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Phase 3 — my squad. ?teamId= required, ?eventId= optional (defaults to current GW).
app.get('/api/squad', async (req, res) => {
  try {
    const teamId = Number(req.query.teamId);
    if (!teamId) return res.status(400).json({ error: 'teamId query param is required' });
    const eventId = req.query.eventId ? Number(req.query.eventId) : null;
    const squad = await buildSquad(teamId, eventId);
    res.json(squad);
  } catch (e) {
    // 404 from the FPL API means the team/event doesn't exist.
    const status = /404/.test(e.message) ? 404 : 502;
    res.status(status).json({ error: e.message });
  }
});

// Phase 4 — transfer suggestions. ?teamId= and ?replaceId= required.
app.get('/api/transfers', async (req, res) => {
  try {
    const teamId = Number(req.query.teamId);
    const replaceId = Number(req.query.replaceId);
    if (!teamId) return res.status(400).json({ error: 'teamId query param is required' });
    if (!replaceId) return res.status(400).json({ error: 'replaceId query param is required' });
    const eventId = req.query.eventId ? Number(req.query.eventId) : null;
    res.json(await buildTransferSuggestions(teamId, replaceId, eventId));
  } catch (e) {
    const status = /404/.test(e.message) ? 404 : 502;
    res.status(status).json({ error: e.message });
  }
});

// Phase 4 — captain suggestions. ?teamId= required.
app.get('/api/captain', async (req, res) => {
  try {
    const teamId = Number(req.query.teamId);
    if (!teamId) return res.status(400).json({ error: 'teamId query param is required' });
    const eventId = req.query.eventId ? Number(req.query.eventId) : null;
    res.json(await buildCaptainSuggestions(teamId, eventId));
  } catch (e) {
    const status = /404/.test(e.message) ? 404 : 502;
    res.status(status).json({ error: e.message });
  }
});

// Quick squad scan — every starting XI player vs. its best same-position
// replacement, no player selection needed first. ?teamId= required.
app.get('/api/squad-scan', async (req, res) => {
  try {
    const teamId = Number(req.query.teamId);
    if (!teamId) return res.status(400).json({ error: 'teamId query param is required' });
    const eventId = req.query.eventId ? Number(req.query.eventId) : null;
    res.json(await buildSquadScan(teamId, eventId));
  } catch (e) {
    const status = /404/.test(e.message) ? 404 : 502;
    res.status(status).json({ error: e.message });
  }
});

// Chip planning helper — chip windows (from bootstrap-static, not hardcoded)
// cross-referenced with the user's actual chip usage (entry history), plus
// heuristic recommendations. ?teamId= required.
app.get('/api/chips', async (req, res) => {
  try {
    const teamId = Number(req.query.teamId);
    if (!teamId) return res.status(400).json({ error: 'teamId query param is required' });
    const eventId = req.query.eventId ? Number(req.query.eventId) : null;
    res.json(await buildChipPlan(teamId, eventId));
  } catch (e) {
    const status = /404/.test(e.message) ? 404 : 502;
    res.status(status).json({ error: e.message });
  }
});

// Live bonus point predictor — league-wide, no team needed. ?eventId=
// optional (defaults to the current live gameweek). Live match data, so it
// asks for fresher-than-usual data internally (see LIVE_BONUS_TTL_MS).
app.get('/api/bonus-predictor', async (req, res) => {
  try {
    const eventId = req.query.eventId ? Number(req.query.eventId) : null;
    res.json(await buildBonusPredictor(eventId));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Dream Team of the gameweek — FPL's own official Team of the Week, read
// directly from event/{gw}/live/'s in_dreamteam flag. League-wide, no team
// needed. ?eventId= optional (defaults to the current gameweek).
app.get('/api/dream-team', async (req, res) => {
  try {
    const eventId = req.query.eventId ? Number(req.query.eventId) : null;
    res.json(await buildDreamTeam(eventId));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Phase 3/4 endpoints (cached) — wired now so later phases don't need server changes.
app.get('/api/element-summary/:id', async (req, res) => {
  try {
    res.json(await getElementSummary(req.params.id));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/entry/:teamId/event/:eventId/picks', async (req, res) => {
  try {
    res.json(await getEntryPicks(req.params.teamId, req.params.eventId));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Serve the built Vite client (if present) so one process serves everything.
const distDir = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_req, res) =>
    res.sendFile(path.join(distDir, 'index.html'))
  );
} else {
  app.get('/', (_req, res) =>
    res
      .type('text/plain')
      .send('FPL API is running, but the client is not built yet.\nRun: npm --prefix client run build')
  );
}

app.listen(PORT, () => {
  console.log(`FPL server running on http://localhost:${PORT}`);
});

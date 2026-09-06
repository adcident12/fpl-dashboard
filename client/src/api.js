// When the client is deployed separately from the backend (e.g. GitHub Pages
// frontend + a Node host for the API), VITE_API_BASE points at the full
// backend URL (e.g. "https://fpl-dashboard-api.onrender.com/api"). Locally,
// and in the single-process deployment (server serves client/dist itself),
// it's unset and falls back to the relative path both already handle.
export const API = import.meta.env.VITE_API_BASE || '/api';

export async function fetchPlayers() {
  const res = await fetch(`${API}/players`);
  if (!res.ok) throw new Error(`Failed to load players (${res.status})`);
  return res.json();
}

export async function fetchFixtureGrid() {
  const res = await fetch(`${API}/fixture-grid`);
  if (!res.ok) throw new Error(`Failed to load fixtures (${res.status})`);
  return res.json();
}

export async function fetchSquad(teamId, eventId) {
  const params = new URLSearchParams({ teamId: String(teamId) });
  if (eventId) params.set('eventId', String(eventId));
  const res = await fetch(`${API}/squad?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load squad (${res.status})`);
  }
  return res.json();
}

export async function fetchTransfers(teamId, replaceId, eventId) {
  const params = new URLSearchParams({ teamId: String(teamId), replaceId: String(replaceId) });
  if (eventId) params.set('eventId', String(eventId));
  const res = await fetch(`${API}/transfers?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load transfers (${res.status})`);
  }
  return res.json();
}

export async function fetchCaptain(teamId, eventId) {
  const params = new URLSearchParams({ teamId: String(teamId) });
  if (eventId) params.set('eventId', String(eventId));
  const res = await fetch(`${API}/captain?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load captain suggestions (${res.status})`);
  }
  return res.json();
}

export async function fetchSquadScan(teamId, eventId) {
  const params = new URLSearchParams({ teamId: String(teamId) });
  if (eventId) params.set('eventId', String(eventId));
  const res = await fetch(`${API}/squad-scan?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load squad scan (${res.status})`);
  }
  return res.json();
}

export async function fetchChipPlan(teamId, eventId) {
  const params = new URLSearchParams({ teamId: String(teamId) });
  if (eventId) params.set('eventId', String(eventId));
  const res = await fetch(`${API}/chips?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load chip plan (${res.status})`);
  }
  return res.json();
}

export async function fetchBonusPredictor(eventId) {
  const params = new URLSearchParams();
  if (eventId) params.set('eventId', String(eventId));
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  const res = await fetch(`${API}/bonus-predictor${suffix}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load bonus predictor (${res.status})`);
  }
  return res.json();
}

export async function fetchDreamTeam(eventId) {
  const params = new URLSearchParams();
  if (eventId) params.set('eventId', String(eventId));
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  const res = await fetch(`${API}/dream-team${suffix}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load dream team (${res.status})`);
  }
  return res.json();
}

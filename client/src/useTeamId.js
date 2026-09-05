import { useState } from 'react';

const STORAGE_KEY = 'fpl-team-id';

/**
 * FPL Team ID persisted in localStorage, shared across tabs by reading/writing
 * the same key on every mount (each tab component mounts fresh when switched to).
 */
export function useTeamId() {
  const [teamId, setTeamIdState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  function setTeamId(id) {
    setTeamIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore (private browsing / storage disabled) — falls back to in-memory only
    }
  }

  return [teamId, setTeamId];
}

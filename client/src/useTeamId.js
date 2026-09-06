import { useState } from 'react';

const STORAGE_KEY = 'fpl-team-id';

/**
 * FPL Team ID persisted in localStorage, shared across tabs by reading/writing
 * the same key on every mount (each tab component mounts fresh when switched to).
 * `key` defaults to the shared main-team slot; RivalryView.jsx passes a second,
 * distinct key for the "rival" slot so the two don't clobber each other while
 * "your team" still prefills from the same saved ID every other tab uses.
 */
export function useTeamId(key = STORAGE_KEY) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) || '';
    } catch {
      return '';
    }
  });

  function setTeamId(id) {
    setValue(id);
    try {
      localStorage.setItem(key, id);
    } catch {
      // ignore (private browsing / storage disabled) — falls back to in-memory only
    }
  }

  return [value, setTeamId];
}

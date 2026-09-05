import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '.cache');
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

fs.mkdirSync(CACHE_DIR, { recursive: true });

function cacheFile(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

/**
 * Return cached data if fresh, otherwise call fetcher(), persist, and return.
 * Disk-backed so restarts don't immediately re-hit the API.
 */
export async function getCached(key, fetcher, ttlMs = DEFAULT_TTL_MS) {
  const file = cacheFile(key);
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Date.now() - raw.fetchedAt < ttlMs) {
        return raw.data;
      }
    }
  } catch {
    // ignore read/parse errors and fall through to a fresh fetch
  }

  const data = await fetcher();
  try {
    fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), data }));
  } catch {
    // ignore write errors — caching is best-effort
  }
  return data;
}

/**
 * When a cache entry was last fetched from the FPL API (ms epoch), for
 * showing data freshness in the UI — does not affect `getCached`'s own
 * fresh/stale decision.
 */
export function getCacheMeta(key) {
  try {
    const raw = JSON.parse(fs.readFileSync(cacheFile(key), 'utf8'));
    return { fetchedAt: raw.fetchedAt, ttlMs: DEFAULT_TTL_MS };
  } catch {
    return null;
  }
}

/**
 * platform.ts — the few things the shared "brain" needs from whichever app is running it.
 *
 * The same rules and data code run in two apps: the website (a browser) and the phone app
 * (React Native). They load files and save things in different ways, so each app plugs in
 * its own versions here once, at startup:
 *
 *   - Website: fetches files from /data and saves in the browser (localStorage, sessionStorage).
 *   - Phone:   reads files bundled with the app and saves with AsyncStorage.
 *
 * Everything else in /shared is plain TypeScript that works in both.
 */

/** A simple key-value store (like the browser's localStorage). Reads must be instant. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Platform {
  /** Load one of the app's built-in data files, e.g. "gauges.json" or "counties.geojson". */
  loadStaticJson(file: string): Promise<unknown>;
  /** Kept between visits (offline copy, device ID). */
  storage: KeyValueStore;
  /** Kept only until the app or tab is closed (Scenario Mode reports). */
  session: KeyValueStore;
  /** A random ID, e.g. "3b9f1c2e-...". */
  randomId(): string;
}

let current: Platform | null = null;

export function setPlatform(p: Platform): void {
  current = p;
}

export function platform(): Platform {
  if (!current) throw new Error('setPlatform() must be called when the app starts.');
  return current;
}

/** A store that only lives in memory: used when real storage is blocked, and in tests. */
export function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

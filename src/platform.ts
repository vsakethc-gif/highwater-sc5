/**
 * platform.ts (website) — plugs the browser into the shared code (see shared/platform.ts).
 * Built-in data files are fetched from /data; saved things go in localStorage and sessionStorage.
 */
import { memoryStore, setPlatform, type KeyValueStore } from '../shared/platform';

/** Browser storage can be blocked (private mode, strict settings); fall back to memory instead of crashing. */
function safeStore(get: () => Storage): KeyValueStore {
  const fallback = memoryStore();
  return {
    getItem: (k) => {
      try {
        return get().getItem(k);
      } catch {
        return fallback.getItem(k);
      }
    },
    setItem: (k, v) => {
      try {
        get().setItem(k, v);
      } catch {
        fallback.setItem(k, v);
      }
    },
  };
}

export function useBrowserPlatform(): void {
  setPlatform({
    loadStaticJson: async (file) => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
      if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`);
      return res.json();
    },
    storage: safeStore(() => localStorage),
    session: safeStore(() => sessionStorage),
    randomId: () => crypto.randomUUID(),
  });
}

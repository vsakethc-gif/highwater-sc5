/**
 * platform.ts (phone) — plugs React Native into the shared code (see shared/platform.ts).
 *
 *   - Built-in data files are bundled into the app (copied from ../public/data by
 *     scripts/copy-data.mjs), so they work offline from the very first launch.
 *   - Saved things (offline copy, chosen county, device ID) go in AsyncStorage, the phone's
 *     simple key-value storage. The shared code expects instant reads, so we load everything
 *     we saved into memory once at startup; writes update memory and AsyncStorage together.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { memoryStore, setPlatform, type KeyValueStore } from '../../shared/platform';

/* eslint-disable @typescript-eslint/no-require-imports */
const DATA: Record<string, unknown> = {
  'gauges.json': require('./generated-data/gauges.json'),
  'counties.geojson': require('./generated-data/counties.json'),
  'tracts.geojson': require('./generated-data/tracts.json'),
  'zips.json': require('./generated-data/zips.json'),
  'towns.json': require('./generated-data/towns.json'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** Every key this app saves starts with this (the same names as the website uses). */
const PREFIX = 'sc5ready.';

/** Some phones' JavaScript engines lack AbortSignal.timeout(), which the shared code uses for time limits. */
function addTimeoutSupport(): void {
  if (typeof AbortSignal.timeout === 'function') return;
  AbortSignal.timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error('Timed out')), ms);
    return controller.signal;
  };
}

export async function installNativePlatform(): Promise<void> {
  addTimeoutSupport();

  const saved = new Map<string, string>();
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    for (const [k, v] of await AsyncStorage.multiGet(keys)) if (v !== null) saved.set(k, v);
  } catch {
    /* storage unavailable: the app still works, it just won't remember things */
  }
  const storage: KeyValueStore = {
    getItem: (k) => saved.get(k) ?? null,
    setItem: (k, v) => {
      saved.set(k, v);
      AsyncStorage.setItem(k, v).catch(() => {});
    },
  };

  setPlatform({
    loadStaticJson: async (file) => {
      const data = DATA[file];
      if (!data) throw new Error(`No built-in file named ${file}`);
      return data;
    },
    storage,
    session: memoryStore(), // Scenario Mode reports: gone when the app closes
    randomId: () => Crypto.randomUUID(),
  });
}

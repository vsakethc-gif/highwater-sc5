/**
 * snapshot.ts — the "last loaded" copy of live data, for when the network is down (brief P1a).
 *
 * After a successful live load for a county, we save that county's alerts, gauges,
 * and rain forecast on this device (localStorage on the website, AsyncStorage on the phone). If a later load fails, the app
 * shows the saved copy, clearly labeled "Offline: showing info from [time]".
 *
 * Rules that keep this honest:
 *   - It's only ever used when the live source fails, never instead of live data.
 *   - Alerts that have ended since the copy was saved are dropped.
 *   - Old gauge readings are still "stale" to the engine, and a status built from a
 *     saved copy is always marked incomplete, so it can never become an all-clear.
 *   - Only public agency data is saved. No exact location is ever stored: copies are
 *     saved per county.
 */
import type { RainForecast } from '../hazards/types';
import { isEnded } from './nws';
import type { Alert, Gauge } from './types';
import { platform } from '../platform';

export interface Snapshot {
  saved_at: string;
  fips: string;
  alerts: Alert[];
  gauges: Gauge[];
  rain: RainForecast | null;
}

const key = (fips: string) => `sc5ready.snapshot.${fips}`;
const KEEP_READINGS_HOURS = 3;

export function makeSnapshot(fips: string, alerts: Alert[], gauges: Gauge[], rain: RainForecast | null, now = Date.now()): Snapshot {
  const cutoff = now - KEEP_READINGS_HOURS * 3600_000;
  return {
    saved_at: new Date(now).toISOString(),
    fips,
    alerts: alerts.filter((a) => a.county_fips.includes(fips)),
    // Keep only the last few hours of readings so the copy stays small.
    gauges: gauges
      .filter((g) => g.county_fips === fips)
      .map((g) => ({ ...g, recent_series: g.recent_series.filter((r) => Date.parse(r.time) >= cutoff) })),
    rain,
  };
}

/** Read a saved copy, dropping alerts that have ended since it was saved. */
export function restoreSnapshot(json: string | null, now = Date.now()): Snapshot | null {
  if (!json) return null;
  try {
    const s = JSON.parse(json) as Snapshot;
    if (!s.saved_at || !Array.isArray(s.alerts) || !Array.isArray(s.gauges)) return null;
    return { ...s, alerts: s.alerts.filter((a) => !isEnded(a, now)) };
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: Snapshot): void {
  try {
    platform().storage.setItem(key(snapshot.fips), JSON.stringify(snapshot));
  } catch {
    /* storage full or blocked: the app still works, just without an offline copy */
  }
}

export function loadSnapshot(fips: string): Snapshot | null {
  try {
    return restoreSnapshot(platform().storage.getItem(key(fips)));
  } catch {
    return null;
  }
}

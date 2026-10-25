/**
 * conditions.ts — one function that gathers everything a screen needs for a place:
 * alerts, gauges, and rain. In Scenario Mode it returns simulated data instead,
 * through the exact same shapes, so the rest of the app can't tell the difference
 * (except for the clear "Simulated" labels).
 *
 * Each source is loaded on its own: if one fails, the others still arrive, and
 * the failure is passed along as an Error so the screen can say what went wrong.
 */
import { COUNTIES } from '../config';
import type { Place, RainForecast } from '../hazards/types';
import { loadScenario, scenarioAlerts, scenarioGauges, scenarioRain } from '../scenario/scenario';
import { loadGaugeSites } from './gauges';
import { fetchActiveAlerts } from './nws';
import { fetchRain } from './rain';
import { loadSnapshot, makeSnapshot, saveSnapshot } from './snapshot';
import type { Alert, Gauge, Loaded } from './types';
import { buildGauge, fetchGaugeReadings } from './usgs';

export interface Conditions {
  /** All active SC alerts (filtered to the place by the engine). */
  alerts: Loaded<Alert[]> | Error;
  /** Gauges in the requested counties. */
  gauges: Loaded<Gauge[]> | Error;
  rain: Loaded<RainForecast> | Error;
  simulated: boolean;
  /** Set when some data came from the saved "last loaded" copy because the network failed. */
  savedAt?: string;
}

const stamp = <T>(data: T, source: string): Loaded<T> => ({ data, fetched_at: new Date().toISOString(), source });
const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

/** Where to get the rain forecast: the person's point, or the county seat. */
export function rainPoint(place: Place): { lat: number; lon: number } {
  if (place.kind === 'point') return { lat: place.lat, lon: place.lon };
  const seat = COUNTIES.find((c) => c.fips === place.fips)?.seat;
  return seat ?? { lat: 34.9249, lon: -81.0251 };
}

/** Gauges for some counties (or all SC-5 counties when `counties` is null). */
async function liveGauges(counties: string[] | null, signal?: AbortSignal): Promise<Loaded<Gauge[]>> {
  const sites = (await loadGaugeSites()).filter((s) => !counties || counties.includes(s.county_fips));
  if (!sites.length) return stamp([], 'USGS');
  const { readings, source } = await fetchGaugeReadings(sites.map((s) => s.site_id), signal);
  return stamp(sites.map((s) => buildGauge(s, readings.get(s.site_id) ?? [])), source);
}

export async function loadConditions(
  place: Place,
  scenarioId: string | null,
  options: { allCounties?: boolean; skipRain?: boolean; signal?: AbortSignal } = {},
): Promise<Conditions> {
  const counties = options.allCounties ? null : [place.fips];
  const scenario = await loadScenario(scenarioId);

  if (scenario) {
    const now = Date.now();
    const sites = (await loadGaugeSites()).filter((s) => !counties || counties.includes(s.county_fips));
    const source = scenario.replay ? 'Scenario Mode (replay of real archived data)' : 'Scenario Mode (simulated)';
    return {
      alerts: stamp(scenarioAlerts(scenario, now), source),
      gauges: stamp(scenarioGauges(scenario, sites, now), source),
      rain: stamp(scenarioRain(scenario, now), source),
      simulated: true,
    };
  }

  const { lat, lon } = rainPoint(place);
  const [alerts, gauges, rain] = await Promise.all([
    fetchActiveAlerts(options.signal).then((a) => stamp(a, 'National Weather Service'), asError),
    liveGauges(counties, options.signal).catch(asError),
    options.skipRain
      ? Promise.resolve(new Error('Rain forecast not requested'))
      : fetchRain(lat, lon, options.signal).then((r) => stamp(r, 'National Weather Service forecast'), asError),
  ]);

  // Single-county views: save a "last loaded" copy when live data arrives,
  // or fill in any failed source from that copy (clearly marked as saved).
  if (!options.allCounties) {
    if (!(alerts instanceof Error) && !(gauges instanceof Error)) {
      saveSnapshot(makeSnapshot(place.fips, alerts.data, gauges.data, rain instanceof Error ? null : rain.data));
      return { alerts, gauges, rain, simulated: false };
    }
    const saved = loadSnapshot(place.fips);
    if (saved) {
      const fromCopy = <T>(data: T, source: string): Loaded<T> => ({ data, fetched_at: saved.saved_at, source, saved: true });
      return {
        alerts: alerts instanceof Error ? fromCopy(saved.alerts, 'National Weather Service (saved copy)') : alerts,
        gauges: gauges instanceof Error ? fromCopy(saved.gauges, 'USGS (saved copy)') : gauges,
        rain: rain instanceof Error && saved.rain ? fromCopy(saved.rain, 'National Weather Service forecast (saved copy)') : rain,
        simulated: false,
        savedAt: saved.saved_at,
      };
    }
  }
  return { alerts, gauges, rain, simulated: false };
}

/** Unwrap for the engine: an Error becomes null ("this source failed"). */
export const dataOrNull = <T>(x: Loaded<T> | Error): T | null => (x instanceof Error ? null : x.data);

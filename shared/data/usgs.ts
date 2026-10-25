/**
 * usgs.ts — live river and stream readings from the U.S. Geological Survey.
 *
 * Primary source: the USGS Water Data API (api.waterdata.usgs.gov).
 * Fallback: the legacy WaterServices API, which USGS is retiring in early 2027.
 *
 * The parse/compute functions are "pure": they take data in and return an
 * answer, with no internet calls, so they can be tested with saved responses.
 */
import type { FloodCategory, FloodStages, Gauge, GaugeSite, Reading, Trend } from './types';

const API = 'https://api.waterdata.usgs.gov/ogcapi/v0/collections';
const LEGACY = 'https://waterservices.usgs.gov/nwis/iv/';
const GAGE_HEIGHT = '00065';

/** How far back the trend looks, and how big a change counts as rising or falling. */
export const TREND_WINDOW_HOURS = 3;
export const TREND_MIN_CHANGE_FT = 0.1;

// ---------- pure functions ----------

/**
 * Which official flood category a water height falls in.
 * Checks the highest stage first. Returns null when below action stage
 * or when the gauge has no official stages.
 */
export function floodCategory(value: number | null, stages: FloodStages | null): FloodCategory | null {
  if (value === null || !stages) return null;
  const order: FloodCategory[] = ['major', 'moderate', 'minor', 'action'];
  for (const cat of order) {
    const stage = stages[cat];
    if (stage !== null && value >= stage) return cat;
  }
  return null;
}

/**
 * Is the water going up, down, or holding steady?
 * Compares the newest reading with the oldest reading inside the last 3 hours.
 * A change of 0.1 ft or more counts as rising or falling.
 * "unknown" if there is less than 1 hour of data to compare.
 */
export function computeTrend(series: Reading[]): Trend {
  if (series.length < 2) return 'unknown';
  const last = series[series.length - 1];
  const lastMs = Date.parse(last.time);
  const windowStart = lastMs - TREND_WINDOW_HOURS * 3600_000;
  const first = series.find((r) => Date.parse(r.time) >= windowStart);
  if (!first || lastMs - Date.parse(first.time) < 3600_000) return 'unknown';
  const change = last.value - first.value;
  if (change >= TREND_MIN_CHANGE_FT) return 'rising';
  if (change <= -TREND_MIN_CHANGE_FT) return 'falling';
  return 'steady';
}

interface OgcFeature {
  properties: { monitoring_location_id: string; parameter_code?: string; time: string; value: string | null };
}

/** Turn a Water Data API response into readings grouped by gauge ID (without the "USGS-" prefix). */
export function parseOgcReadings(json: { features: OgcFeature[] }): Map<string, Reading[]> {
  const bySite = new Map<string, Reading[]>();
  for (const f of json.features) {
    const value = f.properties.value === null ? NaN : Number(f.properties.value);
    if (!Number.isFinite(value)) continue;
    const id = f.properties.monitoring_location_id.replace(/^USGS-/, '');
    const list = bySite.get(id) ?? [];
    list.push({ time: new Date(f.properties.time).toISOString(), value });
    bySite.set(id, list);
  }
  for (const list of bySite.values()) list.sort((a, b) => a.time.localeCompare(b.time));
  return bySite;
}

interface LegacyResponse {
  value: {
    timeSeries: {
      sourceInfo: { siteCode: { value: string }[] };
      variable: { variableCode: { value: string }[]; noDataValue?: number };
      values: { value: { value: string; dateTime: string }[] }[];
    }[];
  };
}

/** Same as parseOgcReadings, but for the legacy WaterServices format. Gage height only. */
export function parseLegacyReadings(json: LegacyResponse): Map<string, Reading[]> {
  const bySite = new Map<string, Reading[]>();
  for (const ts of json.value.timeSeries) {
    if (ts.variable.variableCode[0]?.value !== GAGE_HEIGHT) continue;
    const id = ts.sourceInfo.siteCode[0].value;
    const noData = ts.variable.noDataValue;
    const readings = (ts.values[0]?.value ?? [])
      .map((v) => ({ time: new Date(v.dateTime).toISOString(), value: Number(v.value) }))
      .filter((r) => Number.isFinite(r.value) && r.value !== noData);
    bySite.set(id, readings);
  }
  return bySite;
}

/** Combine a gauge from our list with its readings into the full Gauge shape. */
export function buildGauge(site: GaugeSite, series: Reading[]): Gauge {
  const latest = series.length ? series[series.length - 1] : null;
  return {
    ...site,
    latest,
    unit: 'ft',
    recent_series: series,
    trend: computeTrend(series),
    flood_category: floodCategory(latest?.value ?? null, site.stages),
    has_official_stage: site.stages !== null,
    provisional: true,
  };
}

// ---------- network ----------

/**
 * Get the last 6 hours of gage height for these gauges.
 * Tries the new API first; if it fails, tries the legacy one.
 * Returns which source actually answered, so the UI can credit it honestly.
 */
export async function fetchGaugeReadings(
  siteIds: string[],
  signal?: AbortSignal,
): Promise<{ readings: Map<string, Reading[]>; source: string }> {
  try {
    const ids = siteIds.map((id) => `USGS-${id}`).join(',');
    const url =
      `${API}/continuous/items?f=json&parameter_code=${GAGE_HEIGHT}&time=PT6H&limit=10000` +
      `&skipGeometry=true&properties=monitoring_location_id,time,value&monitoring_location_id=${ids}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`USGS Water Data API returned ${res.status}`);
    return { readings: parseOgcReadings(await res.json()), source: 'USGS Water Data API' };
  } catch (err) {
    if (signal?.aborted) throw err;
    const url = `${LEGACY}?format=json&parameterCd=${GAGE_HEIGHT}&period=PT6H&sites=${siteIds.join(',')}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Both USGS services failed (legacy returned ${res.status})`);
    return { readings: parseLegacyReadings(await res.json()), source: 'USGS WaterServices (legacy)' };
  }
}

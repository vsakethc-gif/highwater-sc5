/**
 * rain.ts — forecast rainfall from the National Weather Service.
 *
 * Two steps: /points/{lat},{lon} tells us which forecast grid square covers
 * the place, then /gridpoints/... gives "quantitativePrecipitation": expected rain
 * in millimeters for a series of time blocks (some 1 hour long, some 6 hours).
 */
import type { RainForecast } from '../hazards/types';

const MM_PER_INCH = 25.4;

interface QpfValue {
  validTime: string; // e.g. "2026-10-17T18:00:00+00:00/PT6H"
  value: number | null;
}

/** "PT6H" -> 6, "P1DT6H" -> 30, "PT1H" -> 1. */
export function durationHours(iso: string): number {
  const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60;
}

/**
 * Total forecast rain (inches) from `now` until `now + hours`.
 * A time block that only partly overlaps the window counts in proportion
 * (half the block inside = half its rain), assuming rain is spread evenly within a block.
 */
export function sumRainInches(values: QpfValue[], now: number, hours: number): number {
  const windowEnd = now + hours * 3600_000;
  let mm = 0;
  for (const v of values) {
    if (v.value === null) continue;
    const [startIso, duration] = v.validTime.split('/');
    const start = Date.parse(startIso);
    const end = start + durationHours(duration) * 3600_000;
    if (end <= start) continue;
    const overlap = Math.min(end, windowEnd) - Math.max(start, now);
    if (overlap > 0) mm += v.value * (overlap / (end - start));
  }
  return Math.round((mm / MM_PER_INCH) * 100) / 100;
}

/** Parse a gridpoint response into our RainForecast shape. Throws if the units aren't millimeters. */
export function parseRain(
  grid: { properties: { updateTime: string; quantitativePrecipitation: { uom: string; values: QpfValue[] } } },
  now: number,
): RainForecast {
  const q = grid.properties.quantitativePrecipitation;
  if (q.uom !== 'wmoUnit:mm') throw new Error(`Unexpected rain unit ${q.uom}`);
  return {
    next24h_in: sumRainInches(q.values, now, 24),
    next48h_in: sumRainInches(q.values, now, 48),
    updated_at: new Date(grid.properties.updateTime).toISOString(),
  };
}

/** Grid lookups never change for a place, so they're remembered for the session. */
const gridCache = new Map<string, string>();

export async function fetchRain(lat: number, lon: number, signal?: AbortSignal): Promise<RainForecast> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  let gridUrl = gridCache.get(key);
  if (!gridUrl) {
    const res = await fetch(`https://api.weather.gov/points/${key}`, { signal });
    if (!res.ok) throw new Error(`NWS points lookup returned ${res.status}`);
    gridUrl = (await res.json()).properties.forecastGridData as string;
    gridCache.set(key, gridUrl);
  }
  const res = await fetch(gridUrl, { signal });
  if (!res.ok) throw new Error(`NWS forecast grid returned ${res.status}`);
  return parseRain(await res.json(), Date.now());
}

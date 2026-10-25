/**
 * elevation.ts — how high (and how low) a route goes.
 *
 * OpenRouteService can return each point of a route as [longitude, latitude, elevation in meters].
 * From that we measure two things for each route card:
 *
 *   1. The lowest point on the route, in feet, and how far along the route it is.
 *   2. "Low dips": places where the road drops into a valley, at least 40 ft (12 m) lower than the
 *      ground within about three-quarters of a mile (1.2 km) on BOTH sides. These are creek and
 *      river valleys, where roads flood first. We chose these numbers by testing real routes:
 *      at 20 ft, only 6 of 15 "dips" were near a creek (the rest were ordinary hills); at 40 ft,
 *      7 of 7 were within 200 m of a FEMA high-risk flood zone.
 *
 * Elevation is not a flood map: a low road can be dry and a high road can be blocked.
 * It's one more clue, shown next to the warning areas and FEMA flood zones.
 * The heights come from satellite elevation data, so they are approximate (often within ~30 ft).
 */
import { distanceKm } from '../geo';

const FEET_PER_METER = 3.28084;
/** How much lower than both sides a spot must be to count as a dip: 12 m ≈ 40 ft. */
export const DIP_DEPTH_M = 12;
/** How far to look on each side of a spot (1.2 km ≈ 0.75 mile). */
export const DIP_WINDOW_KM = 1.2;

export interface ElevationProfile {
  lowest_ft: number;
  /** Miles from the start to the lowest point. */
  lowest_at_mi: number;
  highest_ft: number;
  /** Number of separate low dips (valley crossings). */
  dips: number;
}

/** Returns null when the route has no elevation (for example, from the backup router). */
export function elevationProfile(line: number[][]): ElevationProfile | null {
  if (line.length < 2 || line.some((p) => typeof p[2] !== 'number')) return null;

  // Distance along the route to every point, in km.
  const along: number[] = [0];
  for (let i = 1; i < line.length; i++) {
    along.push(along[i - 1] + distanceKm(line[i - 1][1], line[i - 1][0], line[i][1], line[i][0]));
  }
  const elev = line.map((p) => p[2]);

  let low = 0;
  let high = 0;
  for (let i = 1; i < elev.length; i++) {
    if (elev[i] < elev[low]) low = i;
    if (elev[i] > elev[high]) high = i;
  }

  // A point is in a dip if the highest ground within the window on each side is
  // at least DIP_DEPTH_M above it. Neighboring dip points (within one window) are one dip.
  let dips = 0;
  let lastDipKm = -Infinity;
  for (let i = 0; i < line.length; i++) {
    const before = maxInRange(elev, along, i, -1);
    const after = maxInRange(elev, along, i, 1);
    if (before - elev[i] >= DIP_DEPTH_M && after - elev[i] >= DIP_DEPTH_M) {
      if (along[i] - lastDipKm > DIP_WINDOW_KM) dips++;
      lastDipKm = along[i];
    }
  }

  return {
    lowest_ft: Math.round(elev[low] * FEET_PER_METER),
    lowest_at_mi: Math.round((along[low] / 1.609344) * 10) / 10,
    highest_ft: Math.round(elev[high] * FEET_PER_METER),
    dips,
  };
}

/** Highest elevation within DIP_WINDOW_KM of point i, looking backward (-1) or forward (+1). */
function maxInRange(elev: number[], along: number[], i: number, direction: -1 | 1): number {
  let max = -Infinity;
  for (let j = i + direction; j >= 0 && j < elev.length; j += direction) {
    if (Math.abs(along[j] - along[i]) > DIP_WINDOW_KM) break;
    if (elev[j] > max) max = elev[j];
  }
  return max;
}

/** Drop the elevation from each point (FEMA's flood-zone check expects plain [lon, lat]). */
export const flatLine = (line: number[][]): number[][] => line.map(([lon, lat]) => [lon, lat]);

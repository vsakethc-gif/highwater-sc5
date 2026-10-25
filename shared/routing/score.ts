/**
 * score.ts — comparing routes with a transparent formula (brief 10.2).
 *
 *   score = travel minutes
 *         + 30 for each active warning area the route ENTERS
 *              (an area you start or end in doesn't count: no route can avoid it)
 *         + 5  for each mile driven inside any active warning area
 *         + 3  for each FEMA high-risk flood zone it crosses
 *         + 2  for each low dip (a valley the road drops into, usually a creek crossing)
 *
 * Lower is better. Why these weights: driving into an active warning is the thing we
 * most want to avoid, so it "costs" half an hour of extra driving. Time spent inside a
 * warning area matters too (5 points per mile, so 6 miles inside "costs" as much as
 * entering one more area). Flood-zone crossings are long-term risk (most creek crossings
 * are in one), so each costs a few minutes. Low dips are where water collects first, but
 * they overlap with flood zones, so each costs a little less. The weights are a judgment call, and every
 * part is shown on each route card.
 */
import { distanceKm, pointInGeometry } from '../geo';

export const ALERT_AREA_PENALTY_MIN = 30;
export const MILES_INSIDE_PENALTY = 5;
export const FLOOD_ZONE_PENALTY_MIN = 3;
export const DIP_PENALTY_MIN = 2;

export interface ScoredRoute {
  duration_s: number;
  alert_area_intersections: number;
  miles_in_warning: number;
  /** null when FEMA couldn't be reached to count them. */
  flood_zone_crossings: number | null;
  /** null when the route has no elevation (backup router). */
  low_dips?: number | null;
}

export function routeScore(r: ScoredRoute): number {
  return (
    r.duration_s / 60 +
    ALERT_AREA_PENALTY_MIN * r.alert_area_intersections +
    MILES_INSIDE_PENALTY * r.miles_in_warning +
    FLOOD_ZONE_PENALTY_MIN * (r.flood_zone_crossings ?? 0) +
    DIP_PENALTY_MIN * (r.low_dips ?? 0)
  );
}

/** How many of these areas does the route line pass through? (Checks every point of the route line.) */
export function countAreasCrossed(line: number[][], areas: GeoJSON.Geometry[]): number {
  return areas.filter((area) => line.some(([lon, lat]) => pointInGeometry(lon, lat, area))).length;
}

/** Miles of the route inside any of these areas (each piece counts if its middle is inside). */
export function milesInside(line: number[][], areas: GeoJSON.Geometry[]): number {
  let km = 0;
  for (let i = 1; i < line.length; i++) {
    const [lon1, lat1] = line[i - 1];
    const [lon2, lat2] = line[i];
    const mid: [number, number] = [(lon1 + lon2) / 2, (lat1 + lat2) / 2];
    if (areas.some((a) => pointInGeometry(mid[0], mid[1], a))) km += distanceKm(lat1, lon1, lat2, lon2);
  }
  return Math.round((km / 1.609344) * 10) / 10;
}

/** "28 min", "1 hr 5 min" */
export function formatDuration(seconds: number): string {
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} hr ${min % 60} min`;
}

/** Meters to miles, one decimal. */
export function formatMiles(meters: number): string {
  return `${(meters / 1609.344).toFixed(1)} mi`;
}

/**
 * Keep at most `max` points of a line (always keeping the ends), so it fits in a
 * web request when we ask FEMA which flood zones it crosses.
 */
export function thinLine(line: number[][], max = 250): number[][] {
  if (line.length <= max) return line;
  const step = (line.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => line[Math.round(i * step)]);
}

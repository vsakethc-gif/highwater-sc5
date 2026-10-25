/**
 * plan.ts — plans up to three routes and compares them (brief 10.1–10.2).
 *
 *  1. Ask for the fastest route (plus alternatives) through our Worker → OpenRouteService.
 *  2. If the fastest route passes through an active warning area we can avoid, ask again
 *     with those areas as "avoid polygons". If that fails (no road around it, or too complex),
 *     retry with only the parts the fastest route actually crosses, and say what couldn't be avoided.
 *  3. For every route: count warning areas it passes through and FEMA flood zones it crosses.
 *  4. Label the fastest and the lower-exposure route using the formula in score.ts.
 * If the Worker or OpenRouteService is down, fall back to the public OSRM demo server,
 * which can't avoid anything, and say so plainly.
 */
import { WORKER_URL } from '../config';
import type { Alert } from '../data/types';
import { buildAvoidPlan, tileForRouter, tripBox, type LonLat, type PolygonCoords } from './avoid';
import { countAreasCrossed, milesInside, routeScore, thinLine } from './score';
import { pointInGeometry } from '../geo';
import { reportsNearLine, type Report } from '../reports/client';
import { elevationProfile, flatLine, type ElevationProfile } from './elevation';

export type Provider = 'ors' | 'osrm-fallback';

export interface Step {
  instruction: string;
  distance_m: number;
}

export interface RouteResult {
  id: string;
  label: string;
  geometry: GeoJSON.LineString;
  duration_s: number;
  distance_m: number;
  /** Warning names this route was asked to go around. */
  avoided_areas: string[];
  /** Active warning areas the route ENTERS (not counting one you start or end in). */
  alert_area_intersections: number;
  /** Miles driven inside any active warning area. */
  miles_in_warning: number;
  flood_zone_crossings: number | null;
  /** Lowest point and low dips (null from the backup router, which has no elevation). */
  elevation: ElevationProfile | null;
  low_dips: number | null;
  /** Filled in by the reports feature (P1c); 0 until then. */
  nearby_unverified_reports: number;
  warnings: string[];
  provider: Provider;
  steps: Step[];
  score: number;
  isFastest: boolean;
  isLowestExposure: boolean;
}

export interface RoutePlan {
  routes: RouteResult[];
  provider: Provider;
  /** Messages shown above the route cards. */
  notices: string[];
  cannotAvoid: string[];
  planned_at: string;
}

interface RawRoute {
  geometry: GeoJSON.LineString;
  duration_s: number;
  distance_m: number;
  steps: Step[];
}

class RoutingError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// ---------- OpenRouteService through the Worker ----------

interface OrsFeature {
  geometry: GeoJSON.LineString;
  properties: {
    summary: { distance?: number; duration?: number };
    segments?: { steps?: { instruction: string; distance: number }[] }[];
  };
}

export function parseOrs(json: { features?: OrsFeature[] }): RawRoute[] {
  return (json.features ?? []).map((f) => ({
    geometry: f.geometry,
    duration_s: f.properties.summary.duration ?? 0,
    distance_m: f.properties.summary.distance ?? 0,
    steps: (f.properties.segments ?? []).flatMap((s) => s.steps ?? []).map((s) => ({ instruction: s.instruction, distance_m: s.distance })),
  }));
}

async function orsRoute(start: LonLat, end: LonLat, avoid: PolygonCoords[] | null, alternatives: boolean, signal?: AbortSignal): Promise<RawRoute[]> {
  if (!WORKER_URL) throw new RoutingError('Routing service not set up', 503);
  // Stop waiting after 25 seconds (the Worker itself gives up on ORS after 20).
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 25_000);
  signal?.addEventListener('abort', () => timeout.abort());
  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end, avoid: avoid?.length ? avoid : null, alternatives }),
      signal: timeout.signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new RoutingError('The routing service didn’t respond in time', 504);
  } finally {
    clearTimeout(timer);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new RoutingError((json as { error?: string }).error ?? `Routing error ${res.status}`, res.status);
  return parseOrs(json);
}

// ---------- OSRM fallback (no hazard avoidance) ----------

interface OsrmStep {
  distance: number;
  name: string;
  maneuver: { type: string; modifier?: string };
}

/** OSRM gives maneuver types, not sentences, so we write simple ones. */
export function osrmInstruction(s: OsrmStep): string {
  const road = s.name ? ` onto ${s.name}` : '';
  const dir = s.maneuver.modifier ?? '';
  switch (s.maneuver.type) {
    case 'depart':
      return `Head out${s.name ? ` on ${s.name}` : ''}`;
    case 'arrive':
      return 'Arrive at your destination';
    case 'turn':
    case 'end of road':
      return `Turn ${dir}${road}`.replace(/\s+/g, ' ');
    case 'merge':
    case 'on ramp':
    case 'off ramp':
    case 'fork':
      return `Keep ${dir}${road}`.replace(/\s+/g, ' ');
    case 'roundabout':
    case 'rotary':
      return `Take the roundabout${road}`;
    default:
      return `Continue${road}`;
  }
}

async function osrmRoute(start: LonLat, end: LonLat, signal?: AbortSignal): Promise<RawRoute[]> {
  const url = `https://router.project-osrm.org/route/v1/driving/${start.join(',')};${end.join(',')}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new RoutingError(`Backup routing returned ${res.status}`, res.status);
  const json = await res.json();
  if (json.code !== 'Ok' || !json.routes?.length) throw new RoutingError('No route found', 404);
  return json.routes.map((r: { geometry: GeoJSON.LineString; duration: number; distance: number; legs: { steps: OsrmStep[] }[] }) => ({
    geometry: r.geometry,
    duration_s: r.duration,
    distance_m: r.distance,
    steps: r.legs.flatMap((l) => l.steps).map((s) => ({ instruction: osrmInstruction(s), distance_m: s.distance })),
  }));
}

// ---------- FEMA flood-zone crossings ----------

const NFHL_ZONES = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query';

/**
 * How many separate high-risk flood zones the route line crosses.
 * null if FEMA can't be reached within 10 seconds: a slow FEMA never holds up the route.
 */
export async function floodZoneCrossings(line: number[][], outer?: AbortSignal): Promise<number | null> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 10_000);
  outer?.addEventListener('abort', () => timeout.abort());
  const signal = timeout.signal;
  try {
    const body = new URLSearchParams({
      geometry: JSON.stringify({ paths: [thinLine(flatLine(line))], spatialReference: { wkid: 4326 } }),
      geometryType: 'esriGeometryPolyline',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      where: "SFHA_TF='T'",
      returnCountOnly: 'true',
      f: 'json',
    });
    const res = await fetch(NFHL_ZONES, { method: 'POST', body, signal });
    const json = await res.json();
    return typeof json.count === 'number' ? json.count : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- putting it together ----------

/** Drop routes that are basically the same road (distance within 1%). */
function dedupe(routes: RawRoute[]): RawRoute[] {
  const out: RawRoute[] = [];
  for (const r of routes) if (!out.some((o) => Math.abs(o.distance_m - r.distance_m) / o.distance_m < 0.01)) out.push(r);
  return out;
}

/** Community reports used by the planner (brief 10.2): shown near routes; flooded roads can be avoided. */
export interface ReportInput {
  reports: Report[];
  avoidFlooded: boolean;
}

/** Kinds of unverified reports worth mentioning on a route card. */
const ROUTE_REPORT_KINDS = ['flooded_road', 'downed_tree', 'downed_power_line'];

/** A small square (about 150 m across) around a reported flooded road, to route around it. */
function reportSquare(r: Report): PolygonCoords {
  const dLat = 75 / 111_000;
  const dLon = 75 / (111_000 * Math.cos((r.lat * Math.PI) / 180));
  const [x0, x1, y0, y1] = [r.lon - dLon, r.lon + dLon, r.lat - dLat, r.lat + dLat].map((n) => Math.round(n * 1e5) / 1e5);
  return [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
}

export async function planRoutes(
  start: LonLat,
  end: LonLat,
  alerts: Alert[],
  signal?: AbortSignal,
  community: ReportInput = { reports: [], avoidFlooded: false },
): Promise<RoutePlan> {
  const avoidPlan = buildAvoidPlan(alerts);
  const avoidPolygons = avoidPlan.sources.flatMap((s) => s.polygons);
  const avoidGeometries: GeoJSON.Geometry[] = avoidPolygons.map((p) => ({ type: 'Polygon', coordinates: p }));
  const notices: string[] = [];
  let provider: Provider = 'ors';

  // 1. Fastest route (+ alternatives)
  let base: RawRoute[];
  try {
    base = await orsRoute(start, end, null, true, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    if (err instanceof RoutingError && err.status === 400) throw err; // a bad request won't work on the backup either
    base = await osrmRoute(start, end, signal);
    provider = 'osrm-fallback';
    notices.push('This route does not avoid hazard areas. Our main routing service is unavailable, so this comes from a backup that can’t see warnings.');
  }

  // 2. Lower-exposure route around warning areas the fastest route passes through
  const avoidedNames: string[] = [];
  let avoided: RawRoute[] = [];
  // Community-reported flooded roads near the trip (unverified), as small avoid squares.
  const box = tripBox(start, end);
  const floodedNearTrip = community.avoidFlooded
    ? community.reports.filter((r) => r.category === 'flooded_road' && r.lon >= box[0] && r.lon <= box[2] && r.lat >= box[1] && r.lat <= box[3])
    : [];
  const reportSquares = floodedNearTrip.slice(0, 15).map(reportSquare);
  const fastestNearFlooded = base.length > 0 && reportsNearLine(floodedNearTrip, base[0].geometry.coordinates).length > 0;
  const fastestCrosses = base.length > 0 && (countAreasCrossed(base[0].geometry.coordinates, avoidGeometries) > 0 || fastestNearFlooded);
  if (provider === 'ors' && fastestCrosses) {
    // You can't avoid the spot you're standing in (or going to). Leave out the tiles that contain
    // the start or end, so the route heads out of the warning area the most direct way.
    const allTiles = tileForRouter(avoidPolygons, tripBox(start, end));
    const tiles = [...allTiles, ...reportSquares].filter((t) => !isInside(start[0], start[1], t) && !isInside(end[0], end[1], t));
    if (reportSquares.length) avoidedNames.push('community-reported flooded roads (unverified)');
    if (avoidGeometries.some((g) => pointInGeometry(start[0], start[1], g))) {
      notices.push('You’re starting inside an active warning area. The route leads out of it, but it can’t avoid the part you’re already in.');
    }
    if (avoidGeometries.some((g) => pointInGeometry(end[0], end[1], g))) {
      notices.push('Your destination is inside an active warning area. Consider choosing a place outside it.');
    }
    try {
      avoided = await orsRoute(start, end, tiles, false, signal);
      avoidedNames.push(...avoidPlan.sources.map((s) => s.event));
    } catch (err) {
      if (signal?.aborted) throw err;
      // If the service timed out, don't make people wait for a second try.
      if (err instanceof RoutingError && err.status === 504) {
        notices.push('The routing service was too slow to plan a way around the warning areas. The routes below may pass through them.');
        avoided = [];
      } else {
        // Retry with only the tiles the fastest route actually runs through.
        const line = base[0].geometry.coordinates;
        const crossed = tiles.filter((t) => line.some(([lon, lat]) => isInside(lon, lat, t)));
        try {
          if (!crossed.length || crossed.length === tiles.length) throw err;
          avoided = await orsRoute(start, end, crossed, false, signal);
          avoidedNames.push(...avoidPlan.sources.map((s) => s.event));
          notices.push('We could only route around the parts of the warning areas on the direct path, not the whole areas.');
        } catch {
          notices.push(
            `We couldn’t find a road around the active warning areas (${avoidPlan.sources.map((s) => s.event).join(', ')}). The routes below may pass through them.`,
          );
        }
      }
    }
  } else if (provider === 'ors' && avoidPolygons.length) {
    notices.push('The fastest route doesn’t pass through any active warning area we know about.');
  }

  // 3. Measure every route
  const raw = dedupe([...base, ...avoided]).slice(0, 3);
  // Areas a route could choose not to enter: every avoid area except ones holding the start or end.
  const enterable = avoidGeometries.filter((g) => !pointInGeometry(start[0], start[1], g) && !pointInGeometry(end[0], end[1], g));
  const crossings = await Promise.all(raw.map((r) => floodZoneCrossings(r.geometry.coordinates, signal)));
  const routes: RouteResult[] = raw.map((r, i) => {
    const alertHits = countAreasCrossed(r.geometry.coordinates, enterable);
    const milesIn = milesInside(r.geometry.coordinates, avoidGeometries);
    const fromAvoid = avoided.includes(r);
    const elevation = elevationProfile(r.geometry.coordinates);
    const warnings: string[] = [];
    if (alertHits > 0) warnings.push(`Enters ${alertHits} active warning area${alertHits > 1 ? 's' : ''}.`);
    if (milesIn > 0) warnings.push(`${milesIn.toFixed(1)} miles inside active warning areas.`);
    if (crossings[i] === null) warnings.push('Couldn’t check FEMA flood zones for this route.');
    if (provider === 'osrm-fallback') warnings.push('Does not account for active hazards.');
    const result = {
      id: `route-${i}`,
      label: '',
      geometry: r.geometry,
      duration_s: r.duration_s,
      distance_m: r.distance_m,
      avoided_areas: fromAvoid ? avoidedNames : [],
      alert_area_intersections: alertHits,
      miles_in_warning: milesIn,
      flood_zone_crossings: crossings[i],
      elevation,
      low_dips: elevation?.dips ?? null,
      nearby_unverified_reports: reportsNearLine(
        community.reports.filter((x) => ROUTE_REPORT_KINDS.includes(x.category)),
        r.geometry.coordinates,
      ).length,
      warnings,
      provider,
      steps: r.steps,
      score: 0,
      isFastest: false,
      isLowestExposure: false,
    };
    result.score = routeScore(result);
    return result;
  });

  // 4. Labels
  if (routes.length) {
    const fastest = routes.reduce((a, b) => (b.duration_s < a.duration_s ? b : a));
    const lowest = routes.reduce((a, b) => (b.score < a.score ? b : a));
    fastest.isFastest = true;
    lowest.isLowestExposure = provider === 'ors';
    for (const r of routes) {
      r.label =
        r.isFastest && r.isLowestExposure ? 'Fastest and lower-exposure' : r.isLowestExposure ? 'Lower-exposure route' : r.isFastest ? 'Fastest route' : 'Alternative route';
    }
    // Show the recommended (lower-exposure) route first.
    routes.sort((a, b) => Number(b.isLowestExposure) - Number(a.isLowestExposure) || a.score - b.score);
  }
  if (avoidPlan.cannotAvoid.length) notices.push(`Can’t be routed around: ${avoidPlan.cannotAvoid.join('; ')}.`);

  return { routes, provider, notices, cannotAvoid: avoidPlan.cannotAvoid, planned_at: new Date().toISOString() };
}

function isInside(lon: number, lat: number, polygon: PolygonCoords): boolean {
  const ring = polygon[0];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------- address search (through the Worker) ----------

export interface AddressMatch {
  label: string;
  lat: number;
  lon: number;
}

export async function searchAddress(q: string, signal?: AbortSignal): Promise<AddressMatch[]> {
  if (!WORKER_URL) throw new Error('Address search isn’t set up yet.');
  const res = await fetch(`${WORKER_URL}/geocode?${new URLSearchParams({ q })}`, { signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Address search failed.');
  return (json as { matches: AddressMatch[] }).matches;
}

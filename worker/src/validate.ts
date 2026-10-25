/**
 * validate.ts — checks every request before the Worker passes it on.
 *
 * The Worker spends our routing quota, so it only accepts requests that look like
 * real use of this app: points in or near South Carolina, a reasonable number of
 * avoid areas, and short address searches. Pure functions, so they can be tested.
 */

/** Generous box around SC-5 and nearby (destinations like shelters may be outside the district). */
export const AREA = { minLon: -84, maxLon: -78, minLat: 31.5, maxLat: 36.8 };
export const MAX_AVOID_POLYGONS = 30;
export const MAX_AVOID_POINTS = 3000;
export const MAX_QUERY_LENGTH = 120;

export type LonLat = [number, number];

export interface RouteRequest {
  start: LonLat;
  end: LonLat;
  /** Areas to route around, as a GeoJSON MultiPolygon's coordinates. */
  avoid: number[][][][] | null;
  alternatives: boolean;
}

function isPoint(p: unknown): p is LonLat {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    p.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    p[0] >= AREA.minLon &&
    p[0] <= AREA.maxLon &&
    p[1] >= AREA.minLat &&
    p[1] <= AREA.maxLat
  );
}

/** Returns a clean request, or an error message to send back. */
export function validateRoute(body: unknown): RouteRequest | string {
  if (!body || typeof body !== 'object') return 'Request body must be JSON.';
  const b = body as Record<string, unknown>;
  if (!isPoint(b.start) || !isPoint(b.end)) return 'Start and end must be [longitude, latitude] in or near South Carolina.';

  let avoid: number[][][][] | null = null;
  if (b.avoid !== undefined && b.avoid !== null) {
    if (!Array.isArray(b.avoid)) return 'avoid must be MultiPolygon coordinates.';
    if (b.avoid.length > MAX_AVOID_POLYGONS) return `Too many avoid areas (max ${MAX_AVOID_POLYGONS}).`;
    let points = 0;
    for (const polygon of b.avoid) {
      if (!Array.isArray(polygon) || polygon.length === 0) return 'Each avoid area must be a polygon.';
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4) return 'Each polygon ring needs at least 4 points.';
        for (const p of ring) {
          if (!isPoint(p)) return 'Avoid area points must be in or near South Carolina.';
          points++;
        }
      }
    }
    if (points > MAX_AVOID_POINTS) return `Avoid areas are too detailed (max ${MAX_AVOID_POINTS} points).`;
    avoid = b.avoid as number[][][][];
  }
  return { start: b.start, end: b.end, avoid, alternatives: b.alternatives === true };
}

/** Address search text: trimmed, not empty, not too long. */
export function validateQuery(q: string | null): string | null {
  const text = (q ?? '').trim();
  if (!text || text.length > MAX_QUERY_LENGTH) return null;
  return text;
}

/** The request body sent to OpenRouteService. */
export function orsBody(r: RouteRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    coordinates: [r.start, r.end],
    instructions: true,
    language: 'en',
    units: 'm',
    elevation: true, // each point comes back as [lon, lat, height in meters], for the route's lowest point and dips
  };
  if (r.avoid?.length) body.options = { avoid_polygons: { type: 'MultiPolygon', coordinates: r.avoid } };
  if (r.alternatives) body.alternative_routes = { target_count: 2, weight_factor: 1.6, share_factor: 0.6 };
  return body;
}

/**
 * Simple rate limit: at most `limit` requests per `windowMs` for each visitor.
 * Visitors are tracked by a one-way hash of their IP address, kept only in memory
 * for the length of the window, never stored or logged.
 * (Each Cloudflare server keeps its own count, so this is a basic guard, not a perfect one.)
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  allow(visitor: string, now = Date.now()): boolean {
    const recent = (this.hits.get(visitor) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(visitor, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(visitor, recent);
    if (this.hits.size > 5000) this.prune(now);
    return true;
  }

  private prune(now: number): void {
    for (const [k, times] of this.hits) if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
  }
}

// ---------------------------------------------------------------------
// Community reports (brief 11.5): server-side checks before saving.
// The database functions check the same things again.
// ---------------------------------------------------------------------

export const REPORT_CATEGORIES = [
  'streetlight_out',
  'traffic_signal_out',
  'downed_tree',
  'flooded_road',
  'blocked_drain',
  'road_damage',
  'sign_damage',
  'downed_power_line',
  'other',
] as const;
export const SC5_COUNTIES = ['45021', '45023', '45039', '45055', '45057', '45061', '45087', '45091'];
/** SC-5's 8 counties plus a small buffer. */
export const SC5_BOX = { minLon: -82.0, maxLon: -79.95, minLat: 33.85, maxLat: 35.3 };
export const MAX_DESCRIPTION = 280;

/** A short list of words we don't show publicly. Flags and the admin page catch the rest. */
const BLOCKED_WORDS = ['fuck', 'shit', 'bitch', 'cunt', 'asshole', 'bastard', 'dick', 'pussy'];

export interface ReportRequest {
  category: (typeof REPORT_CATEGORIES)[number];
  lat: number;
  lon: number;
  county_fips: string;
  description: string | null;
  device_id: string;
  turnstile_token: string;
}

export function looksPersonal(text: string): boolean {
  return /\d{3}[\s.\-)]*\d{3}[\s.\-]*\d{4}/.test(text) || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text);
}

export function hasBlockedWord(text: string): boolean {
  const words = text.toLowerCase().split(/[^a-z]+/);
  return words.some((w) => BLOCKED_WORDS.includes(w));
}

const isDeviceId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{20,64}$/i.test(v);

/** Returns a clean report, or a plain-language error. */
export function validateReport(body: unknown): ReportRequest | string {
  if (!body || typeof body !== 'object') return 'Request body must be JSON.';
  const b = body as Record<string, unknown>;
  if (!REPORT_CATEGORIES.includes(b.category as never)) return 'Choose a category.';
  const lat = Number(b.lat);
  const lon = Number(b.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lon < SC5_BOX.minLon || lon > SC5_BOX.maxLon || lat < SC5_BOX.minLat || lat > SC5_BOX.maxLat) {
    return 'The location must be in SC-5’s 8 counties.';
  }
  if (!SC5_COUNTIES.includes(String(b.county_fips))) return 'The location must be in SC-5’s 8 counties.';
  let description: string | null = null;
  if (b.description !== undefined && b.description !== null) {
    if (typeof b.description !== 'string') return 'Description must be text.';
    description = b.description.trim().slice(0, MAX_DESCRIPTION + 1) || null;
    if (description && description.length > MAX_DESCRIPTION) return `Keep the description to ${MAX_DESCRIPTION} characters.`;
    if (description && looksPersonal(description)) return 'Please remove phone numbers or email addresses from the description.';
    if (description && hasBlockedWord(description)) return 'Please remove offensive words from the description.';
  }
  if (!isDeviceId(b.device_id)) return 'Missing device ID.';
  if (typeof b.turnstile_token !== 'string' || b.turnstile_token.length < 10) return 'Please complete the “I’m human” check.';
  return {
    category: b.category as ReportRequest['category'],
    lat: Math.round(lat * 1e5) / 1e5,
    lon: Math.round(lon * 1e5) / 1e5,
    county_fips: String(b.county_fips),
    description,
    device_id: b.device_id,
    turnstile_token: b.turnstile_token,
  };
}

export interface VoteRequest {
  report_id: string;
  kind: 'confirm' | 'fixed' | 'flag';
  device_id: string;
}

export function validateVote(body: unknown): VoteRequest | string {
  if (!body || typeof body !== 'object') return 'Request body must be JSON.';
  const b = body as Record<string, unknown>;
  if (typeof b.report_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.report_id)) return 'Unknown report.';
  if (!['confirm', 'fixed', 'flag'].includes(b.kind as string)) return 'Unknown vote.';
  if (!isDeviceId(b.device_id)) return 'Missing device ID.';
  return { report_id: b.report_id, kind: b.kind as VoteRequest['kind'], device_id: b.device_id };
}

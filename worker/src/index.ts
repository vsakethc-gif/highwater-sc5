/**
 * Highwater Worker — the app's one small piece of server code (brief, section 2.3).
 *
 * It exists for two reasons:
 *   1. POST /route   — asks OpenRouteService for directions. The ORS key is a Worker
 *                      "secret", so it never reaches anyone's browser.
 *   2. GET /geocode  — address search through the U.S. Census Geocoder, which doesn't
 *                      allow browsers to call it directly (no CORS).
 *   3. POST /report  — a community report: checks Turnstile and the content, then saves it
 *                      through a database function using the Supabase SECRET key.
 *   4. POST /vote    — "Still there", "Fixed", or "Flag" on a report.
 *
 * Privacy: nothing is stored or logged. Locations pass through to the service that
 * answers them and are then forgotten.
 */
import { orsBody, RateLimiter, validateQuery, validateReport, validateRoute, validateVote } from './validate';

export interface Env {
  ORS_API_KEY: string;
  /** Comma-separated list of sites allowed to use this Worker. */
  ALLOWED_ORIGINS: string;
  /** Supabase project URL and SECRET key (the secret key never leaves this Worker). */
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  /** Cloudflare Turnstile secret, for checking the anti-spam token. */
  TURNSTILE_SECRET: string;
  /** Random text mixed into device IDs before hashing, so stored hashes can't be matched to devices. */
  DEVICE_SALT: string;
}

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
const GEOCODER_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

// Per-visitor limits. Each route request can use up to 2 ORS calls (fastest + lower-exposure).
const routeLimiter = new RateLimiter(20, 10 * 60_000); // 20 per 10 minutes
const geocodeLimiter = new RateLimiter(60, 10 * 60_000); // 60 per 10 minutes

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  return origin && allowed.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
    : {};
}

function json(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
  });
}

/** One-way hash of the visitor's IP, so the rate limiter never holds the IP itself. */
async function visitorId(request: Request): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return btoa(String.fromCharCode(...new Uint8Array(digest).slice(0, 12)));
}

async function handleRoute(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  if (!routeLimiter.allow(await visitorId(request))) {
    return json({ error: 'Too many route requests. Please wait a few minutes and try again.' }, 429, cors);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400, cors);
  }
  const checked = validateRoute(body);
  if (typeof checked === 'string') return json({ error: checked }, 400, cors);

  // Give up after 20 seconds so the app can switch to its backup instead of hanging.
  let res: Response;
  try {
    res = await fetch(ORS_URL, {
      method: 'POST',
      headers: { Authorization: env.ORS_API_KEY, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
      body: JSON.stringify(orsBody(checked)),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return json({ error: 'The routing service didn’t respond in time.', status: 504 }, 504, cors);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Pass back ORS's reason (e.g. "no route found", quota reached) without exposing the key.
    const message = (data as { error?: { message?: string } }).error?.message ?? `Routing service error ${res.status}`;
    return json({ error: message, status: res.status }, res.status === 429 ? 429 : 502, cors);
  }
  return json(data, 200, cors);
}

async function handleGeocode(request: Request, cors: Record<string, string>): Promise<Response> {
  if (!geocodeLimiter.allow(await visitorId(request))) {
    return json({ error: 'Too many searches. Please wait a few minutes and try again.' }, 429, cors);
  }
  const q = validateQuery(new URL(request.url).searchParams.get('q'));
  if (!q) return json({ error: 'Enter an address.' }, 400, cors);
  const url = `${GEOCODER_URL}?${new URLSearchParams({ address: q, benchmark: 'Public_AR_Current', format: 'json' })}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch {
    return json({ error: 'Address search didn’t respond in time. Try a ZIP code or tap the map.' }, 504, cors);
  }
  if (!res.ok) return json({ error: `Address search error ${res.status}` }, 502, cors);
  const data = (await res.json()) as {
    result?: { addressMatches?: { matchedAddress: string; coordinates: { x: number; y: number } }[] };
  };
  const matches = (data.result?.addressMatches ?? [])
    .slice(0, 5)
    .map((m) => ({ label: m.matchedAddress, lon: m.coordinates.x, lat: m.coordinates.y }));
  return json({ matches }, 200, cors);
}

// ---------- Community reports ----------

const reportLimiter = new RateLimiter(10, 60 * 60_000); // 10 report attempts per visitor per hour
const voteLimiter = new RateLimiter(60, 60 * 60_000); // 60 votes per visitor per hour

/** Hash the device's random ID with our secret salt. Only this hash is ever stored. */
async function deviceHash(deviceId: string, env: Env): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.DEVICE_SALT + ':' + deviceId));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Ask Cloudflare whether the Turnstile token is real (the "I'm human" check). */
async function turnstileOk(token: string, request: Request, env: Env): Promise<boolean> {
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, signal: AbortSignal.timeout(10_000) });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

/** Call one of our database functions with the secret key. */
async function rpc(env: Env, fn: string, args: Record<string, unknown>): Promise<{ ok: boolean; data: unknown }> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15_000),
  });
  return { ok: res.ok, data: await res.json().catch(() => null) };
}

/** Turn database error codes into plain words. */
function dbMessage(data: unknown): string {
  const msg = (data as { message?: string } | null)?.message ?? '';
  if (msg.includes('personal_info')) return 'Please remove phone numbers or email addresses from the description.';
  if (msg.includes('rate_limited')) return 'Too many reports from this device. Please wait an hour.';
  if (msg.includes('not_found')) return 'That report is no longer active.';
  return 'The report couldn’t be saved. Please try again later.';
}

async function handleReport(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  if (!reportLimiter.allow(await visitorId(request))) return json({ error: 'Too many reports. Please wait a while and try again.' }, 429, cors);
  const checked = validateReport(await request.json().catch(() => null));
  if (typeof checked === 'string') return json({ error: checked }, 400, cors);
  if (!(await turnstileOk(checked.turnstile_token, request, env))) {
    return json({ error: 'The “I’m human” check didn’t go through. Please try it again.' }, 400, cors);
  }
  const result = await rpc(env, 'submit_report', {
    p_category: checked.category,
    p_lat: checked.lat,
    p_lon: checked.lon,
    p_county_fips: checked.county_fips,
    p_description: checked.description,
    p_device_hash: await deviceHash(checked.device_id, env),
  });
  if (!result.ok) return json({ error: dbMessage(result.data) }, 400, cors);
  return json({ id: result.data }, 201, cors);
}

async function handleVote(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  if (!voteLimiter.allow(await visitorId(request))) return json({ error: 'Too many votes. Please wait a while.' }, 429, cors);
  const checked = validateVote(await request.json().catch(() => null));
  if (typeof checked === 'string') return json({ error: checked }, 400, cors);
  const result = await rpc(env, 'vote_report', {
    p_report_id: checked.report_id,
    p_device_hash: await deviceHash(checked.device_id, env),
    p_kind: checked.kind,
  });
  if (!result.ok) return json({ error: dbMessage(result.data) }, 400, cors);
  return json({ result: result.data }, 200, cors);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);
    // Web pages: only this app's own pages may use the Worker (browsers always send an Origin header,
    // and other websites can't fake it). Requests with NO Origin header come from outside a browser,
    // such as our phone app; they're allowed, because a non-browser program could fake the header
    // anyway. The real protections apply to everyone: the Turnstile check on reports, input checks,
    // and rate limits.
    if (origin !== null && !cors['Access-Control-Allow-Origin']) return json({ error: 'Not allowed.' }, 403, {});
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(request.url);
    if (pathname === '/route' && request.method === 'POST') return handleRoute(request, env, cors);
    if (pathname === '/geocode' && request.method === 'GET') return handleGeocode(request, cors);
    if (pathname === '/report' && request.method === 'POST') return handleReport(request, env, cors);
    if (pathname === '/vote' && request.method === 'POST') return handleVote(request, env, cors);
    return json({ error: 'Not found.' }, 404, cors);
  },
};

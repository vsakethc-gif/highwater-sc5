/**
 * nws.ts — official alerts from the National Weather Service (api.weather.gov).
 *
 * Every alert names the counties it covers with "SAME" codes, which are
 * "0" + the 5-digit county FIPS code (045091 = York County). We use those
 * to decide which county an alert belongs to.
 */
import type { Alert, AlertAction } from './types';

const ALERTS_URL = 'https://api.weather.gov/alerts/active?area=SC';

/** Alert parameters that describe how damaging a storm could be. */
const DAMAGE_THREAT_KEYS = ['tornadoDamageThreat', 'flashFloodDamageThreat', 'thunderstormDamageThreat'];

/**
 * Read the action from a VTEC code like "/O.NEW.KGSP.FF.W.0024.261011T0911Z-261011T1500Z/".
 * The part after "O." says what this message does: NEW, CON (continues), EXT (extends),
 * CAN (cancelled), EXP (expired), and so on. Some alerts (statements) have no VTEC: null.
 */
export function vtecAction(vtec: string | undefined): AlertAction {
  const match = vtec?.match(/^\/[OTEX]\.([A-Z]{3})\./);
  return (match?.[1] as AlertAction) ?? null;
}

/** Cancelled or expired messages say a hazard is OVER, so they must never raise a status. */
export function isEnded(alert: Pick<Alert, 'action' | 'ends'>, now = Date.now()): boolean {
  if (alert.action === 'CAN' || alert.action === 'EXP') return true;
  return alert.ends !== null && Date.parse(alert.ends) < now;
}

/** "045091" -> "45091". Codes that aren't SC-shaped are kept as-is (they never match our counties). */
export function sameToFips(same: string): string {
  return same.length === 6 && same.startsWith('0') ? same.slice(1) : same;
}

interface NwsFeature {
  id: string;
  geometry: GeoJSON.Geometry | null;
  properties: {
    id: string;
    event: string;
    severity: string;
    urgency: string;
    certainty: string;
    headline: string | null;
    description: string | null;
    instruction: string | null;
    sent: string;
    onset: string | null;
    ends: string | null;
    expires: string | null;
    geocode: { SAME?: string[]; UGC?: string[] };
    parameters: Record<string, string[] | undefined>;
  };
}

/** Convert one NWS GeoJSON feature into our Alert shape. */
export function parseAlert(f: NwsFeature): Alert {
  const p = f.properties;
  const damage_threat: Record<string, string> = {};
  for (const key of DAMAGE_THREAT_KEYS) {
    const value = p.parameters[key]?.[0];
    if (value) damage_threat[key] = value;
  }
  return {
    id: p.id,
    event: p.event,
    severity: p.severity,
    urgency: p.urgency,
    certainty: p.certainty,
    headline: p.parameters.NWSheadline?.[0] ?? p.headline ?? p.event,
    description: p.description ?? '',
    instruction: p.instruction ?? '',
    sent: p.sent,
    onset: p.onset,
    ends: p.ends ?? p.expires,
    county_fips: (p.geocode.SAME ?? []).map(sameToFips),
    geometry: f.geometry,
    url: f.id,
    action: vtecAction(p.parameters.VTEC?.[0]),
    damage_threat,
  };
}

/** Parse a whole response, dropping alerts that are cancelled, expired, or already over. */
export function parseAlerts(json: { features: NwsFeature[] }, now = Date.now()): Alert[] {
  return json.features.map(parseAlert).filter((a) => !isEnded(a, now));
}

/** Alerts that cover a given county. */
export function alertsForCounty(alerts: Alert[], fips: string): Alert[] {
  return alerts.filter((a) => a.county_fips.includes(fips));
}

/** Fetch all active alerts for South Carolina. */
export async function fetchActiveAlerts(signal?: AbortSignal): Promise<Alert[]> {
  const res = await fetch(ALERTS_URL, { signal, headers: { Accept: 'application/geo+json' } });
  if (!res.ok) throw new Error(`National Weather Service returned ${res.status}`);
  return parseAlerts(await res.json());
}

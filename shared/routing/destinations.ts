/**
 * destinations.ts — where a route can go (brief 10.1):
 *   - the nearest OPEN shelter (FEMA / American Red Cross National Shelter System), or
 *   - "away from the warning area": the nearest town center outside every active
 *     warning polygon we're avoiding, or
 *   - a place the person chooses.
 */
import { distanceKm, pointInGeometry } from '../geo';
import type { LonLat, PolygonCoords } from './avoid';

const OPEN_SHELTERS = 'https://gis.fema.gov/arcgis/rest/services/NSS/OpenShelters/FeatureServer/0/query';

export interface Shelter {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  status: string;
  capacity: number | null;
  pet_friendly: boolean | null;
  wheelchair: boolean | null;
  org: string;
  /** When we checked: the FEMA layer has no "last updated" field per shelter. */
  checked_at: string;
}

interface ShelterAttrs {
  shelter_id: number;
  shelter_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  shelter_status: string;
  evacuation_capacity: number | null;
  pet_accommodations_code: string | null;
  wheelchair_accessible: string | null;
  org_name: string | null;
  latitude: number;
  longitude: number;
}

const yesNo = (v: string | null): boolean | null => {
  const t = (v ?? '').trim().toUpperCase();
  if (!t) return null;
  if (t.startsWith('Y') || t === 'PETS ALLOWED') return true;
  if (t.startsWith('N')) return false;
  return null;
};

/** Only shelters whose status is exactly OPEN are ever listed as open. */
export function parseShelters(json: { features?: { attributes: ShelterAttrs }[] }, checkedAt: string): Shelter[] {
  return (json.features ?? [])
    .map((f) => f.attributes)
    .filter((a) => a.shelter_status?.toUpperCase() === 'OPEN' && Number.isFinite(a.latitude) && Number.isFinite(a.longitude))
    .map((a) => ({
      id: String(a.shelter_id),
      name: a.shelter_name,
      address: `${a.address}, ${a.city}, ${a.state} ${a.zip}`,
      lat: a.latitude,
      lon: a.longitude,
      status: 'Open',
      capacity: a.evacuation_capacity ?? null,
      pet_friendly: yesNo(a.pet_accommodations_code),
      wheelchair: yesNo(a.wheelchair_accessible),
      org: a.org_name ?? '',
      checked_at: checkedAt,
    }));
}

/** Open shelters in and around SC-5 (a box reaching into neighboring counties). */
export async function fetchOpenShelters(signal?: AbortSignal): Promise<Shelter[]> {
  const params = new URLSearchParams({
    where: "shelter_status='OPEN'",
    geometry: '-82.6,33.6,-79.6,35.6',
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
    f: 'json',
  });
  const res = await fetch(`${OPEN_SHELTERS}?${params}`, { signal });
  if (!res.ok) throw new Error(`FEMA shelters returned ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error('FEMA shelter query failed');
  return parseShelters(json, new Date().toISOString());
}

/** Sort places by straight-line distance from a point. */
export function byDistance<T extends { lat: number; lon: number }>(items: T[], from: LonLat): (T & { km: number })[] {
  return items
    .map((it) => ({ ...it, km: distanceKm(from[1], from[0], it.lat, it.lon) }))
    .sort((a, b) => a.km - b.km);
}

export interface Town {
  name: string;
  lat: number;
  lon: number;
  fips: string;
}

/**
 * "Away from the warning area": the nearest town center that is outside every avoid
 * polygon, at least 3 km from the start (so we don't pick the town you're standing in).
 * Returns null when there are no avoid areas (nothing to get away from) or no town qualifies.
 */
export function awayFromWarning(towns: Town[], start: LonLat, avoid: PolygonCoords[]): (Town & { km: number }) | null {
  if (!avoid.length) return null;
  const outside = towns.filter((t) => !avoid.some((p) => pointInGeometry(t.lon, t.lat, { type: 'Polygon', coordinates: p })));
  return byDistance(outside, start).find((t) => t.km >= 3) ?? null;
}

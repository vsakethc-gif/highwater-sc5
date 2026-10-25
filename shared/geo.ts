/**
 * geo.ts — small geometry helpers, written by hand so the app doesn't need a big library.
 */

type Ring = number[][]; // [[lon, lat], ...]

/**
 * Is the point inside this ring? "Ray casting": imagine a line from the point going
 * straight right. Count how many edges of the shape it crosses. Odd = inside, even = outside.
 */
function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** A polygon is an outer ring plus optional holes. Inside = in the outer ring and not in any hole. */
function inPolygon(lon: number, lat: number, rings: Ring[]): boolean {
  if (!rings.length || !inRing(lon, lat, rings[0])) return false;
  return !rings.slice(1).some((hole) => inRing(lon, lat, hole));
}

export function pointInGeometry(lon: number, lat: number, geometry: GeoJSON.Geometry | null): boolean {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return inPolygon(lon, lat, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((p) => inPolygon(lon, lat, p));
  return false;
}

/** Which feature (e.g. which county) contains the point, or null. */
export function featureAt<P>(
  fc: GeoJSON.FeatureCollection<GeoJSON.Geometry, P>,
  lon: number,
  lat: number,
): GeoJSON.Feature<GeoJSON.Geometry, P> | null {
  return fc.features.find((f) => pointInGeometry(lon, lat, f.geometry)) ?? null;
}

/** Straight-line distance in kilometers between two points (haversine formula). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

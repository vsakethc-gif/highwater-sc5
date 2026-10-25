/**
 * fema.ts — the FEMA flood zone at one point (National Flood Hazard Layer, layer 28).
 *
 * This is long-term flood RISK from FEMA's maps, not current flooding, and not an
 * official determination for a property.
 */

const NFHL_ZONES = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query';

export interface FloodZone {
  /** FEMA zone code, e.g. "AE", "A", "X". */
  zone: string;
  subtype: string | null;
  /** true = Special Flood Hazard Area (the "1% annual chance" high-risk zone). */
  highRisk: boolean;
}

/** Plain-language meaning of a FEMA zone. */
export function describeZone(z: FloodZone): string {
  if (z.subtype?.toUpperCase().includes('FLOODWAY')) return 'High risk: inside the floodway, where floodwater flows fastest.';
  if (z.highRisk) return 'High risk: about a 1% chance of flooding in any year (a 26% chance over a 30-year mortgage).';
  if (z.subtype?.toUpperCase().includes('0.2 PCT')) return 'Moderate risk: about a 0.2% chance of flooding in any year.';
  if (z.zone === 'D') return 'Possible but undetermined flood risk.';
  return 'Lower risk: outside FEMA’s mapped high-risk area. Flooding can still happen here.';
}

export function parseFloodZone(json: { features?: { attributes: Record<string, string | null> }[] }): FloodZone | null {
  const attrs = json.features?.[0]?.attributes;
  if (!attrs?.FLD_ZONE) return null;
  return { zone: attrs.FLD_ZONE, subtype: attrs.ZONE_SUBTY ?? null, highRisk: attrs.SFHA_TF === 'T' };
}

/** null = the point isn't covered by a digital FEMA map. Throws if FEMA can't be reached. */
export async function fetchFloodZone(lat: number, lon: number, signal?: AbortSignal): Promise<FloodZone | null> {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'FLD_ZONE,ZONE_SUBTY,SFHA_TF',
    returnGeometry: 'false',
    f: 'json',
  });
  const res = await fetch(`${NFHL_ZONES}?${params}`, { signal });
  if (!res.ok) throw new Error(`FEMA returned ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error('FEMA flood map query failed');
  return parseFloodZone(json);
}

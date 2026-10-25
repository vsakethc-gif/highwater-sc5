/**
 * static.ts — loads the pre-built data files in /public/data (made by the scripts in /scripts).
 * Each file is loaded once and reused while the app is open. How a file is loaded depends on
 * the app (website or phone), so that part comes from the platform (see platform.ts).
 */
import { scoreTracts, type Tract, type TractRaw } from '../hazards/vulnerability';
import { platform } from '../platform';

export interface CountyProps {
  fips: string;
  name: string;
}
export type CountyCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, CountyProps>;
export type TractCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, Tract> & {
  metadata?: Record<string, string>;
};
/** ZIP code → [lat, lon, county FIPS] */
export type ZipTable = Record<string, [number, number, string]>;

const cache = new Map<string, Promise<unknown>>();

export function loadStatic<T>(file: string): Promise<T> {
  let p = cache.get(file) as Promise<T> | undefined;
  if (!p) {
    p = platform().loadStaticJson(file) as Promise<T>;
    p.catch(() => cache.delete(file)); // allow a retry after a failure
    cache.set(file, p);
  }
  return p;
}

export const loadCounties = () => loadStatic<CountyCollection>('counties.geojson');
export const loadZips = () => loadStatic<ZipTable>('zips.json');

/** Tracts with vulnerability, exposure, and priority scores computed in the browser. */
export async function loadTracts(): Promise<TractCollection> {
  const raw = await loadStatic<GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, TractRaw> & { metadata?: Record<string, string> }>(
    'tracts.geojson',
  );
  const scored = scoreTracts(raw.features.map((f) => f.properties));
  return {
    ...raw,
    features: raw.features.map((f, i) => ({ ...f, properties: scored[i] })),
  };
}

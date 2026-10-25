/**
 * build-zips.mjs — ZIP code center points for SC-5, so ZIP search needs no outside service.
 *
 * Run AFTER build-boundaries.mjs:  node scripts/build-zips.mjs
 *
 * Uses the Census "Gazetteer" file for ZIP Code Tabulation Areas (ZCTAs), which lists
 * a center point for every ZIP area. We keep ZIPs whose center falls inside an SC-5 county.
 * Limitation: a ZIP area can cross county lines; we use the county its center is in.
 *
 * Output: public/data/zips.json  { "29730": [lat, lon, "45091"], ... }
 */
import { readFile, writeFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import * as turf from '@turf/turf';

const URL = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_zcta_national.zip';

async function main() {
  const counties = JSON.parse(await readFile('public/data/counties.geojson', 'utf8'));
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`${res.status} downloading gazetteer`);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const text = strFromU8(Object.values(files)[0]);

  const [header, ...lines] = text.trim().split(/\r?\n/);
  const cols = header.split('\t').map((c) => c.trim());
  const iZip = cols.indexOf('GEOID');
  const iLat = cols.indexOf('INTPTLAT');
  const iLon = cols.indexOf('INTPTLONG');

  const out = {};
  for (const line of lines) {
    const cells = line.split('\t').map((c) => c.trim());
    const zip = cells[iZip];
    if (!zip.startsWith('29')) continue; // South Carolina ZIPs start with 29
    const lat = Number(cells[iLat]);
    const lon = Number(cells[iLon]);
    const pt = turf.point([lon, lat]);
    const county = counties.features.find((c) => turf.booleanPointInPolygon(pt, c));
    if (county) out[zip] = [Math.round(lat * 1e4) / 1e4, Math.round(lon * 1e4) / 1e4, county.properties.fips];
  }
  await writeFile('public/data/zips.json', JSON.stringify(out) + '\n');
  console.log(`Wrote public/data/zips.json (${Object.keys(out).length} ZIP codes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

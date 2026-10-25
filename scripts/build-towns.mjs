/**
 * build-towns.mjs — center points of the incorporated cities and towns in SC-5.
 *
 * Run AFTER build-boundaries.mjs:  node scripts/build-towns.mjs
 *
 * Used for the route planner's "Away from the warning area" choice: the app picks the
 * nearest town center that is outside every active warning area.
 * Source: Census 2024 Gazetteer of places in South Carolina.
 * Output: public/data/towns.json  [{ name, lat, lon, fips }]
 */
import { readFile, writeFile } from 'node:fs/promises';
import * as turf from '@turf/turf';

const URL = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_gaz_place_45.txt';

const counties = JSON.parse(await readFile('public/data/counties.geojson', 'utf8'));
const res = await fetch(URL);
if (!res.ok) throw new Error(`${res.status} downloading places gazetteer`);
const [header, ...lines] = (await res.text()).trim().split(/\r?\n/);
const cols = header.split('\t').map((c) => c.trim());
const col = (name) => cols.indexOf(name);

const towns = [];
for (const line of lines) {
  const cells = line.split('\t').map((c) => c.trim());
  // FUNCSTAT "A" = an active, incorporated city or town (not a census-designated place).
  if (cells[col('FUNCSTAT')] !== 'A') continue;
  const lat = Number(cells[col('INTPTLAT')]);
  const lon = Number(cells[col('INTPTLONG')]);
  const county = counties.features.find((c) => turf.booleanPointInPolygon(turf.point([lon, lat]), c));
  if (!county) continue;
  const name = cells[col('NAME')].replace(/ (city|town)$/, '');
  towns.push({ name, lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4, fips: county.properties.fips });
}
towns.sort((a, b) => a.name.localeCompare(b.name));
await writeFile('public/data/towns.json', JSON.stringify(towns) + '\n');
console.log(`Wrote public/data/towns.json (${towns.length} towns): ${towns.map((t) => t.name).join(', ')}`);

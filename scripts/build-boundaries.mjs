/**
 * build-boundaries.mjs — county and census tract outlines for SC-5.
 *
 * Run with:  node scripts/build-boundaries.mjs
 *
 * 1. Downloads Census "cartographic boundary" files (already generalized for mapping).
 * 2. Keeps only the 8 SC-5 counties and their tracts.
 * 3. Simplifies the shapes with mapshaper so the files stay small for phones,
 *    while keeping neighboring shapes' shared edges lined up.
 * Output: public/data/counties.geojson and scripts/raw/tracts-base.geojson
 * (tracts get Census + FEMA numbers added by build-tracts.mjs).
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import mapshaper from 'mapshaper';

const RAW = 'scripts/raw';
const BASE = 'https://www2.census.gov/geo/tiger/GENZ2024/shp';
const COUNTY_CODES = ['021', '023', '039', '055', '057', '061', '087', '091'];

async function download(file) {
  const path = `${RAW}/${file}`;
  try {
    await access(path);
    return path; // already downloaded
  } catch {
    const res = await fetch(`${BASE}/${file}`);
    if (!res.ok) throw new Error(`${res.status} downloading ${file}`);
    await writeFile(path, Buffer.from(await res.arrayBuffer()));
    console.log(`Downloaded ${file}`);
    return path;
  }
}

async function main() {
  await mkdir(RAW, { recursive: true });
  const tractZip = await download('cb_2024_45_tract_500k.zip');
  const countyZip = await download('cb_2024_us_county_500k.zip');
  const keep = JSON.stringify(COUNTY_CODES);

  // Counties: SC-5 only, simplified, with just the fields we need.
  await mapshaper.runCommands(
    `-i ${countyZip} ` +
      `-filter 'STATEFP === "45" && ${keep}.includes(COUNTYFP)' ` +
      `-each 'fips = GEOID, name = NAME' -filter-fields fips,name ` +
      `-simplify 20% keep-shapes ` +
      `-o public/data/counties.geojson format=geojson precision=0.00001`,
  );

  // Tracts: same counties.
  await mapshaper.runCommands(
    `-i ${tractZip} ` +
      `-filter '${keep}.includes(COUNTYFP)' ` +
      `-each 'geoid = GEOID, county_fips = STATEFP + COUNTYFP, land_m2 = ALAND' -filter-fields geoid,county_fips,land_m2 ` +
      `-simplify 25% keep-shapes ` +
      `-o ${RAW}/tracts-base.geojson format=geojson precision=0.00001`,
  );
  console.log('Wrote public/data/counties.geojson and scripts/raw/tracts-base.geojson');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

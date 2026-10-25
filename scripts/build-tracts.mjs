/**
 * build-tracts.mjs — adds Census and FEMA numbers to each SC-5 census tract.
 *
 * Run AFTER build-boundaries.mjs:  node scripts/build-tracts.mjs
 * Needs CENSUS_API_KEY in the .env file (never committed).
 *
 * For each tract it records raw percentages only:
 *   - Census ACS 5-year (2020–2024): people 65+, households with no vehicle,
 *     people below poverty, people with a disability.
 *   - FEMA flood maps: the share of the tract's area inside the Special Flood
 *     Hazard Area (the "1% annual chance" high-risk zone).
 * The app turns these into scores with tested code in shared/hazards/vulnerability.ts.
 *
 * Output: public/data/tracts.geojson
 */
import { readFile, writeFile } from 'node:fs/promises';
import * as turf from '@turf/turf';

const ACS_YEAR = 2024;
const COUNTY_CODES = ['021', '023', '039', '055', '057', '061', '087', '091'];
const NFHL = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query';
const USER_AGENT = 'Highwater build script (https://github.com/vsakethc-gif/highwater-sc5)';

// ACS variables (labels checked against the Census variables list, see DATA_SOURCES.md)
const AGE_65_PLUS = [20, 21, 22, 23, 24, 25, 44, 45, 46, 47, 48, 49].map((n) => `B01001_0${n}E`);
const DISABILITY = [4, 7, 10, 13, 16, 19, 23, 26, 29, 32, 35, 38].map((n) => `B18101_${String(n).padStart(3, '0')}E`);
const VARS = [
  'B01001_001E', // total population
  ...AGE_65_PLUS,
  'B25044_001E', // households
  'B25044_003E', // owner households, no vehicle
  'B25044_010E', // renter households, no vehicle
  'B17001_001E', // people whose poverty status is known
  'B17001_002E', // people below poverty
  'B18101_001E', // civilian non-institutionalized population (disability universe)
  ...DISABILITY,
];

async function censusKey() {
  if (process.env.CENSUS_API_KEY) return process.env.CENSUS_API_KEY;
  const env = await readFile('.env', 'utf8').catch(() => '');
  const match = env.match(/^CENSUS_API_KEY=(.+)$/m);
  if (!match) throw new Error('CENSUS_API_KEY not found in .env or environment');
  return match[1].trim();
}

/** Percentage, rounded to 1 decimal. null when the group is empty (can't divide by zero). */
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

async function fetchAcs() {
  const key = await censusKey();
  const url =
    `https://api.census.gov/data/${ACS_YEAR}/acs/acs5?get=${VARS.join(',')}` +
    `&for=tract:*&in=state:45&in=county:${COUNTY_CODES.join(',')}&key=${key}`;
  const res = await fetch(url, { redirect: 'manual' });
  if (res.status !== 200) throw new Error(`Census API returned ${res.status} (is the key valid?)`);
  const [header, ...rows] = await res.json();
  const byTract = new Map();
  for (const row of rows) {
    const r = Object.fromEntries(header.map((h, i) => [h, row[i]]));
    // Census uses large negative numbers for "not available"; treat them as 0 for sums.
    const n = (v) => Math.max(0, Number(r[v]) || 0);
    const sum = (vars) => vars.reduce((s, v) => s + n(v), 0);
    const geoid = `${r.state}${r.county}${r.tract}`;
    byTract.set(geoid, {
      population: n('B01001_001E'),
      households: n('B25044_001E'),
      pct_65plus: pct(sum(AGE_65_PLUS), n('B01001_001E')),
      pct_no_vehicle: pct(n('B25044_003E') + n('B25044_010E'), n('B25044_001E')),
      pct_poverty: pct(n('B17001_002E'), n('B17001_001E')),
      pct_disability: pct(sum(DISABILITY), n('B18101_001E')),
    });
  }
  console.log(`ACS ${ACS_YEAR}: ${byTract.size} tracts`);
  return byTract;
}

/** All high-risk (SFHA) flood polygons touching a bounding box, page by page. */
async function fetchSfha(bbox) {
  const features = [];
  for (let offset = 0; ; offset += 1000) {
    const params = new URLSearchParams({
      where: "SFHA_TF='T'",
      geometry: bbox.join(','),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'FLD_ZONE',
      returnGeometry: 'true',
      outSR: '4326',
      maxAllowableOffset: '0.0002', // simplify to about 20 m: plenty for area shares
      geometryPrecision: '5',
      resultOffset: String(offset),
      resultRecordCount: '1000',
      f: 'geojson',
    });
    const res = await fetch(`${NFHL}?${params}`, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`FEMA returned ${res.status}`);
    const page = await res.json();
    if (page.error) throw new Error(`FEMA error: ${JSON.stringify(page.error)}`);
    features.push(...page.features.filter((f) => f.geometry));
    const more = page.exceededTransferLimit || page.properties?.exceededTransferLimit;
    if (!more || page.features.length === 0) break;
  }
  return features;
}

async function main() {
  const tracts = JSON.parse(await readFile('scripts/raw/tracts-base.geojson', 'utf8'));
  const counties = JSON.parse(await readFile('public/data/counties.geojson', 'utf8'));
  const acs = await fetchAcs();

  // Download SFHA polygons county by county (FEMA pages results 1000 at a time).
  const sfha = [];
  const seen = new Set();
  for (const county of counties.features) {
    const polys = await fetchSfha(turf.bbox(county));
    for (const p of polys) {
      const key = JSON.stringify(p.geometry.coordinates[0]?.[0]); // skip polygons shared by two county boxes
      if (seen.has(key)) continue;
      seen.add(key);
      p.bbox = turf.bbox(p);
      sfha.push(p);
    }
    console.log(`${county.properties.name}: ${polys.length} SFHA polygons`);
  }

  // Share of each tract's area inside the SFHA.
  let failures = 0;
  const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
  for (const tract of tracts.features) {
    const tBox = turf.bbox(tract);
    const tractArea = turf.area(tract);
    let floodArea = 0;
    for (const zone of sfha) {
      if (!overlaps(tBox, zone.bbox)) continue;
      try {
        const piece = turf.intersect(turf.featureCollection([tract, zone]));
        if (piece) floodArea += turf.area(piece);
      } catch {
        failures++; // a few FEMA polygons have self-intersections; skip them
      }
    }
    const census = acs.get(tract.properties.geoid) ?? {};
    tract.properties = {
      ...tract.properties,
      ...census,
      pct_sfha: tractArea > 0 ? Math.round(Math.min(1, floodArea / tractArea) * 1000) / 10 : null,
    };
    delete tract.properties.land_m2;
  }
  if (failures) console.log(`Skipped ${failures} invalid FEMA polygon pieces`);

  tracts.metadata = {
    generated_at: new Date().toISOString(),
    acs: `American Community Survey 5-year estimates, ${ACS_YEAR - 4}–${ACS_YEAR}`,
    flood: 'FEMA National Flood Hazard Layer, Special Flood Hazard Area (SFHA_TF = T)',
    boundaries: 'Census cartographic boundary files 2024 (1:500,000)',
  };
  await writeFile('public/data/tracts.geojson', JSON.stringify(tracts));
  console.log(`Wrote public/data/tracts.geojson (${tracts.features.length} tracts)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

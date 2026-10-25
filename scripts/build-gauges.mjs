/**
 * build-gauges.mjs — builds public/data/gauges.json, the list of stream gauges in SC-5.
 *
 * Run with:  node scripts/build-gauges.mjs
 *
 * What it does:
 *   1. Asks USGS for every stream gauge ("ST" site type) in each SC-5 county.
 *   2. Keeps only gauges that reported a water height (gage height) in the last 7 days.
 *   3. Asks NOAA's National Water Prediction Service (NWPS) which gauges have
 *      official flood stages, and links them to the USGS gauges by USGS ID.
 *   4. Saves a small JSON file the app loads instantly.
 *
 * The gauge list changes rarely, so this runs by hand (or occasionally), not on every page view.
 */
import { writeFile } from 'node:fs/promises';

const USER_AGENT = 'Highwater build script (https://github.com/vsakethc-gif/highwater-sc5)';
const USGS = 'https://api.waterdata.usgs.gov/ogcapi/v0/collections';
const NWPS = 'https://api.water.noaa.gov/nwps/v1';

// Keep in sync with COUNTIES in shared/config.ts.
const COUNTIES = {
  '45021': 'Cherokee', '45023': 'Chester', '45039': 'Fairfield', '45055': 'Kershaw',
  '45057': 'Lancaster', '45061': 'Lee', '45087': 'Union', '45091': 'York',
};
const ACTIVE_WITHIN_DAYS = 7;

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** NWPS writes "no value" as -9999 or -999. Turn those into null. */
const realNumber = (n) => (typeof n === 'number' && n > -900 ? n : null);

async function main() {
  // 1. USGS stream gauges per county
  const sites = [];
  for (const [fips, name] of Object.entries(COUNTIES)) {
    const url = `${USGS}/monitoring-locations/items?f=json&state_code=45&county_code=${fips.slice(2)}&site_type_code=ST&limit=500`;
    const data = await getJson(url);
    for (const f of data.features) {
      sites.push({
        site_id: f.properties.monitoring_location_number,
        name: f.properties.monitoring_location_name,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        county_fips: fips,
      });
    }
    console.log(`${name}: ${data.features.length} stream sites`);
  }

  // 2. Which of them reported gage height recently? (one request per batch of 50 sites)
  const cutoff = Date.now() - ACTIVE_WITHIN_DAYS * 24 * 3600 * 1000;
  const active = new Set();
  for (let i = 0; i < sites.length; i += 50) {
    const ids = sites.slice(i, i + 50).map((s) => `USGS-${s.site_id}`).join(',');
    const data = await getJson(`${USGS}/latest-continuous/items?f=json&parameter_code=00065&monitoring_location_id=${ids}&limit=500&skipGeometry=true`);
    for (const f of data.features) {
      if (Date.parse(f.properties.time) >= cutoff) active.add(f.properties.monitoring_location_id.replace('USGS-', ''));
    }
  }
  const gauges = sites.filter((s) => active.has(s.site_id));
  console.log(`${gauges.length} of ${sites.length} sites reported gage height in the last ${ACTIVE_WITHIN_DAYS} days`);

  // 3. Official flood stages from NWPS, matched by USGS ID
  const list = await getJson(`${NWPS}/gauges?bbox.xmin=-81.9&bbox.ymin=33.9&bbox.xmax=-80.1&bbox.ymax=35.3&srid=EPSG_4326`);
  const byUsgs = new Map();
  for (const g of list.gauges) {
    const detail = await getJson(`${NWPS}/gauges/${g.lid}`);
    if (detail.usgsId) byUsgs.set(detail.usgsId, detail);
  }
  for (const g of gauges) {
    const nws = byUsgs.get(g.site_id);
    const c = nws?.flood?.categories;
    const stages = c && {
      action: realNumber(c.action?.stage),
      minor: realNumber(c.minor?.stage),
      moderate: realNumber(c.moderate?.stage),
      major: realNumber(c.major?.stage),
    };
    g.nws_id = nws?.lid ?? null;
    // A gauge "has an official flood stage" only if NOAA defines at least the minor flood stage.
    g.stages = stages && stages.minor !== null ? stages : null;
  }

  gauges.sort((a, b) => a.county_fips.localeCompare(b.county_fips) || a.name.localeCompare(b.name));
  const out = {
    generated_at: new Date().toISOString(),
    sources: ['USGS Water Data API (monitoring-locations, latest-continuous)', 'NOAA NWPS gauges API'],
    gauges,
  };
  await writeFile('public/data/gauges.json', JSON.stringify(out, null, 1) + '\n');
  const official = gauges.filter((g) => g.stages).length;
  console.log(`Wrote public/data/gauges.json: ${gauges.length} gauges, ${official} with official flood stages`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

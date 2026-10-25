/**
 * build-helene.mjs — builds the two Hurricane Helene replays for Scenario Mode
 * from REAL archived data (nothing in them is made up).
 *
 * Run with:  node scripts/build-helene.mjs
 *
 * What it does:
 *   1. Downloads USGS river readings (gage height) for every SC-5 gauge, Sept 25–30, 2024,
 *      plus two USGS rain gauges, from the USGS archive (legacy NWIS service, which keeps history).
 *   2. Downloads every National Weather Service alert issued for South Carolina in 2024 from the
 *      Iowa Environmental Mesonet (IEM) archive, and the full text of each Helene alert for SC-5.
 *   3. For each replay moment, keeps the alerts that were actually in effect at that minute,
 *      using the latest update NWS had sent by then (text, warning area, damage threat tag).
 *   4. Keeps the 12 hours of river readings before that moment, and what the rain gauge
 *      actually measured in the 24 and 48 hours after it.
 *   5. Writes shared/scenario/scenarios/helene-*.json in the same format as the other scenarios.
 *
 * Scenario Mode replays the moment "as if now": every time is shifted so the moment is the present.
 */
import { readFile, writeFile } from 'node:fs/promises';

const USER_AGENT = 'Highwater build script (https://github.com/vsakethc-gif/highwater-sc5)';
const NWIS = 'https://nwis.waterservices.usgs.gov/nwis/iv/';
const IEM = 'https://mesonet.agron.iastate.edu/json';

// Keep in sync with COUNTIES in shared/config.ts.
const COUNTIES = {
  Cherokee: '45021', Chester: '45023', Fairfield: '45039', Kershaw: '45055',
  Lancaster: '45057', Lee: '45061', Union: '45087', York: '45091',
};

// USGS rain gauge used for "how much rain actually fell next": Rocky Creek at SC 901, Chester County.
const RAIN_SITE = '021474750';

const MOMENTS = [
  {
    file: 'helene-arrives.json',
    id: 'helene-arrives',
    at: '2024-09-27T11:30:00Z', // 7:30 AM EDT, Friday Sept 27, 2024
    title: 'Hurricane Helene arrives (real data, Sept 27, 2024)',
    summary:
      'A replay of 7:30 AM on Friday, Sept 27, 2024, as Helene’s remnants crossed SC-5. Real alerts from the National Weather Service archive and real USGS river readings, replayed as if happening now.',
  },
  {
    file: 'helene-rivers-crest.json',
    id: 'helene-rivers-crest',
    at: '2024-09-29T06:30:00Z', // 2:30 AM EDT, Sunday Sept 29, 2024
    title: 'Helene: rivers crest (real data, Sept 29, 2024)',
    summary:
      'A replay of 2:30 AM on Sunday, Sept 29, 2024, two days after the rain stopped, as rivers crested. Real alerts from the National Weather Service archive and real USGS river readings, replayed as if happening now.',
  },
];

const HOURS_OF_READINGS = 12;

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

const ms = (iso) => Date.parse(iso);

// ---------- USGS ----------

async function loadReadings(siteIds) {
  const url =
    `${NWIS}?format=json&sites=${siteIds.join(',')},${RAIN_SITE}&parameterCd=00065,00045` +
    `&startDT=2024-09-25T00:00-04:00&endDT=2024-10-01T00:00-04:00&siteStatus=all`;
  const json = await getJson(url);
  const height = new Map(); // site → [[time ms, feet]]
  let rain = []; // [[time ms, inches in that interval]]
  for (const ts of json.value.timeSeries) {
    const site = ts.sourceInfo.siteCode[0].value;
    const param = ts.variable.variableCode[0].value;
    // USGS writes "no value" as -999999.
    const points = ts.values[0].value.filter((v) => Number(v.value) > -999).map((v) => [ms(v.dateTime), Number(v.value)]);
    if (param === '00065') height.set(site, points);
    if (param === '00045' && site === RAIN_SITE) rain = points;
  }
  return { height, rain };
}

/** Readings in the 12 hours before the moment, one every 15 minutes, as [minutes before, feet]. */
function readingsBefore(points, moment) {
  const start = moment - HOURS_OF_READINGS * 3600_000;
  const out = [];
  for (const [t, v] of points) {
    if (t <= start || t > moment) continue;
    if (new Date(t).getUTCMinutes() % 15 !== 0) continue; // some gauges report every 5 minutes
    out.push([Math.round((t - moment) / 60_000), v]);
  }
  return out;
}

const rainBetween = (rain, from, to) => Math.round(rain.filter(([t]) => t > from && t <= to).reduce((a, [, v]) => a + v, 0) * 100) / 100;

// ---------- NWS alerts (IEM archive) ----------

/** "Northern Lancaster [SC]" → "45057". */
function countiesIn(locations) {
  const out = new Set();
  for (const loc of locations.split(', ')) {
    for (const [name, fips] of Object.entries(COUNTIES)) if (loc.endsWith(`${name} [SC]`)) out.add(fips);
  }
  return [...out];
}

/** VTEC end time "240927T1500Z" → ms, or null for "until further notice" (000000T0000Z). */
function vtecTime(code) {
  if (!code || code.startsWith('000000')) return null;
  const m = code.match(/(\d\d)(\d\d)(\d\d)T(\d\d)(\d\d)Z/);
  return Date.UTC(2000 + Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

/** The part of a product about one of our counties (tropical products have a section per area). */
function segmentFor(text, phen, sig, office, etn) {
  const segments = text.split('$$');
  const tag = `.K${office}.${phen}.${sig}.${String(etn).padStart(4, '0')}.`;
  const ours = segments.filter((s) => s.includes(tag));
  const named = ours.find((s) => Object.keys(COUNTIES).some((c) => new RegExp(`\\n(Northern |Southern )?${c}-`).test(s)));
  return named ?? ours[0] ?? null;
}

function polygonFrom(segment) {
  const block = segment.match(/LAT\.\.\.LON([\s\d]+)/);
  if (!block) return undefined;
  const nums = block[1].trim().split(/\s+/).map(Number);
  const ring = [];
  for (let i = 0; i + 1 < nums.length; i += 2) ring.push([-nums[i + 1] / 100, nums[i] / 100]);
  if (ring.length < 3) return undefined;
  ring.push(ring[0]);
  return ring;
}

/** Plain body text: from the first "*" bullet (or the first paragraph) up to the action section. */
function bodyFrom(segment) {
  const start = segment.search(/\n\* /);
  let body = segment.slice(start >= 0 ? start + 1 : 0);
  body = body.split(/PRECAUTIONARY\/PREPAREDNESS ACTIONS|\n&&|\nLAT\.\.\.LON/)[0];
  return tidy(body, 1600);
}

function instructionFrom(segment) {
  const m = segment.match(/PRECAUTIONARY\/PREPAREDNESS ACTIONS\.{0,3}:?\s*([\s\S]*?)(\n&&|\n\* |\nLAT\.\.\.LON|$)/);
  return m ? tidy(m[1], 700) : '';
}

/** Join wrapped lines into paragraphs and cut long text at a sentence. */
function tidy(text, max) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
  let out = paragraphs.join('\n\n');
  if (out.length > max) out = out.slice(0, out.lastIndexOf('.', max) + 1) + ' […]';
  return out;
}

function damageThreat(segment) {
  const threat = {};
  const ff = segment.match(/FLASH FLOOD DAMAGE THREAT\.\.\.(\w+)/);
  const to = segment.match(/TORNADO DAMAGE THREAT\.\.\.(\w+)/);
  if (ff) threat.flashFloodDamageThreat = ff[1];
  if (to) threat.tornadoDamageThreat = to[1];
  return Object.keys(threat).length ? threat : undefined;
}

const localTime = (t) =>
  new Date(t).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

async function alertsAt(events, moment) {
  const out = [];
  for (const e of events) {
    if (ms(e.issue) > moment || ms(e.expire) <= moment) continue;
    const fips = countiesIn(e.locations);
    if (!fips.length) continue;
    const detail = await getJson(
      `${IEM}/vtec_event.py?wfo=${e.wfo}&year=2024&phenomena=${e.phenomena}&significance=${e.significance}&etn=${e.eventid}`,
    );
    // Every message NWS sent for this alert, oldest first; keep the latest one sent by the moment.
    const messages = [{ text: detail.report.text, valid: detail.utc_issue }, ...detail.svs.map((s) => ({ text: s.text, valid: s.valid }))]
      .filter((m) => ms(m.valid.endsWith('Z') ? m.valid : `${m.valid}Z`) <= moment)
      .sort((a, b) => ms(a.valid) - ms(b.valid));
    let latest = null;
    let segment = null;
    for (const m of messages) {
      const s = segmentFor(m.text, e.phenomena, e.significance, e.wfo, e.eventid);
      if (s) {
        latest = m;
        segment = s;
      }
    }
    if (!segment) continue;
    // Match this exact alert number: one product can also cancel or extend other alerts.
    const etn = String(e.eventid).padStart(4, '0');
    const vtec = segment.match(new RegExp(`/O\\.(\\w+)\\.K${e.wfo}\\.${e.phenomena}\\.${e.significance}\\.${etn}\\.\\w+-(\\w+)/`));
    if (vtec && ['CAN', 'EXP'].includes(vtec[1])) continue; // cancelled or expired by then: not in effect
    const ends = vtecTime(vtec?.[2]) ?? ms(e.expire);
    if (ends <= moment) continue;

    const event = `${e.ph_name} ${e.sig_name}`;
    const office = e.wfo === 'GSP' ? 'Greenville-Spartanburg' : 'Columbia';
    out.push({
      event,
      headline: `${event.toUpperCase()} issued ${localTime(ms(e.issue))} by NWS ${office} (latest update ${localTime(ms(latest.valid))})`,
      description: `REPLAY of a real alert from the NWS archive (Iowa Environmental Mesonet). This alert was in effect on ${localTime(moment)}.\n\n${bodyFrom(segment)}`,
      instruction: instructionFrom(segment),
      county_fips: fips,
      ...(damageThreat(segment) ? { damage_threat: damageThreat(segment) } : {}),
      ...(polygonFrom(segment) ? { polygon: polygonFrom(segment) } : {}),
      startOffsetMin: Math.round((ms(e.issue) - moment) / 60_000),
      endOffsetMin: Math.round((ends - moment) / 60_000),
    });
  }
  return out;
}

async function main() {
  const gaugeFile = JSON.parse(await readFile(new URL('../public/data/gauges.json', import.meta.url), 'utf8'));
  const sites = gaugeFile.gauges ?? gaugeFile;
  console.log(`Downloading USGS readings for ${sites.length} gauges...`);
  const { height, rain } = await loadReadings(sites.map((s) => s.site_id));

  console.log('Downloading the NWS alert list for South Carolina, 2024 (IEM)...');
  const all = (await getJson(`${IEM}/vtec_events_bystate.py?state=SC&year=2024`)).events;
  const helene = all.filter((e) => e.issue < '2024-10-01' && e.expire > '2024-09-24');

  for (const m of MOMENTS) {
    const moment = ms(m.at);
    const alerts = await alertsAt(helene, moment);
    const gauges = {};
    for (const s of sites) gauges[s.site_id] = { readings: readingsBefore(height.get(s.site_id) ?? [], moment) };
    const scenario = {
      id: m.id,
      title: m.title,
      summary: m.summary,
      county: COUNTIES.York,
      replay: {
        moment: m.at,
        note: `Rain: what a USGS rain gauge in Chester County actually measured in the 24 and 48 hours after this moment (forecasts from that time aren’t archived in a form the app can use). Gauges with no archived reading show as offline.`,
      },
      alerts,
      gauges,
      rain: { next24h_in: rainBetween(rain, moment, moment + 24 * 3600_000), next48h_in: rainBetween(rain, moment, moment + 48 * 3600_000) },
    };
    await writeFile(new URL(`../shared/scenario/scenarios/${m.file}`, import.meta.url), JSON.stringify(scenario, null, 1) + '\n');
    const withData = Object.values(gauges).filter((g) => g.readings.length).length;
    console.log(`${m.file}: ${alerts.length} alerts in effect, ${withData}/${sites.length} gauges with readings, rain next 24h ${scenario.rain.next24h_in} in`);
    for (const a of alerts) console.log(`   ${a.event} | ${a.county_fips.join(',')}${a.damage_threat ? ' | ' + JSON.stringify(a.damage_threat) : ''}${a.polygon ? ' | polygon' : ''}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

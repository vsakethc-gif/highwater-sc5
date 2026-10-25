/**
 * status.ts — the home screen: "What's going on here, and what should I do?" (brief 12.1, 12.5)
 *
 * Flow: pick a place → load alerts, gauges, rain (live or simulated) → run the
 * hazard engine → show the status card, why, guidance, and the underlying data.
 */
import { APP_NAME, COUNTIES, FEATURES } from '../../shared/config';
import { h } from '../lib/dom';
import { dataOrNull, loadConditions } from '../../shared/data/conditions';
import { describeZone, fetchFloodZone, type FloodZone } from '../../shared/data/fema';
import type { Alert, Gauge, Loaded } from '../../shared/data/types';
import { guidanceFor, routeAllowed } from '../../shared/guidance/guidance';
import { alertAppliesTo, evaluate } from '../../shared/hazards/engine';
import { LEVELS } from '../../shared/hazards/levels';
import type { OverallStatus, Place } from '../../shared/hazards/types';
import { districtAverage, scoreBand, type Tract } from '../../shared/hazards/vulnerability';
import { findScenario } from '../../shared/scenario/scenario';
import { countyName, getState, placeLabel, subscribe } from '../lib/state';
import { checksList, guidanceContext } from '../../shared/statusContext';
import { clockTime, dateTime, relativeTime } from '../../shared/time';
import { alertRow } from '../components/alertRow';
import { gaugeRow } from '../components/gaugeRow';
import { guidanceBlock } from '../components/guidanceBlock';
import { icon } from '../components/icon';
import { pageShell } from '../components/layout';
import { locationBar } from '../components/locationBar';
import { rainCard } from '../components/rainCard';
import { otherHazards, statusCard, whyStatus } from '../components/statusCard';

const REFRESH_MS = 10 * 60_000;

// ---------- small helpers ----------

function skeleton(rows: number, tall = false): HTMLElement {
  return h(
    'ul',
    { class: 'skeleton-list', 'aria-hidden': 'true' },
    ...Array.from({ length: rows }, () => h('li', { class: `skeleton${tall ? ' skeleton--tall' : ''}` })),
  );
}

function section(id: string, title: string, ...children: (Node | null)[]): HTMLElement {
  return h('section', { class: 'section', 'aria-labelledby': id }, h('h2', { id, class: 'section__title' }, title), ...children);
}

function errorBox(title: string, detail: string): HTMLElement {
  return h(
    'div',
    { class: 'notice notice--error', role: 'alert' },
    icon('CloudOff'),
    h('div', {}, h('p', { class: 'notice__title' }, title), h('p', {}, detail)),
  );
}

function sourceLine(loaded: Loaded<unknown>, extra?: string): HTMLElement {
  return h('p', { class: 'meta source-line' }, `Checked ${clockTime(loaded.fetched_at)} · Source: ${loaded.source}`, extra ? ` · ${extra}` : '');
}

/** "This spot" (point views) or "People in this county" (county views). */
function placeFacts(place: Place, zone: FloodZone | null | undefined | Error, tract: Tract | null, tracts: Tract[]): HTMLElement | null {
  const rows: HTMLElement[] = [];
  if (place.kind === 'point') {
    rows.push(
      h(
        'div',
        { class: 'fact' },
        h('p', { class: 'fact__label' }, 'FEMA flood zone at this spot'),
        zone instanceof Error
          ? h('p', {}, 'Couldn’t reach FEMA’s flood map right now.')
          : zone === undefined
            ? h('p', { class: 'meta' }, 'Checking…')
            : zone === null
              ? h('p', {}, 'No digital FEMA flood map covers this spot.')
              : h('div', {}, h('p', { class: 'fact__value' }, `Zone ${zone.zone}`), h('p', {}, describeZone(zone))),
        h('p', { class: 'meta' }, 'Long-term flood risk from FEMA maps, not current flooding, and not an official determination for a property.'),
      ),
    );
  }
  const avg = (m: 'pct_65plus' | 'pct_no_vehicle' | 'pct_poverty') => districtAverage(tracts, m);
  const inCounty = tracts.filter((t) => t.county_fips === place.fips);
  const subject = place.kind === 'point' ? tract : null;
  const measure = (label: string, key: 'pct_65plus' | 'pct_no_vehicle' | 'pct_poverty', weight: 'population' | 'households' = 'population') => {
    const here = subject ? subject[key] : districtAverage(inCounty, key, weight);
    return h(
      'tr',
      {},
      h('th', { scope: 'row' }, label),
      h('td', { class: 'num' }, here === null ? '—' : `${here.toFixed(1)}%`),
      h('td', { class: 'num' }, `${avg(key).toFixed(1)}%`),
    );
  };
  if (tracts.length && (place.kind === 'county' || tract)) {
    rows.push(
      h(
        'div',
        { class: 'fact' },
        h('p', { class: 'fact__label' }, place.kind === 'point' ? 'People in this neighborhood (census tract)' : `People in ${countyName(place.fips)} County`),
        h(
          'table',
          { class: 'data-table' },
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Measure'), h('th', { scope: 'col' }, 'Here'), h('th', { scope: 'col' }, 'SC-5 average'))),
          h(
            'tbody',
            {},
            measure('Age 65 and older', 'pct_65plus'),
            measure('Households without a car', 'pct_no_vehicle', 'households'),
            measure('Below the poverty line', 'pct_poverty'),
          ),
        ),
        subject
          ? h('p', {}, `Vulnerability score: ${subject.vulnerability_score ?? '—'} (${scoreBand(subject.vulnerability_score)}) · Flood-zone share: ${subject.pct_sfha ?? '—'}%`)
          : null,
        h('p', { class: 'meta' }, 'Census ACS 2020–2024 estimates. Small areas have margins of error. See the district map for every neighborhood.'),
      ),
    );
  }
  if (!rows.length) return null;
  return section('facts-title', place.kind === 'point' ? 'About this spot' : 'About this county', h('div', { class: 'fact-grid' }, ...rows));
}

function gaugesSection(place: Place, gauges: Loaded<Gauge[]> | Error): HTMLElement {
  const county = `${countyName(place.fips)} County`;
  const intro = h(
    'p',
    { class: 'section__intro prose' },
    h('strong', {}, 'Gage height'),
    ' is how high the water surface is at a USGS gauge, in feet. ',
    h('strong', {}, 'Flood stage'),
    ' is the height where the National Weather Service says flooding begins at that spot. Some small creeks have no official flood stage.',
  );
  if (gauges instanceof Error) {
    return section('gauges-title', `Rivers and streams in ${county}`, intro, errorBox('Couldn’t load river levels from USGS.', 'Alerts may still be working. You can also check waterdata.usgs.gov.'));
  }
  const list = gauges.data.filter((g) => g.county_fips === place.fips);
  if (!list.length) {
    return section('gauges-title', `Rivers and streams in ${county}`, intro, h('p', { class: 'empty-state' }, icon('Waves'), `There are no active USGS stream gauges in ${county}.`));
  }
  const rank = { major: 4, moderate: 3, minor: 2, action: 1 } as const;
  list.sort((a, b) => (b.flood_category ? rank[b.flood_category] : 0) - (a.flood_category ? rank[a.flood_category] : 0) || a.name.localeCompare(b.name));
  return section(
    'gauges-title',
    `Rivers and streams in ${county}`,
    intro,
    h('ul', { class: 'gauge-list' }, ...list.map(gaugeRow)),
    sourceLine(gauges, gauges.source.startsWith('Scenario') ? 'Simulated readings.' : 'Provisional data: USGS may revise these readings.'),
  );
}

function alertsSection(place: Place, alerts: Loaded<Alert[]> | Error, here: Alert[] | null): HTMLElement {
  if (alerts instanceof Error || here === null) {
    return section('alerts-title', 'Official alerts', errorBox('Couldn’t load alerts from the National Weather Service.', 'Check official alerts at weather.gov/alerts.'));
  }
  return section(
    'alerts-title',
    'Official alerts',
    here.length
      ? h('ul', { class: 'alert-list' }, ...here.map(alertRow))
      : h('p', { class: 'empty-state' }, icon('CircleCheck'), `No active National Weather Service alerts for ${placeLabel(place)} right now.`),
    sourceLine(alerts),
  );
}

// ---------- page ----------

export function renderStatus(root: HTMLElement): () => void {
  let controller: AbortController | null = null;
  let lastAnnounced = '';
  const live = h('div', { class: 'visually-hidden', 'aria-live': 'polite' });

  async function draw(): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    const { place, scenario } = getState();
    const label = placeLabel(place);
    document.title = `${label} · ${APP_NAME}`;

    const statusSlot = h('div', { class: 'status-layout__status', 'aria-busy': 'true' }, skeleton(1, true));
    const bodySlot = h('div', { class: 'status-layout__body' }, skeleton(3));
    // On wide screens the live data (alerts, rain, rivers) sits in a column beside the advice.
    const asideSlot = h('div', { class: 'status-layout__aside' }, skeleton(3));
    const main = h(
      'main',
      { id: 'main', class: 'container' },
      h(
        'section',
        { class: 'page-intro', 'aria-labelledby': 'place-title' },
        h('p', { class: 'eyebrow' }, 'Hazard status'),
        h('h1', { id: 'place-title', class: 'page-title' }, label),
        place.kind === 'point' ? h('p', { class: 'meta' }, `In ${countyName(place.fips)} County`) : null,
        locationBar(),
      ),
      h('div', { class: 'status-layout' }, statusSlot, bodySlot, asideSlot),
      live,
    );
    root.replaceChildren(...pageShell('status', main));

    // FEMA's flood zone for a point loads alongside the rest, but FEMA can be slow.
    // The status never waits more than 4 seconds for it; a late answer is filled in when it arrives.
    const zoneJob: Promise<FloodZone | null | Error> =
      place.kind === 'point' && !scenario ? fetchFloodZone(place.lat, place.lon, signal).catch((e: Error) => e) : Promise.resolve(null);
    const PENDING = Symbol('pending');
    const zoneOrPending = Promise.race([zoneJob, new Promise<typeof PENDING>((r) => setTimeout(() => r(PENDING), 4000))]);

    const [c, firstZone] = await Promise.all([loadConditions(place, scenario, { signal }), zoneOrPending]);
    if (signal.aborted) return;

    const alerts = dataOrNull(c.alerts);
    const alertsHere = alerts ? alerts.filter((a) => alertAppliesTo(a, place)) : null;
    const evaluated: OverallStatus = evaluate({ alerts, gauges: dataOrNull(c.gauges), rain: dataOrNull(c.rain), now: Date.now() }, place);
    // A status built from the saved offline copy is never complete, so it can never be an all-clear.
    const overall: OverallStatus = c.savedAt
      ? {
          ...evaluated,
          complete: false,
          gaps: [`Offline: showing info saved ${relativeTime(c.savedAt)} (${dateTime(c.savedAt)}). It may be out of date.`, ...evaluated.gaps],
        }
      : evaluated;
    const updatedAt = new Date().toISOString();
    const seat = COUNTIES.find((x) => x.fips === place.fips)?.seat.name ?? 'the county seat';

    /** Draw everything that depends on the flood zone (guidance can change if the spot is high-risk). */
    async function drawWithZone(zone: FloodZone | null | undefined | Error): Promise<void> {
      const { ctx, tract, tracts } = await guidanceContext(place, zone instanceof Error ? null : zone);
      if (signal.aborted) return;
      const statuses = overall.active.length ? overall.active : overall.all.filter((s) => s.hazard === 'flood');
      const blocks = statuses.map((s) => guidanceFor(s, ctx));
      const top = blocks[0];

      const offlineNote = c.savedAt
        ? h(
            'div',
            { class: 'offline-note', role: 'status' },
            icon('CloudOff'),
            h('p', {}, h('strong', {}, `Offline: showing info from ${dateTime(c.savedAt)}. `), 'Live data can’t update right now. Check again when you have signal.'),
          )
        : null;
      statusSlot.replaceChildren(
        offlineNote ?? '',
        statusCard({ overall, top, placeName: label, updatedAt, simulated: c.simulated, live: !c.simulated && !c.savedAt && overall.complete }),
        otherHazards(overall.active) ?? '',
        whyStatus(overall, checksList(place, c, alertsHere)),
      );
      statusSlot.setAttribute('aria-busy', 'false');

      const routeLine =
        FEATURES.routePlanner && routeAllowed(blocks)
          ? h('a', { class: 'button button--primary', href: '#/route' }, 'Plan a lower-exposure route')
          : null;

      bodySlot.replaceChildren(
        h(
          'div',
          { class: 'quick-actions' },
          routeLine,
          h('a', { class: 'button button--secondary', href: '#/map' }, icon('Map'), 'Open district map'),
          FEATURES.reports ? h('a', { class: 'button button--secondary', href: '#/report' }, icon('Megaphone'), 'Report a problem') : null,
        ),
        guidanceBlock(top),
      );
      asideSlot.replaceChildren(
        placeFacts(place, zone, tract, tracts) ?? '',
        alertsSection(place, c.alerts, alertsHere),
        section('rain-title', 'Rain forecast', rainCard(c.rain, place.kind === 'point' ? 'this spot' : `${seat} (county seat)`)),
        gaugesSection(place, c.gauges),
      );
    }

    await drawWithZone(firstZone === PENDING ? undefined : firstZone);
    // Announce the status to screen readers when it changes (brief 14).
    const announcement = !overall.complete && overall.level === 0
      ? `Status for ${label}: can't confirm conditions right now.`
      : `Status for ${label}: ${LEVELS[overall.level].name}.${c.simulated ? ' Simulation.' : ''}`;
    if (announcement !== lastAnnounced) {
      live.textContent = announcement;
      lastAnnounced = announcement;
    }

    if (firstZone === PENDING) {
      const lateZone = await zoneJob;
      if (!signal.aborted) await drawWithZone(lateZone);
    }
  }

  void draw();
  const unsubscribe = subscribe(() => void draw());
  const timer = window.setInterval(() => {
    if (!findScenario(getState().scenario)) void draw();
  }, REFRESH_MS);

  return () => {
    controller?.abort();
    unsubscribe();
    window.clearInterval(timer);
  };
}


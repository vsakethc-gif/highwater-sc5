/**
 * route.ts — the lower-exposure route planner (brief, section 10).
 *
 * Wording rules (brief 10.3): it's a "lower-exposure route", never a "safe route".
 * A persistent notice reminds people that routes can't see every closed or flooded road.
 * During a shelter-in-place hazard (tornado, severe storm, extreme cold...), the planner is
 * hidden and the page tells people to take shelter instead.
 */
import { APP_NAME, COUNTY_EM, FEATURES, SCEMD_COUNTY_DIRECTORY } from '../../shared/config';
import { fetchReports, reportsAvailable, simulatedReports, type Report } from '../../shared/reports/client';
import { append, h } from '../lib/dom';
import { dataOrNull, loadConditions } from '../../shared/data/conditions';
import type { Alert } from '../../shared/data/types';
import { loadCounties } from '../../shared/data/static';
import { featureAt } from '../../shared/geo';
import { guidanceFor } from '../../shared/guidance/guidance';
import { alertAppliesTo, evaluate } from '../../shared/hazards/engine';
import { HAZARDS } from '../../shared/hazards/hazards';
import { buildAvoidPlan, type LonLat, type PolygonCoords } from '../../shared/routing/avoid';
import { awayFromWarning, byDistance, fetchOpenShelters, type Shelter, type Town } from '../../shared/routing/destinations';
import { appleMapsLink, googleMapsLink } from '../../shared/routing/links';
import { planRoutes, type RoutePlan, type RouteResult } from '../../shared/routing/plan';
import { FLOOD_ZONE_PENALTY_MIN, ALERT_AREA_PENALTY_MIN, MILES_INSIDE_PENALTY, DIP_PENALTY_MIN, formatDuration, formatMiles } from '../../shared/routing/score';
import { countyName, getState } from '../lib/state';
import { dateTime, clockTime } from '../../shared/time';
import { icon } from '../components/icon';
import { pageShell } from '../components/layout';
import { placeSearch } from '../components/placeSearch';
import type { RouteMap } from '../components/routeMap';
import '../styles/route.css';

const SAFETY_NOTICE =
  'Routes can’t see every closed or flooded road. Never drive through water. If officials give evacuation directions, follow theirs instead. Call 911 if you are in danger.';

interface Spot {
  point: LonLat;
  label: string;
}

type DestinationChoice = 'shelter' | 'away' | 'place';

// ---------- small pieces ----------

/** Replace an element's contents, skipping empty (null) pieces. */
function fill(el: HTMLElement, ...children: (Node | string | null)[]): void {
  el.replaceChildren();
  append(el, children);
}

function safetyNotice(): HTMLElement {
  return h(
    'div',
    { class: 'safety-notice', role: 'note' },
    icon('TriangleAlert'),
    h('p', {}, h('strong', {}, 'Before you go: '), SAFETY_NOTICE, ' ', h('a', { href: 'tel:911' }, 'Call 911')),
  );
}

/** Shown instead of the planner when the right advice is to stay put. */
function shelterInstead(hazardLabel: string): HTMLElement {
  return h(
    'section',
    { class: 'callout callout--shelter route-blocked', 'aria-labelledby': 'blocked-title' },
    icon('House'),
    h(
      'div',
      {},
      h('h2', { id: 'blocked-title', class: 'subsection-title' }, 'Stay where you are and take shelter'),
      h(
        'p',
        {},
        `There is an active ${hazardLabel.toLowerCase()} warning here. For this kind of danger, driving puts you at more risk than staying in a sturdy building, so the route planner is turned off until it ends.`,
      ),
      h('p', {}, h('a', { class: 'button button--primary', href: '#/' }, 'See what to do now')),
    ),
  );
}

function shelterCard(s: Shelter & { km: number }, onChoose: () => void): HTMLElement {
  const choose = h('button', { class: 'button button--secondary', type: 'button' }, 'Route here');
  choose.addEventListener('click', onChoose);
  const facts = [
    s.capacity ? `Room for about ${s.capacity}` : null,
    s.pet_friendly === true ? 'Pets allowed' : s.pet_friendly === false ? 'No pets (service animals usually allowed)' : 'Pet policy not listed',
    s.wheelchair === true ? 'Wheelchair accessible' : null,
  ].filter(Boolean);
  return h(
    'li',
    { class: 'shelter-card' },
    h('div', {}, h('p', { class: 'shelter-card__name' }, s.name), h('p', {}, s.address), h('p', { class: 'meta' }, `${s.km.toFixed(1)} km away (straight line) · ${facts.join(' · ')}`)),
    choose,
  );
}

function routeCard(r: RouteResult, fastest: RouteResult, start: LonLat, end: LonLat, selected: boolean, onSelect: () => void): HTMLElement {
  const extra = Math.round((r.duration_s - fastest.duration_s) / 60);
  const show = h('button', { class: 'button button--secondary', type: 'button', 'aria-pressed': String(selected) }, selected ? 'Shown on map' : 'Show on map');
  show.addEventListener('click', onSelect);
  return h(
    'li',
    { class: `route-card${selected ? ' is-selected' : ''}${r.isLowestExposure ? ' is-recommended' : ''}` },
    h(
      'div',
      { class: 'route-card__head' },
      h('h3', { class: 'route-card__label' }, r.label),
      h('p', { class: 'route-card__time num' }, formatDuration(r.duration_s), h('span', { class: 'meta' }, ` · ${formatMiles(r.distance_m)}`)),
    ),
    h(
      'dl',
      { class: 'route-facts' },
      h('dt', {}, 'Compared with fastest'),
      h('dd', { class: 'num' }, r.isFastest ? 'This is the fastest' : `${extra} min longer`),
      h('dt', {}, 'Active warning areas entered'),
      h('dd', {}, r.alert_area_intersections === 0 ? 'Doesn’t enter any we know about' : `Enters ${r.alert_area_intersections}`),
      h('dt', {}, 'Miles inside warning areas'),
      h('dd', { class: 'num' }, r.miles_in_warning.toFixed(1)),
      h('dt', {}, 'Unverified reports nearby'),
      h('dd', {}, r.nearby_unverified_reports ? `${r.nearby_unverified_reports} (flooded road, tree, or power line)` : 'None'),
      h('dt', {}, 'FEMA high-risk flood zones crossed'),
      h('dd', { class: 'num' }, r.flood_zone_crossings === null ? 'Couldn’t check' : String(r.flood_zone_crossings)),
      h('dt', {}, 'Low dips (creek and river valleys)'),
      h('dd', { class: 'num' }, r.elevation ? String(r.elevation.dips) : 'Not available'),
      h('dt', {}, 'Lowest point on the route'),
      h('dd', { class: 'num' }, r.elevation ? `${r.elevation.lowest_ft} ft, ${r.elevation.lowest_at_mi.toFixed(1)} mi in` : 'Not available'),
    ),
    r.avoided_areas.length ? h('p', { class: 'meta' }, `Asked to go around: ${[...new Set(r.avoided_areas)].join(', ')}.`) : null,
    r.warnings.length ? h('ul', { class: 'route-card__warnings' }, ...r.warnings.map((w) => h('li', {}, icon('TriangleAlert'), w))) : null,
    h(
      'details',
      { class: 'route-steps' },
      h('summary', {}, icon('ChevronDown'), `Turn-by-turn directions (${r.steps.length} steps)`),
      h('ol', {}, ...r.steps.map((s) => h('li', {}, s.instruction, h('span', { class: 'meta num' }, ` · ${formatMiles(s.distance_m)}`)))),
    ),
    h(
      'div',
      { class: 'route-card__actions no-print' },
      show,
      h('a', { class: 'button button--text', href: googleMapsLink(start, end), rel: 'noopener', target: '_blank' }, 'Google Maps ', icon('ExternalLink')),
      h('a', { class: 'button button--text', href: appleMapsLink(start, end), rel: 'noopener', target: '_blank' }, 'Apple Maps ', icon('ExternalLink')),
    ),
  );
}

// ---------- page ----------

export function renderRoute(root: HTMLElement): () => void {
  document.title = `Lower-exposure route · ${APP_NAME}`;
  const { place, scenario } = getState();
  let routeMap: RouteMap | null = null;
  let cancelled = false;
  let controller: AbortController | null = null;

  let start: Spot | null = place.kind === 'point' ? { point: [place.lon, place.lat], label: place.label } : null;
  let destination: Spot | null = null;
  let choice: DestinationChoice = 'shelter';
  let tapTarget: 'start' | 'destination' = start ? 'destination' : 'start';
  let alerts: Alert[] = [];
  let alertsFetchedAt = '';
  let shelters: Shelter[] | Error | null = null;
  let towns: Town[] = [];
  let plan: RoutePlan | null = null;
  let selected: string | null = null;
  /** Unverified community reports (flooded roads, trees, power lines) for the route cards and avoid areas. */
  let communityReports: Report[] = [];
  const avoidFloodedBox = h('input', { type: 'checkbox', id: 'avoid-flooded', checked: true });
  /** true once the person picks a destination option themselves (we then stop choosing for them). */
  let userChose = false;

  const message = h('p', { class: 'route-message', 'aria-live': 'polite' });
  const say = (t: string) => (message.textContent = t);
  const startLabel = h('p', { class: 'spot-label' });
  const destLabel = h('p', { class: 'spot-label' });
  const destOptions = h('div', { class: 'dest-options' });
  const resultsSlot = h('div', { 'aria-live': 'polite' });
  const timestamps = h('p', { class: 'meta' });
  const planButton = h('button', { class: 'button button--primary', type: 'button' }, 'Plan routes');
  const mapEl = h('div', { class: 'route-map', role: 'region', 'aria-label': 'Route map. Route details are listed below the map.' });
  const tapHint = h('p', { class: 'meta' });

  // The map library is large (about 300 KB compressed), so the map loads only when it's needed:
  // when someone taps "Show map", chooses to tap the map, or gets routes. This keeps the page fast on slow phones.
  let avoidPolygons: PolygonCoords[] = [];
  // routeMap is filled in later by ensureMap(); reading it through this helper keeps TypeScript from assuming it is still null.
  const mapNow = (): RouteMap | null => routeMap;
  let mapLoading: Promise<RouteMap | null> | null = null;
  const showMap = h('button', { class: 'button button--secondary', type: 'button' }, icon('Map'), 'Show map');
  showMap.addEventListener('click', () => void ensureMap());
  mapEl.append(
    h('div', { class: 'route-map__placeholder' }, h('p', {}, 'The map loads when you need it, to save data on slow connections.'), showMap),
  );

  function ensureMap(): Promise<RouteMap | null> {
    mapLoading ??= (async () => {
      showMap.setAttribute('disabled', '');
      showMap.lastChild!.textContent = 'Loading map…';
      const { createRouteMap } = await import('../components/routeMap');
      if (cancelled) return null;
      mapEl.replaceChildren();
      const m = createRouteMap(mapEl);
      m.setAvoid(avoidPolygons);
      m.onTap(onMapTap);
      if (Array.isArray(shelters)) m.setShelters(shelters);
      if (plan) m.setRoutes(plan.routes, selected);
      routeMap = m;
      refreshLabels(); // draws the start and destination pins
      return m;
    })();
    return mapLoading;
  }

  async function onMapTap(point: [number, number]): Promise<void> {
    const county = featureAt(await loadCounties(), point[0], point[1]);
    const label = `Map point${county ? ` in ${county.properties.name} County` : ''}`;
    if (tapTarget === 'start') setStart({ point, label });
    else {
      choice = 'place';
      renderDestOptions();
      setDestination({ point, label });
    }
  }

  function refreshLabels(): void {
    startLabel.textContent = start ? `Start: ${start.label}` : 'Start: not set yet';
    destLabel.textContent = destination ? `Destination: ${destination.label}` : 'Destination: not set yet';
    tapHint.textContent = `Tapping the map sets your ${tapTarget}.`;
    planButton.toggleAttribute('disabled', !(start && destination && alertsReady));
    routeMap?.setPoints(start?.point ?? null, destination?.point ?? null);
  }

  /** ZIP or address search (shared component), reporting through this page's message line. */
  const search = (id: string, label: string, onFound: (s: Spot) => void) =>
    placeSearch(id, label, (p) => onFound({ point: [p.lon, p.lat], label: p.label }), say);

  function setStart(s: Spot): void {
    start = s;
    tapTarget = 'destination';
    if (choice !== 'place') chooseDestination(choice);
    refreshLabels();
  }

  function setDestination(s: Spot): void {
    destination = s;
    refreshLabels();
  }

  /** Fill in the destination for the chosen option, and explain when it isn't possible. */
  function chooseDestination(c: DestinationChoice): void {
    choice = c;
    destination = null;
    if (c === 'shelter') {
      if (shelters instanceof Error) say('Couldn’t load the shelter list from FEMA. Check with your county emergency management office.');
      else if (shelters && shelters.length && start) {
        const near = byDistance(shelters, start.point)[0];
        destination = { point: [near.lon, near.lat], label: `${near.name} (open shelter)` };
      }
    } else if (c === 'away') {
      const avoid = buildAvoidPlan(alerts).sources.flatMap((s) => s.polygons);
      if (!avoid.length) say('There are no active warning areas with a drawn boundary to get away from right now.');
      else if (start) {
        const town = awayFromWarning(towns, start.point, avoid);
        if (town) destination = { point: [town.lon, town.lat], label: `${town.name} (town center outside the warning area)` };
        else say('We couldn’t find a town center outside the warning area. Choose a place instead.');
      }
    } else {
      tapTarget = 'destination';
    }
    renderDestOptions();
    refreshLabels();
  }

  function renderDestOptions(): void {
    const radio = (value: DestinationChoice, label: string, help: string, disabled = false) => {
      const input = h('input', { type: 'radio', name: 'dest', id: `dest-${value}`, value, checked: choice === value, disabled });
      input.addEventListener('change', () => {
        userChose = true;
        chooseDestination(value);
      });
      return h('div', { class: 'dest-option' }, input, h('label', { for: `dest-${value}` }, h('span', { class: 'dest-option__label' }, label), h('span', { class: 'meta' }, help)));
    };
    const avoidCount = buildAvoidPlan(alerts).sources.length;
    const shelterHelp =
      shelters instanceof Error
        ? 'Couldn’t load shelters right now.'
        : shelters === null
          ? 'Checking FEMA’s list (can take a few seconds)…'
          : shelters.length
            ? `${shelters.length} open in or near SC-5`
            : 'No shelters are listed as open right now.';

    const shelterList =
      Array.isArray(shelters) && (choice === 'shelter' || !shelters.length)
        ? shelters.length
          ? h(
              'ul',
              { class: 'shelter-list' },
              ...(start ? byDistance(shelters, start.point) : shelters.map((s) => ({ ...s, km: 0 }))).slice(0, 5).map((s) =>
                shelterCard(s, () => setDestination({ point: [s.lon, s.lat], label: `${s.name} (open shelter)` })),
              ),
            )
          : h(
              'div',
              { class: 'notice' },
              icon('Info'),
              h(
                'div',
                {},
                h('p', { class: 'notice__title' }, 'No shelters in or near SC-5 are listed as open right now.'),
                h(
                  'p',
                  {},
                  'Shelters usually open only when officials expect people to need them. Your county emergency management office announces them: ',
                  h('a', { href: COUNTY_EM[place.fips] ?? SCEMD_COUNTY_DIRECTORY, rel: 'noopener' }, `${countyName(place.fips)} County Emergency Management`),
                  ' · ',
                  h('a', { href: SCEMD_COUNTY_DIRECTORY, rel: 'noopener' }, 'All SC county offices'),
                ),
              ),
            )
        : null;

    fill(
      destOptions,
      h(
        'fieldset',
        { class: 'dest-fieldset' },
        h('legend', { class: 'field-label' }, 'Where do you want to go?'),
        radio('shelter', 'Nearest open shelter', shelterHelp, Array.isArray(shelters) && !shelters.length),
        radio('away', 'Away from the warning area', avoidCount ? 'Nearest town center outside the active warning areas' : alertsFailed ? 'Not available: current alerts couldn’t be loaded' : 'No active warning areas to get away from', !avoidCount),
        radio('place', 'A place I choose', 'Search an address or ZIP, or tap the map'),
      ),
      shelterList,
      choice === 'place' ? search('dest-search', 'Destination', setDestination) : null,
      Array.isArray(shelters)
        ? h('p', { class: 'meta' }, `Shelter list from FEMA and the American Red Cross, checked ${clockTime(shelters[0]?.checked_at ?? new Date().toISOString())}. Always confirm with your county before you go.`)
        : null,
    );
  }

  function renderResults(): void {
    if (!plan || !start || !destination) return;
    const fastest = plan.routes.find((r) => r.isFastest) ?? plan.routes[0];
    const print = h('button', { class: 'button button--secondary no-print', type: 'button' }, 'Print or save these directions');
    print.addEventListener('click', () => window.print());
    fill(
      resultsSlot,
      h('h2', { id: 'routes-title', class: 'section__title' }, 'Routes'),
      plan.provider === 'osrm-fallback'
        ? h('div', { class: 'notice notice--error', role: 'alert' }, icon('TriangleAlert'), h('p', {}, h('strong', {}, 'This route does not avoid hazard areas. '), 'Our main routing service is unavailable, so this comes from a backup that can’t see warnings.'))
        : null,
      ...plan.notices.filter((n) => !n.startsWith('This route does not avoid')).map((n) => h('p', { class: 'route-notice' }, icon('Info'), n)),
      plan.routes.length
        ? h(
            'ol',
            { class: 'route-list' },
            ...plan.routes.map((r) =>
              routeCard(r, fastest, start!.point, destination!.point, r.id === selected, () => {
                selected = r.id;
                routeMap?.setRoutes(plan!.routes, selected);
                renderResults();
              }),
            ),
          )
        : h('p', { class: 'empty-state' }, 'No route was found between these points.'),
      h(
        'p',
        { class: 'meta' },
        `How routes are compared: travel minutes + ${ALERT_AREA_PENALTY_MIN} for each active warning area entered + ${MILES_INSIDE_PENALTY} for each mile inside one + ${FLOOD_ZONE_PENALTY_MIN} for each FEMA flood zone crossed + ${DIP_PENALTY_MIN} for each low dip. Lower is better. Heights are approximate, and a low road isn’t always flooded. `,
        h('a', { href: '#/methodology' }, 'More on how it works'),
      ),
      h('p', { class: 'meta' }, 'Google Maps and Apple Maps open the same start and end, but they don’t know about the warning areas this app avoids.'),
      print,
    );
    timestamps.textContent = `Alerts checked ${dateTime(alertsFetchedAt)} · Routes planned ${dateTime(plan.planned_at)}${scenario ? ' · Scenario Mode: simulated alerts' : ''}`;
  }

  planButton.addEventListener('click', async () => {
    if (!start || !destination) return;
    controller?.abort();
    controller = new AbortController();
    planButton.setAttribute('disabled', '');
    say('Planning routes… this can take a few seconds.');
    resultsSlot.replaceChildren(h('ul', { class: 'skeleton-list', 'aria-hidden': 'true' }, h('li', { class: 'skeleton skeleton--tall' })));
    try {
      plan = await planRoutes(start.point, destination.point, alerts, controller.signal, { reports: communityReports, avoidFlooded: avoidFloodedBox.checked });
      selected = plan.routes[0]?.id ?? null;
      if (routeMap) routeMap.setRoutes(plan.routes, selected);
      else if (plan.routes.length) void ensureMap();
      say(plan.routes.length ? `${plan.routes.length} route${plan.routes.length > 1 ? 's' : ''} found.` : 'No route found.');
      renderResults();
    } catch (err) {
      if (controller.signal.aborted) return;
      say('');
      resultsSlot.replaceChildren(
        h(
          'div',
          { class: 'notice notice--error', role: 'alert' },
          icon('CloudOff'),
          h('div', {}, h('p', { class: 'notice__title' }, 'Routing is unavailable right now.'), h('p', {}, `${err instanceof Error ? err.message : 'Unknown error'}. If you need to leave, follow official evacuation routes and local news. Call 911 if you are in danger.`)),
        ),
      );
    } finally {
      planButton.removeAttribute('disabled');
    }
  });

  // Start-point controls
  const locate = h('button', { class: 'button button--secondary', type: 'button' }, icon('LocateFixed'), 'Use my location');
  locate.addEventListener('click', () => {
    if (!('geolocation' in navigator)) return say('This browser can’t share your location. Use a ZIP code or tap the map.');
    say('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        say('');
        setStart({ point: [pos.coords.longitude, pos.coords.latitude], label: 'Your location' });
      },
      () => say('Couldn’t get your location. Use a ZIP code or tap the map.'),
      { timeout: 15_000, maximumAge: 300_000 },
    );
  });
  const tapStart = h('button', { class: 'button button--text', type: 'button' }, 'Set start by tapping the map');
  tapStart.addEventListener('click', () => {
    tapTarget = 'start';
    refreshLabels();
    void ensureMap();
    mapEl.scrollIntoView({ block: 'center' });
  });

  const planner = h(
    'div',
    { class: 'planner' },
    h(
      'section',
      { class: 'planner__controls', 'aria-label': 'Plan a route' },
      h('h2', { class: 'subsection-title' }, '1. Where are you starting?'),
      h('div', { class: 'start-row' }, locate, tapStart),
      search('start-search', 'Or search', setStart),
      startLabel,
      h('h2', { class: 'subsection-title' }, '2. Where to?'),
      destOptions,
      destLabel,
      h('h2', { class: 'subsection-title' }, '3. Plan'),
      FEATURES.reports
        ? h(
            'div',
            { class: 'check' },
            avoidFloodedBox,
            h('label', { for: 'avoid-flooded' }, 'Avoid community-reported flooded roads', h('span', { class: 'meta' }, ' (unverified reports from neighbors)')),
          )
        : null,
      planButton,
      message,
    ),
    h('div', { class: 'planner__map no-print' }, mapEl, tapHint),
  );

  // The planner is drawn right away (so the page doesn't jump when data arrives);
  // the Plan button stays off until current alerts have loaded.
  let alertsReady = false;
  let alertsFailed = false;
  const alertsNotice = h('div', {});
  const body = h(
    'div',
    {},
    alertsNotice,
    planner,
    h('section', { class: 'section', 'aria-labelledby': 'routes-title' }, resultsSlot, timestamps),
  );
  root.replaceChildren(
    ...pageShell(
      'none',
      h(
        'main',
        { id: 'main', class: 'container text-page route-page' },
        h('p', { class: 'eyebrow' }, 'Route planner'),
        h('h1', { class: 'page-title' }, 'Lower-exposure route'),
        h('p', { class: 'lede prose' }, 'Find a way out that avoids active warning areas we know about, and see where to go.'),
        safetyNotice(),
        body,
      ),
    ),
  );

  (async () => {
    const c = await loadConditions(place, scenario);
    if (cancelled) return;
    alerts = dataOrNull(c.alerts) ?? [];
    alertsFetchedAt = c.alerts instanceof Error ? '' : c.alerts.fetched_at;

    // Shelter-in-place check for the person's place: if any such hazard is at Warning or Danger, don't offer routes.
    const status = evaluate({ alerts, gauges: dataOrNull(c.gauges), rain: dataOrNull(c.rain), now: Date.now() }, place);
    const ctx = { placeName: countyName(place.fips), inFloodZone: null, pctNoVehicle: null, vulnerability: null };
    const blocking = status.active.find((s) => s.level >= 2 && guidanceFor(s, ctx).shelterInPlace);
    if (blocking) {
      body.replaceChildren(shelterInstead(HAZARDS[blocking.hazard].label));
      return;
    }

    fill(
      alertsNotice,
      c.alerts instanceof Error
        ? h('div', { class: 'notice notice--error', role: 'alert' }, icon('CloudOff'), h('p', {}, 'Couldn’t load current alerts, so routes can’t avoid warning areas. Check weather.gov/alerts.'))
        : null,
    );
    alertsFailed = c.alerts instanceof Error;
    alertsReady = true;
    refreshLabels();
    renderDestOptions();

    const here = alerts.filter((a) => alertAppliesTo(a, { kind: 'county', fips: place.fips }) || buildAvoidPlan([a]).sources.length);
    avoidPolygons = buildAvoidPlan(here).sources.flatMap((s) => s.polygons);
    mapNow()?.setAvoid(avoidPolygons);

    // Community reports load in the background; routes work without them.
    if (FEATURES.reports) {
      const local = scenario ? simulatedReports() : [];
      (reportsAvailable() && !scenario ? fetchReports().catch(() => [] as Report[]) : Promise.resolve([] as Report[])).then((r) => (communityReports = [...local, ...r]));
    }
    // Towns are our own small file: load them first so "Away from the warning area" works right away.
    towns = await fetch(`${import.meta.env.BASE_URL}data/towns.json`)
      .then((r) => r.json() as Promise<Town[]>)
      .catch(() => []);
    if (cancelled) return;
    const hasAvoidAreas = buildAvoidPlan(alerts).sources.length > 0;
    if (!userChose) chooseDestination(hasAvoidAreas ? 'away' : 'shelter');

    // FEMA's shelter service can be slow, so it never holds up the planner: 12 seconds at most.
    shelters = await fetchOpenShelters(AbortSignal.timeout(12_000)).catch(
      () => new Error('FEMA’s shelter list didn’t respond. Check with your county emergency management office.'),
    );
    if (cancelled) return;
    if (Array.isArray(shelters)) mapNow()?.setShelters(shelters);
    // Prefer the nearest open shelter when there is one, unless the person already picked something.
    if (!userChose) {
      if (Array.isArray(shelters) && shelters.length) chooseDestination('shelter');
      else if (choice === 'shelter') chooseDestination(hasAvoidAreas ? 'away' : 'place');
      else renderDestOptions();
    } else renderDestOptions();
  })();

  return () => {
    cancelled = true;
    controller?.abort();
    routeMap?.destroy();
  };
}

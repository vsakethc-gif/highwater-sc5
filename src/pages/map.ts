/**
 * map.ts — the district map (brief 12.2).
 *
 * Map library: MapLibre GL. Basemap: OpenFreeMap "Positron" (free, no key, light and
 * low-contrast so our data stands out). This file is loaded only when the map is opened.
 *
 * Layers: census tracts colored by vulnerability / flood exposure / priority,
 * official alert areas, river gauges, and county outlines (always on).
 * A text version (county table and tract list) is below the map, so everything
 * shown on the map can also be reached by keyboard and screen readers.
 */
import * as maplibregl from 'maplibre-gl';
import type { MapMouseEvent } from 'maplibre-gl';
// MapLibre does its heavy map work in a background 'web worker'. Vite bundles that
// worker file and gives us its address, which we hand to MapLibre.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/map.css';
import { APP_NAME } from '../../shared/config';
import { h } from '../lib/dom';
import { dataOrNull, loadConditions } from '../../shared/data/conditions';
import { loadCounties, loadTracts, type CountyCollection, type TractCollection } from '../../shared/data/static';
import type { Alert, Gauge } from '../../shared/data/types';
import { feet, gaugeName } from '../../shared/format';
import { classifyAlert } from '../../shared/hazards/alertMap';
import { evaluate } from '../../shared/hazards/engine';
import { LEVELS, type Level } from '../../shared/hazards/levels';
import { districtAverage, scoreBand, type Tract } from '../../shared/hazards/vulnerability';
import { countyName, getState } from '../lib/state';
import { FEATURES } from '../../shared/config';
import { categoryInfo } from '../../shared/reports/categories';
import { fetchReports, reportsAvailable, simulatedReports, type Report } from '../../shared/reports/client';
import { relativeTime } from '../../shared/time';
import { clockTime } from '../../shared/time';
import { icon } from '../components/icon';
import { pageShell } from '../components/layout';
import { statusBadge } from '../components/statusBadge';

const BASEMAP = 'https://tiles.openfreemap.org/styles/positron';

/**
 * The basemap's style has three layers (state boundaries and two highway-shield layers) whose
 * filters compare numbers that some map features don't have, which fills the browser console with
 * warnings as you zoom. We load the style ourselves and make those comparisons treat a missing
 * number as 999 (too big to match), so the map looks the same without the warnings.
 */
/**
 * One label point per county: the center (centroid) of its largest piece of land.
 * Labeling the county shapes directly repeats the name in every map tile the county touches.
 */
function countyLabelPoints(counties: CountyCollection): GeoJSON.FeatureCollection<GeoJSON.Point, { name: string }> {
  const ringArea = (ring: number[][]) => ring.reduce((a, [x1, y1], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; return a + x1 * y2 - x2 * y1; }, 0) / 2;
  return {
    type: 'FeatureCollection',
    features: counties.features.map((county) => {
      const polygons = county.geometry.type === 'Polygon' ? [county.geometry.coordinates] : county.geometry.coordinates;
      const outer = polygons.map((p) => p[0]).sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0];
      const A = ringArea(outer);
      let cx = 0;
      let cy = 0;
      outer.forEach(([x1, y1], i) => {
        const [x2, y2] = outer[(i + 1) % outer.length];
        const cross = x1 * y2 - x2 * y1;
        cx += (x1 + x2) * cross;
        cy += (y1 + y2) * cross;
      });
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [cx / (6 * A), cy / (6 * A)] }, properties: { name: county.properties.name } };
    }),
  };
}

async function basemapStyle(): Promise<maplibregl.StyleSpecification | string> {
  const safe = (expr: unknown): unknown => {
    if (!Array.isArray(expr)) return expr;
    if (['<', '<=', '>', '>='].includes(expr[0])) {
      return [expr[0], ...expr.slice(1).map((a) => (Array.isArray(a) && a[0] === 'get' ? ['to-number', ['coalesce', a, 999]] : safe(a)))];
    }
    return expr.map(safe);
  };
  try {
    const style = (await fetch(BASEMAP).then((r) => r.json())) as maplibregl.StyleSpecification;
    for (const layer of style.layers) {
      if ('filter' in layer && layer.filter && /^(boundary|highway-shield)/.test(layer.id)) layer.filter = safe(layer.filter) as maplibregl.FilterSpecification;
    }
    return style;
  } catch {
    return BASEMAP; // if that fails, let the map load the style directly
  }
}
maplibregl.setWorkerUrl(workerUrl);

type ScoreLayer = 'vulnerability_score' | 'exposure_score' | 'priority_score' | 'none';

const SCORE_LAYERS: { id: ScoreLayer; label: string; help: string }[] = [
  {
    id: 'vulnerability_score',
    label: 'Vulnerability',
    help: 'Where more people are 65 or older, have no car, live below the poverty line, or have a disability, compared with the rest of SC-5.',
  },
  { id: 'exposure_score', label: 'Flood exposure', help: 'How much of the neighborhood is inside FEMA’s high-risk flood zone, compared with the rest of SC-5.' },
  {
    id: 'priority_score',
    label: 'Priority',
    help: 'Vulnerability and flood exposure together: if flooding hits, where would people with the fewest resources be most exposed?',
  },
  { id: 'none', label: 'None', help: 'Show only alerts, gauges, and county lines.' },
];

/** Read a CSS token so map colors come from the same design tokens as the rest of the app. */
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function tractName(geoid: string): string {
  const code = geoid.slice(5);
  const number = String(Number(code.slice(0, 4))) + (code.slice(4) === '00' ? '' : `.${code.slice(4)}`);
  return `Census tract ${number}, ${countyName(geoid.slice(0, 5))} County`;
}

/**
 * Gauge symbols are drawn on a small canvas. Each category has a different SHAPE as well as
 * color, so they can be told apart without color vision.
 */
function gaugeImages(): Record<string, ImageData> {
  const size = 22;
  const make = (draw: (c: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const c = canvas.getContext('2d')!;
    c.lineWidth = 2;
    c.strokeStyle = token('--color-ink');
    draw(c);
    return c.getImageData(0, 0, size, size);
  };
  const circle = (fill: string | null) => (c: CanvasRenderingContext2D) => {
    c.beginPath();
    c.arc(11, 11, 7, 0, Math.PI * 2);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    c.stroke();
  };
  const poly = (points: number[][], fill: string) => (c: CanvasRenderingContext2D) => {
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.stroke();
  };
  return {
    'gauge-nostage': make(circle(token('--color-surface'))),
    'gauge-below': make(circle(token('--color-accent'))),
    'gauge-action': make(poly([[11, 2], [20, 11], [11, 20], [2, 11]], token('--status-watch-border'))),
    'gauge-minor': make(poly([[11, 2], [20, 19], [2, 19]], token('--status-warning-bg'))),
    'gauge-flood': make(poly([[3, 3], [19, 3], [19, 19], [3, 19]], token('--status-danger-bg'))),
  };
}

function gaugeIcon(g: Gauge): string {
  if (!g.has_official_stage || !g.latest) return 'gauge-nostage';
  if (!g.flood_category) return 'gauge-below';
  if (g.flood_category === 'action') return 'gauge-action';
  if (g.flood_category === 'minor') return 'gauge-minor';
  return 'gauge-flood';
}

/** Alert areas: NWS polygons when given; otherwise the whole county outline. */
function alertFeatures(alerts: Alert[], counties: CountyCollection): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const a of alerts) {
    const { hazard, level } = classifyAlert(a);
    if (level === 0) continue;
    const props = { event: a.event, hazard, level, key: LEVELS[level as Level].key, drawn: Boolean(a.geometry) };
    if (a.geometry) features.push({ type: 'Feature', geometry: a.geometry, properties: props });
    else {
      for (const c of counties.features.filter((f) => a.county_fips.includes(f.properties.fips))) {
        features.push({ type: 'Feature', geometry: c.geometry, properties: props });
      }
    }
  }
  // Draw lower levels first so the most serious alert ends up on top.
  features.sort((a, b) => (a.properties!.level as number) - (b.properties!.level as number));
  return { type: 'FeatureCollection', features };
}

// ---------- side panel pieces ----------

function legend(layer: ScoreLayer, images: Record<string, ImageData>): HTMLElement {
  const swatch = (color: string) => h('span', { class: 'legend__swatch', style: `background:${color}` });
  const imageSwatch = (name: string) => {
    const canvas = h('canvas', { class: 'legend__symbol', width: '22', height: '22', 'aria-hidden': 'true' });
    canvas.getContext('2d')?.putImageData(images[name], 0, 0);
    return canvas;
  };
  const scale =
    layer === 'none'
      ? null
      : h(
          'div',
          { class: 'legend__group' },
          h('p', { class: 'legend__title' }, `${SCORE_LAYERS.find((l) => l.id === layer)!.label} (0–100, compared with SC-5)`),
          h(
            'ul',
            { class: 'legend__list' },
            ...[
              ['--ramp-1', 'Very low (0–19)'],
              ['--ramp-2', 'Low (20–39)'],
              ['--ramp-3', 'Moderate (40–59)'],
              ['--ramp-4', 'High (60–79)'],
              ['--ramp-5', 'Very high (80–100)'],
              ['--ramp-none', 'Insufficient data'],
            ].map(([t, label]) => h('li', {}, swatch(token(t)), label)),
          ),
        );
  return h(
    'div',
    { class: 'legend' },
    scale,
    h(
      'div',
      { class: 'legend__group' },
      h('p', { class: 'legend__title' }, 'Official alert areas'),
      h(
        'ul',
        { class: 'legend__list' },
        ...([1, 2, 3] as Level[]).map((l) => h('li', {}, swatch(token(`--status-${LEVELS[l].key}-border`)), `${LEVELS[l].name} level alert`)),
        h('li', {}, h('span', { class: 'legend__swatch legend__swatch--dashed' }), 'Dashed: covers the whole county'),
      ),
    ),
    h(
      'div',
      { class: 'legend__group' },
      h('p', { class: 'legend__title' }, 'River gauges'),
      h(
        'ul',
        { class: 'legend__list' },
        h('li', {}, imageSwatch('gauge-nostage'), 'No official flood stage'),
        h('li', {}, imageSwatch('gauge-below'), 'Below flood stage'),
        h('li', {}, imageSwatch('gauge-action'), 'Action stage'),
        h('li', {}, imageSwatch('gauge-minor'), 'Minor flooding'),
        h('li', {}, imageSwatch('gauge-flood'), 'Moderate or major flooding'),
      ),
    ),
    h(
      'div',
      { class: 'legend__group' },
      h('p', { class: 'legend__title' }, 'Lines and reports'),
      h(
        'ul',
        { class: 'legend__list' },
        h('li', {}, h('span', { class: 'legend__line' }), 'County border'),
        FEATURES.reports ? h('li', {}, h('span', { class: 'legend__report' }), 'Community report (unverified)') : null,
      ),
    ),
  );
}

function tractPanel(t: Tract, all: Tract[], countyLevel: Level | null, onClose: () => void): HTMLElement {
  const avg = (m: 'pct_65plus' | 'pct_no_vehicle' | 'pct_poverty' | 'pct_disability' | 'pct_sfha', w: 'population' | 'households' = 'population') =>
    districtAverage(all, m, w);
  const row = (label: string, meaning: string, value: number | null, sc5: number) =>
    h(
      'tr',
      {},
      h('th', { scope: 'row' }, label, h('span', { class: 'data-table__help' }, meaning)),
      h('td', { class: 'num' }, value === null ? '—' : `${value.toFixed(1)}%`),
      h('td', { class: 'num' }, `${sc5.toFixed(1)}%`),
    );
  const score = (label: string, value: number | null) =>
    h('div', { class: 'stat' }, h('p', { class: 'stat__label' }, label), h('p', { class: 'stat__value num' }, value === null ? '—' : String(value)), h('p', { class: 'meta' }, scoreBand(value)));
  const close = h('button', { class: 'button button--text panel__close', type: 'button', 'aria-label': 'Close tract details' }, icon('X'));
  close.addEventListener('click', onClose);
  return h(
    'section',
    { class: 'tract-panel', 'aria-labelledby': 'tract-title', tabindex: '-1' },
    h('div', { class: 'tract-panel__head' }, h('h2', { id: 'tract-title', class: 'subsection-title' }, tractName(t.geoid)), close),
    h('p', { class: 'meta' }, `About ${t.population.toLocaleString()} people, ${t.households.toLocaleString()} households`),
    t.data_quality === 'insufficient'
      ? h(
          'p',
          { class: 'callout' },
          'Insufficient data: too few people or households live here (for example a college dorm or prison) for these percentages to be meaningful, so this area gets no vulnerability score.',
        )
      : null,
    h('div', { class: 'stat-row' }, score('Vulnerability', t.vulnerability_score), score('Flood exposure', t.exposure_score), score('Priority', t.priority_score)),
    h(
      'table',
      { class: 'data-table' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Measure'), h('th', { scope: 'col' }, 'Here'), h('th', { scope: 'col' }, 'SC-5 avg'))),
      h(
        'tbody',
        {},
        row('Age 65+', 'Share of people 65 or older', t.pct_65plus, avg('pct_65plus')),
        row('No car', 'Share of households with no vehicle', t.pct_no_vehicle, avg('pct_no_vehicle', 'households')),
        row('Poverty', 'Share of people below the poverty line', t.pct_poverty, avg('pct_poverty')),
        row('Disability', 'Share of people with a disability', t.pct_disability, avg('pct_disability')),
        row('Flood zone', 'Share of land in FEMA’s high-risk flood zone', t.pct_sfha, avg('pct_sfha')),
      ),
    ),
    countyLevel !== null
      ? h('p', { class: 'tract-panel__level' }, 'Current county status from alerts and gauges: ', statusBadge(countyLevel))
      : null,
    h('p', { class: 'meta' }, 'Scores compare this tract with the other SC-5 tracts (higher = more than most). Census ACS 2020–2024 estimates have margins of error, especially in small areas.'),
  );
}

// ---------- page ----------

export function renderMap(root: HTMLElement): () => void {
  document.title = `District map · ${APP_NAME}`;
  const { scenario } = getState();
  let layer: ScoreLayer = 'vulnerability_score';
  let map: maplibregl.Map | null = null;
  let tracts: TractCollection | null = null;
  let countyLevels = new Map<string, Level>();
  const images = gaugeImages();

  const mapEl = h('div', { class: 'map-canvas', role: 'region', 'aria-label': 'District map. A text version is below the map.' });
  const status = h('p', { class: 'meta', 'aria-live': 'polite' }, 'Loading map data…');
  const legendSlot = h('div', {}, legend(layer, images));
  const panelSlot = h('div', {});

  const layerHelp = h('p', { class: 'meta layer-help' }, SCORE_LAYERS[0].help);
  const layerControl = h(
    'fieldset',
    { class: 'segmented' },
    h('legend', { class: 'field-label' }, 'Color neighborhoods by'),
    ...SCORE_LAYERS.map((l) => {
      const input = h('input', { type: 'radio', name: 'score-layer', value: l.id, id: `layer-${l.id}`, checked: l.id === layer });
      input.addEventListener('change', () => setLayer(l.id));
      return h('div', { class: 'segmented__item' }, input, h('label', { for: `layer-${l.id}` }, l.label));
    }),
  );
  const toggle = (id: string, label: string, onChange: (on: boolean) => void) => {
    const input = h('input', { type: 'checkbox', id, checked: true });
    input.addEventListener('change', () => onChange(input.checked));
    return h('div', { class: 'check' }, input, h('label', { for: id }, label));
  };
  const visible = (ids: string[], on: boolean) => ids.forEach((id) => map?.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'));

  const countyTableSlot = h('div', {}, h('p', { class: 'meta' }, 'Loading…'));
  const tractListSlot = h('div', {});

  function setLayer(next: ScoreLayer): void {
    layer = next;
    layerHelp.textContent = SCORE_LAYERS.find((l) => l.id === next)!.help;
    legendSlot.replaceChildren(legend(layer, images));
    if (!map) return;
    visible(['tracts-fill'], next !== 'none');
    if (next !== 'none') map.setPaintProperty('tracts-fill', 'fill-color', fillExpression(next));
  }

  function fillExpression(prop: Exclude<ScoreLayer, 'none'>): maplibregl.ExpressionSpecification {
    return [
      'case',
      ['==', ['get', prop], null],
      token('--ramp-none'),
      ['step', ['get', prop], token('--ramp-1'), 20, token('--ramp-2'), 40, token('--ramp-3'), 60, token('--ramp-4'), 80, token('--ramp-5')],
    ];
  }

  function selectTract(geoid: string | null, focusPanel = false): void {
    map?.setFilter('tract-selected', ['==', ['get', 'geoid'], geoid ?? '']);
    const t = geoid ? tracts?.features.find((f) => f.properties.geoid === geoid) : null;
    if (!t || !tracts) {
      panelSlot.replaceChildren();
      return;
    }
    const all = tracts.features.map((f) => f.properties);
    const panel = tractPanel(t.properties, all, countyLevels.get(t.properties.county_fips) ?? null, () => selectTract(null));
    panelSlot.replaceChildren(panel);
    if (focusPanel) {
      panel.focus();
      const b = new maplibregl.LngLatBounds();
      const coords = t.geometry.type === 'Polygon' ? t.geometry.coordinates.flat() : t.geometry.coordinates.flat(2);
      coords.forEach((c) => b.extend(c as [number, number]));
      map?.fitBounds(b, { padding: 60, maxZoom: 12, duration: 0 });
    }
  }

  const main = h(
    'main',
    { id: 'main', class: 'map-page' },
    h(
      'div',
      { class: 'map-layout' },
      mapEl,
      h(
        'aside',
        { class: 'map-panel', 'aria-label': 'Map layers and details' },
        h('h1', { class: 'map-panel__title' }, 'District map'),
        status,
        panelSlot,
        layerControl,
        layerHelp,
        h(
          'div',
          { class: 'check-group' },
          toggle('toggle-alerts', 'Official alert areas', (on) => visible(['alerts-fill', 'alerts-line', 'alerts-line-county'], on)),
          toggle('toggle-gauges', 'River gauges', (on) => visible(['gauges'], on)),
          FEATURES.reports ? toggle('toggle-reports', 'Community reports (unverified)', (on) => visible(['reports'], on)) : null,
        ),
        legendSlot,
      ),
    ),
    h(
      'div',
      { class: 'container' },
      h('section', { class: 'section', 'aria-labelledby': 'county-table-title' }, h('h2', { id: 'county-table-title', class: 'section__title' }, 'Counties at a glance'), countyTableSlot),
      h(
        'section',
        { class: 'section', 'aria-labelledby': 'tract-list-title' },
        h('h2', { id: 'tract-list-title', class: 'section__title' }, 'Neighborhoods (census tracts)'),
        h('p', { class: 'section__intro prose' }, 'Every tract on the map, sorted by priority. Choose one to see its details.'),
        tractListSlot,
      ),
    ),
  );
  root.replaceChildren(...pageShell('map', main));

  let cancelled = false;
  (async () => {
    try {
      const [counties, tractData, conditions] = await Promise.all([
        loadCounties(),
        loadTracts(),
        loadConditions(getState().place, scenario, { allCounties: true, skipRain: true }),
      ]);
      if (cancelled) return;
      tracts = tractData;
      const alerts = dataOrNull(conditions.alerts) ?? [];
      const gauges = dataOrNull(conditions.gauges) ?? [];

      // County levels from alerts and gauges (rain isn't loaded on the map).
      countyLevels = new Map(
        counties.features.map((c) => {
          const s = evaluate({ alerts, gauges, rain: { next24h_in: 0, next48h_in: 0, updated_at: '' }, now: Date.now() }, { kind: 'county', fips: c.properties.fips });
          return [c.properties.fips, s.level];
        }),
      );

      const problems = [
        conditions.alerts instanceof Error ? 'alerts couldn’t load' : null,
        conditions.gauges instanceof Error ? 'gauges couldn’t load' : null,
      ].filter(Boolean);
      status.textContent = problems.length
        ? `Some live data is missing: ${problems.join(', ')}.`
        : `${conditions.simulated ? 'Simulated data' : 'Live data'} as of ${clockTime(new Date().toISOString())}.`;

      // Text version: county table
      countyTableSlot.replaceChildren(
        h(
          'div',
          { class: 'table-scroll' },
          h(
            'table',
            { class: 'data-table' },
            h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'County'), h('th', { scope: 'col' }, 'Alerts & gauges'), h('th', { scope: 'col' }, 'Active alerts'), h('th', { scope: 'col' }, 'Gauges at action stage or above'))),
            h(
              'tbody',
              {},
              ...counties.features
                .map((c) => c.properties)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => {
                  const here = alerts.filter((a) => a.county_fips.includes(c.fips) && classifyAlert(a).level > 0);
                  const high = gauges.filter((g) => g.county_fips === c.fips && g.flood_category).length;
                  return h(
                    'tr',
                    {},
                    h('th', { scope: 'row' }, c.name),
                    h('td', {}, statusBadge(countyLevels.get(c.fips) ?? 0)),
                    h('td', {}, here.length ? here.map((a) => a.event).join(', ') : 'None'),
                    h('td', { class: 'num' }, String(high)),
                  );
                }),
            ),
          ),
        ),
        h('p', { class: 'meta' }, 'Rain forecasts are not included here. Open a county on the Status page for its full status.'),
      );

      // Text version: tract list
      const sorted = [...tractData.features.map((f) => f.properties)].sort((a, b) => (b.priority_score ?? -1) - (a.priority_score ?? -1));
      tractListSlot.replaceChildren(
        h(
          'details',
          { class: 'tract-list' },
          h('summary', {}, icon('ChevronDown'), `Show all ${sorted.length} tracts`),
          h(
            'ul',
            {},
            ...sorted.map((t) => {
              const b = h(
                'button',
                { class: 'tract-list__item', type: 'button' },
                h('span', {}, tractName(t.geoid)),
                h('span', { class: 'meta num' }, t.priority_score === null ? 'Insufficient data' : `Priority ${t.priority_score}`),
              );
              b.addEventListener('click', () => {
                selectTract(t.geoid, true);
                mapEl.scrollIntoView({ block: 'start' });
              });
              return h('li', {}, b);
            }),
          ),
        ),
      );

      // The map itself
      const bounds = new maplibregl.LngLatBounds();
      counties.features.forEach((c) => (c.geometry.type === 'Polygon' ? c.geometry.coordinates.flat() : c.geometry.coordinates.flat(2)).forEach((p) => bounds.extend(p as [number, number])));
      const style = await basemapStyle();
      if (cancelled) return;
      map = new maplibregl.Map({
        container: mapEl,
        style,
        bounds,
        fitBoundsOptions: { padding: 24 },
        attributionControl: { compact: false },
        cooperativeGestures: false,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        if (!map) return;
        for (const [name, img] of Object.entries(images)) map.addImage(name, img, { pixelRatio: 1 });
        map.addSource('tracts', { type: 'geojson', data: tractData });
        map.addSource('counties', { type: 'geojson', data: counties });
        map.addSource('county-label-points', { type: 'geojson', data: countyLabelPoints(counties) });
        map.addSource('alerts', { type: 'geojson', data: alertFeatures(alerts, counties) });
        map.addSource('gauges', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: gauges.map((g) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [g.lon, g.lat] },
              properties: { icon: gaugeIcon(g), name: gaugeName(g.name), value: g.latest ? feet(g.latest.value) : 'No recent reading', stage: g.stages?.minor ?? null },
            })),
          },
        });

        // Our colored areas go BENEATH the basemap's place names, so town names stay crisp instead of washed out.
        const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
        map.addLayer({ id: 'tracts-fill', type: 'fill', source: 'tracts', paint: { 'fill-color': fillExpression('vulnerability_score'), 'fill-opacity': 0.72 } }, firstLabel);
        map.addLayer({ id: 'tracts-line', type: 'line', source: 'tracts', paint: { 'line-color': token('--color-surface'), 'line-width': 0.6 } }, firstLabel);
        const levelColor: maplibregl.ExpressionSpecification = [
          'match',
          ['get', 'key'],
          'watch',
          token('--status-watch-border'),
          'warning',
          token('--status-warning-bg'),
          token('--status-danger-bg'),
        ];
        map.addLayer({ id: 'alerts-fill', type: 'fill', source: 'alerts', filter: ['==', ['get', 'drawn'], true], paint: { 'fill-color': levelColor, 'fill-opacity': 0.22 } }, firstLabel);
        map.addLayer({ id: 'alerts-line', type: 'line', source: 'alerts', filter: ['==', ['get', 'drawn'], true], paint: { 'line-color': levelColor, 'line-width': 2.5 } });
        map.addLayer({
          id: 'alerts-line-county',
          type: 'line',
          source: 'alerts',
          filter: ['==', ['get', 'drawn'], false],
          paint: { 'line-color': levelColor, 'line-width': 4, 'line-dasharray': [2, 1.5], 'line-offset': 2 },
        });
        map.addLayer({ id: 'counties-line', type: 'line', source: 'counties', paint: { 'line-color': token('--color-ink'), 'line-width': 1.6 } });
        map.addLayer({
          id: 'county-labels',
          type: 'symbol',
          source: 'county-label-points',
          layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-transform': 'uppercase', 'text-letter-spacing': 0.08 },
          paint: { 'text-color': token('--color-ink'), 'text-halo-color': token('--color-surface'), 'text-halo-width': 2 },
        });
        // The selected tract's outline goes on top of everything except gauges, so it's never hidden.
        map.addLayer({ id: 'tract-selected', type: 'line', source: 'tracts', filter: ['==', ['get', 'geoid'], ''], paint: { 'line-color': token('--color-ink'), 'line-width': 3 } });
        map.addLayer({ id: 'gauges', type: 'symbol', source: 'gauges', layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
        map.addSource('reports', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'reports',
          type: 'circle',
          source: 'reports',
          paint: { 'circle-radius': 6, 'circle-color': token('--status-watch-border'), 'circle-stroke-color': token('--color-ink'), 'circle-stroke-width': 1.5 },
        });
        // County names go on top of everything, so gauge and report dots never cover them.
        map.moveLayer('county-labels');
        // Community reports load in the background (simulated ones in Scenario Mode).
        if (FEATURES.reports) {
          const local: Report[] = scenario ? simulatedReports() : [];
          (reportsAvailable() && !scenario ? fetchReports().catch(() => [] as Report[]) : Promise.resolve([] as Report[])).then((live) => {
            const all = [...local, ...live];
            (map?.getSource('reports') as maplibregl.GeoJSONSource | undefined)?.setData({
              type: 'FeatureCollection',
              features: all.map((r) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
                properties: { label: categoryInfo(r.category).label, when: relativeTime(r.created_at), simulated: Boolean(r.simulated) },
              })),
            });
          });
        }

        // Clicks: a gauge shows a popup; a tract opens the detail panel.
        map.on('click', (e: MapMouseEvent) => {
          if (!map) return;
          const rep = map.queryRenderedFeatures(e.point, { layers: ['reports'] })[0];
          if (rep) {
            const p = rep.properties as { label: string; when: string; simulated: boolean };
            new maplibregl.Popup({ closeButton: true, maxWidth: '240px' })
              .setLngLat((rep.geometry as GeoJSON.Point).coordinates as [number, number])
              .setDOMContent(h('div', { class: 'popup' }, h('p', { class: 'popup__title' }, p.label), h('p', { class: 'meta' }, `${p.simulated ? 'Simulated' : 'Unverified community report'} · ${p.when}`), h('p', {}, h('a', { href: '#/report' }, 'See reports'))))
              .addTo(map);
            return;
          }
          const g = map.queryRenderedFeatures(e.point, { layers: ['gauges'] })[0];
          if (g) {
            const p = g.properties as { name: string; value: string; stage: number | null };
            const content = h(
              'div',
              { class: 'popup' },
              h('p', { class: 'popup__title' }, p.name),
              h('p', { class: 'num' }, p.value),
              h('p', { class: 'meta' }, p.stage ? `Flood stage ${p.stage} ft` : 'No official flood stage'),
            );
            new maplibregl.Popup({ closeButton: true, maxWidth: '260px' }).setLngLat((g.geometry as GeoJSON.Point).coordinates as [number, number]).setDOMContent(content).addTo(map);
            return;
          }
          const t = map.queryRenderedFeatures(e.point, { layers: ['tracts-fill'] })[0];
          selectTract(t ? String(t.properties.geoid) : null);
        });
        for (const id of ['gauges', 'reports', 'tracts-fill']) {
          map.on('mouseenter', id, () => map && (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', id, () => map && (map.getCanvas().style.cursor = ''));
        }
      });
      map.on('error', () => {
        status.textContent = 'Some map pieces didn’t load. The text version below still works.';
      });
    } catch {
      if (cancelled) return;
      status.textContent = 'The map data didn’t load. Check your connection and try again.';
      countyTableSlot.replaceChildren(h('p', { class: 'meta' }, 'The county table needs the same data, so it couldn’t load either. The Status page may still work.'));
    }
  })();

  return () => {
    cancelled = true;
    map?.remove();
  };
}


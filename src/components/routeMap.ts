/**
 * routeMap.ts — the map on the route planner: warning areas to avoid, open shelters,
 * the start and end points, and up to three routes.
 * The recommended (lower-exposure) route is a thick solid line; others are thinner and dashed,
 * so they differ by line style as well as color.
 */
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { LonLat, PolygonCoords } from '../../shared/routing/avoid';
import type { Shelter } from '../../shared/routing/destinations';
import type { RouteResult } from '../../shared/routing/plan';

maplibregl.setWorkerUrl(workerUrl);

const BASEMAP = 'https://tiles.openfreemap.org/styles/positron';
const SC5_BOUNDS: [number, number, number, number] = [-81.9, 33.95, -80.05, 35.2];
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export interface RouteMap {
  setAvoid(polygons: PolygonCoords[]): void;
  setShelters(shelters: Shelter[]): void;
  setPoints(start: LonLat | null, end: LonLat | null): void;
  setRoutes(routes: RouteResult[], selected: string | null): void;
  onTap(fn: (p: LonLat) => void): void;
  destroy(): void;
}

export function createRouteMap(container: HTMLElement): RouteMap {
  const map = new maplibregl.Map({ container, style: BASEMAP, bounds: SC5_BOUNDS, attributionControl: { compact: false } });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  let ready = false;
  const pending: (() => void)[] = [];
  const whenReady = (fn: () => void) => (ready ? fn() : pending.push(fn));
  const set = (id: string, data: GeoJSON.FeatureCollection) => whenReady(() => (map.getSource(id) as maplibregl.GeoJSONSource).setData(data));

  map.on('load', () => {
    for (const id of ['avoid', 'shelters', 'points', 'routes']) map.addSource(id, { type: 'geojson', data: empty });
    map.addLayer({ id: 'avoid-fill', type: 'fill', source: 'avoid', paint: { 'fill-color': token('--status-danger-bg'), 'fill-opacity': 0.18 } });
    map.addLayer({ id: 'avoid-line', type: 'line', source: 'avoid', paint: { 'line-color': token('--status-danger-bg'), 'line-width': 2 } });
    map.addLayer({
      id: 'routes-other',
      type: 'line',
      source: 'routes',
      filter: ['!=', ['get', 'selected'], true],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': token('--color-ink-subtle'), 'line-width': 4, 'line-dasharray': [1.5, 1.5] },
    });
    map.addLayer({
      id: 'routes-selected-casing',
      type: 'line',
      source: 'routes',
      filter: ['==', ['get', 'selected'], true],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': token('--color-surface'), 'line-width': 9 },
    });
    map.addLayer({
      id: 'routes-selected',
      type: 'line',
      source: 'routes',
      filter: ['==', ['get', 'selected'], true],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': token('--color-accent'), 'line-width': 6 },
    });
    map.addLayer({
      id: 'shelters',
      type: 'circle',
      source: 'shelters',
      paint: { 'circle-radius': 7, 'circle-color': token('--status-normal-fg'), 'circle-stroke-color': token('--color-surface'), 'circle-stroke-width': 2 },
    });
    map.addLayer({
      id: 'points',
      type: 'circle',
      source: 'points',
      paint: {
        'circle-radius': 8,
        'circle-color': ['match', ['get', 'kind'], 'start', token('--color-surface'), token('--color-ink')],
        'circle-stroke-color': token('--color-ink'),
        'circle-stroke-width': 3,
      },
    });
    map.addLayer({
      id: 'point-labels',
      type: 'symbol',
      source: 'points',
      layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [0, 1.4], 'text-anchor': 'top' },
      paint: { 'text-color': token('--color-ink'), 'text-halo-color': token('--color-surface'), 'text-halo-width': 2 },
    });
    ready = true;
    pending.splice(0).forEach((fn) => fn());
  });

  const tapHandlers: ((p: LonLat) => void)[] = [];
  map.on('click', (e) => tapHandlers.forEach((fn) => fn([Math.round(e.lngLat.lng * 1e5) / 1e5, Math.round(e.lngLat.lat * 1e5) / 1e5])));

  function fit(coords: number[][]): void {
    if (!coords.length) return;
    const b = new maplibregl.LngLatBounds();
    coords.forEach((c) => b.extend(c as [number, number]));
    whenReady(() => map.fitBounds(b, { padding: 50, maxZoom: 13, duration: 0 }));
  }

  return {
    setAvoid(polygons) {
      set('avoid', { type: 'FeatureCollection', features: polygons.map((p) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: p }, properties: {} })) });
    },
    setShelters(shelters) {
      set('shelters', {
        type: 'FeatureCollection',
        features: shelters.map((s) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] }, properties: { name: s.name } })),
      });
    },
    setPoints(start, end) {
      const features: GeoJSON.Feature[] = [];
      if (start) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: start }, properties: { kind: 'start', label: 'Start' } });
      if (end) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: end }, properties: { kind: 'end', label: 'Destination' } });
      set('points', { type: 'FeatureCollection', features });
      if (start && end) fit([start, end]);
      else if (start || end) whenReady(() => map.easeTo({ center: (start ?? end)!, zoom: 11, duration: 0 }));
    },
    setRoutes(routes, selected) {
      set('routes', {
        type: 'FeatureCollection',
        features: routes.map((r) => ({ type: 'Feature', geometry: r.geometry, properties: { selected: r.id === selected } })),
      });
      fit(routes.flatMap((r) => r.geometry.coordinates));
    },
    onTap(fn) {
      tapHandlers.push(fn);
    },
    destroy() {
      map.remove();
    },
  };
}

/**
 * pickMap.ts — a small map for choosing a spot: tap the map or drag the pin.
 * Also shows nearby community reports as dots. Used on the report page.
 */
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Report } from '../../shared/reports/client';

maplibregl.setWorkerUrl(workerUrl);

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export interface PickMap {
  setPin(lon: number, lat: number, zoom?: number): void;
  setReports(reports: Report[]): void;
  onPick(fn: (lon: number, lat: number) => void): void;
  destroy(): void;
}

export function createPickMap(container: HTMLElement, center: [number, number]): PickMap {
  const map = new maplibregl.Map({
    container,
    style: 'https://tiles.openfreemap.org/styles/positron',
    center,
    zoom: 10,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  const handlers: ((lon: number, lat: number) => void)[] = [];
  const emit = (lon: number, lat: number) => handlers.forEach((fn) => fn(Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5));

  const pin = new maplibregl.Marker({ draggable: true, color: token('--color-accent') });
  let pinShown = false;
  pin.on('dragend', () => {
    const p = pin.getLngLat();
    emit(p.lng, p.lat);
  });
  map.on('click', (e) => emit(e.lngLat.lng, e.lngLat.lat));

  let ready = false;
  let pendingReports: Report[] | null = null;
  map.on('load', () => {
    map.addSource('reports', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'reports',
      type: 'circle',
      source: 'reports',
      paint: { 'circle-radius': 6, 'circle-color': token('--status-watch-border'), 'circle-stroke-color': token('--color-ink'), 'circle-stroke-width': 1.5 },
    });
    ready = true;
    if (pendingReports) api.setReports(pendingReports);
  });

  const api: PickMap = {
    setPin(lon, lat, zoom) {
      pin.setLngLat([lon, lat]);
      if (!pinShown) {
        pin.addTo(map);
        pinShown = true;
      }
      map.easeTo({ center: [lon, lat], zoom: zoom ?? Math.max(map.getZoom(), 14), duration: 0 });
    },
    setReports(reports) {
      if (!ready) {
        pendingReports = reports;
        return;
      }
      (map.getSource('reports') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: reports.map((r) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lon, r.lat] }, properties: { id: r.id } })),
      });
    },
    onPick(fn) {
      handlers.push(fn);
    },
    destroy() {
      map.remove();
    },
  };
  return api;
}

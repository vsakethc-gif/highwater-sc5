/**
 * avoid.ts — which areas a lower-exposure route should go around (brief 10.2).
 *
 * Avoid areas come from ACTIVE Warning- or Danger-level NWS alerts for hazards where
 * leaving can make sense (flooding, tropical, evacuation orders) that have a drawn polygon.
 * County-wide alerts without a polygon can't be avoided (you'd have to avoid the whole
 * county), so they're listed as "could not avoid" instead.
 *
 * We do NOT avoid FEMA flood zones: almost every creek crossing is in one, so routing
 * would fail. Flood-zone crossings are counted and shown on each route instead.
 *
 * OpenRouteService limits each avoid polygon to 20 km across and 200 km² in area, and
 * many warning polygons are bigger. So each polygon is cut into tiles no bigger than
 * 14 km × 14 km (196 km²), and only tiles near the trip are kept.
 */
import bboxClip from '@turf/bbox-clip';
import type { Alert } from '../data/types';
import { classifyAlert } from '../hazards/alertMap';
import { HAZARDS } from '../hazards/hazards';

export type LonLat = [number, number];
type Ring = number[][];
export type PolygonCoords = Ring[];

export interface AvoidSource {
  event: string;
  polygons: PolygonCoords[];
}

export interface AvoidPlan {
  /** Areas we will ask the router to go around. */
  sources: AvoidSource[];
  /** Active warnings we can't route around (no drawn area), shown to the user. */
  cannotAvoid: string[];
}

/** Which active alerts become avoid areas. */
export function buildAvoidPlan(alerts: Alert[]): AvoidPlan {
  const sources: AvoidSource[] = [];
  const cannotAvoid: string[] = [];
  for (const a of alerts) {
    const { hazard, level } = classifyAlert(a);
    if (level < 2 || !HAZARDS[hazard].leaveable) continue;
    if (!a.geometry) {
      cannotAvoid.push(`${a.event} (covers whole counties, so it can’t be routed around)`);
      continue;
    }
    const polygons =
      a.geometry.type === 'Polygon' ? [a.geometry.coordinates] : a.geometry.type === 'MultiPolygon' ? a.geometry.coordinates : [];
    if (polygons.length) sources.push({ event: a.event, polygons });
  }
  return { sources, cannotAvoid };
}

/** Tile size in degrees for about 14 km at South Carolina's latitude (~34.5°N). */
export const TILE_KM = 14;
const TILE_LAT = TILE_KM / 111;
const TILE_LON = TILE_KM / (111 * Math.cos((34.5 * Math.PI) / 180));

type BBox = [number, number, number, number];

function ringBBox(ring: Ring): BBox {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
}

const overlaps = (a: BBox, b: BBox) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/**
 * Cut polygons into tiles small enough for OpenRouteService, keeping only tiles that
 * overlap `near` (a box around the trip). Returns MultiPolygon coordinates.
 */
export function tileForRouter(polygons: PolygonCoords[], near: BBox): PolygonCoords[] {
  const out: PolygonCoords[] = [];
  for (const polygon of polygons) {
    const box = ringBBox(polygon[0]);
    if (!overlaps(box, near)) continue;
    for (let x = box[0]; x < box[2]; x += TILE_LON) {
      for (let y = box[1]; y < box[3]; y += TILE_LAT) {
        const tile: BBox = [x, y, Math.min(x + TILE_LON, box[2]), Math.min(y + TILE_LAT, box[3])];
        if (!overlaps(tile, near)) continue;
        const clipped = bboxClip({ type: 'Polygon', coordinates: polygon }, tile).geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
        const pieces: PolygonCoords[] = clipped.type === 'Polygon' ? [clipped.coordinates] : clipped.coordinates;
        for (const piece of pieces) {
          // Keep real shapes only (a closed ring needs at least 4 points).
          if (piece[0] && piece[0].length >= 4) out.push(piece.map((ring) => ring.map(([lon, lat]) => [round(lon), round(lat)])));
        }
      }
    }
  }
  return out;
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

/** A box around the start and end, padded so detours around a warning area are still covered. */
export function tripBox(start: LonLat, end: LonLat, padKm = 15): BBox {
  const padLat = padKm / 111;
  const padLon = padKm / (111 * Math.cos((34.5 * Math.PI) / 180));
  return [
    Math.min(start[0], end[0]) - padLon,
    Math.min(start[1], end[1]) - padLat,
    Math.max(start[0], end[0]) + padLon,
    Math.max(start[1], end[1]) + padLat,
  ];
}

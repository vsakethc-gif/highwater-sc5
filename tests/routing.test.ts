import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import samples from './fixtures/nws-alerts-samples.json';
import shelters from './fixtures/fema-open-shelters.json';
import { parseAlert } from '../shared/data/nws';
import { buildAvoidPlan, tileForRouter, tripBox, TILE_KM, type PolygonCoords } from '../shared/routing/avoid';
import { routeScore, countAreasCrossed, milesInside, formatDuration, formatMiles, thinLine, ALERT_AREA_PENALTY_MIN } from '../shared/routing/score';
import { googleMapsLink, appleMapsLink } from '../shared/routing/links';
import { awayFromWarning, byDistance, parseShelters, type Town } from '../shared/routing/destinations';
import { osrmInstruction, parseOrs } from '../shared/routing/plan';
import { distanceKm } from '../shared/geo';
import type { Alert } from '../shared/data/types';

const feature = (event: string) => parseAlert((samples as any).features.find((f: any) => f.properties.event === event));
const square = (x: number, y: number, size: number): PolygonCoords => [
  [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]],
];

describe('avoid areas (brief 10.2)', () => {
  it('uses Warning-level alerts for hazards where leaving can make sense, with a drawn area', () => {
    const plan = buildAvoidPlan([feature('Flash Flood Warning'), feature('Flood Warning')]);
    expect(plan.sources.map((s) => s.event)).toContain('Flash Flood Warning');
  });

  it('never avoids tornado warnings (you shelter instead of driving) or watches', () => {
    const plan = buildAvoidPlan([feature('Tornado Warning'), feature('Tornado Watch'), feature('Flood Watch')]);
    expect(plan.sources).toHaveLength(0);
  });

  it('lists county-wide warnings as "can’t be routed around"', () => {
    const countyWide: Alert = { ...feature('Flash Flood Warning'), geometry: null };
    const plan = buildAvoidPlan([countyWide]);
    expect(plan.sources).toHaveLength(0);
    expect(plan.cannotAvoid[0]).toMatch(/whole counties/);
  });
});

describe('tiling for OpenRouteService limits (20 km across, 200 km²)', () => {
  // A 50 km × 50 km warning area near Rock Hill
  const big = square(-81.3, 34.7, 0.55);
  const tiles = tileForRouter([big], [-82, 34, -80, 36]);

  it('cuts a big area into many tiles', () => {
    expect(tiles.length).toBeGreaterThan(9);
  });

  it('every tile is at most 14 km across (so under 20 km and under 200 km²)', () => {
    for (const t of tiles) {
      const xs = t[0].map((p) => p[0]);
      const ys = t[0].map((p) => p[1]);
      const widthKm = distanceKm(ys[0], Math.min(...xs), ys[0], Math.max(...xs));
      const heightKm = distanceKm(Math.min(...ys), xs[0], Math.max(...ys), xs[0]);
      expect(widthKm).toBeLessThanOrEqual(TILE_KM + 0.5);
      expect(heightKm).toBeLessThanOrEqual(TILE_KM + 0.5);
      expect(widthKm * heightKm).toBeLessThan(200);
    }
  });

  it('keeps only tiles near the trip', () => {
    const near = tileForRouter([big], tripBox([-81.3, 34.72], [-81.25, 34.75], 2));
    expect(near.length).toBeGreaterThan(0);
    expect(near.length).toBeLessThan(tiles.length);
  });

  it('closes every ring (first point = last point)', () => {
    for (const t of tiles) expect(t[0][0]).toEqual(t[0][t[0].length - 1]);
  });
});

describe('route scoring (documented formula)', () => {
  it('minutes + 30 per warning area entered + 5 per mile inside + 3 per flood-zone crossing', () => {
    expect(routeScore({ duration_s: 1800, alert_area_intersections: 1, miles_in_warning: 2, flood_zone_crossings: 4 })).toBe(30 + 30 + 10 + 12);
  });

  it('when you start inside a warning area, the route that leaves it sooner scores better', () => {
    const lingers = routeScore({ duration_s: 34 * 60, alert_area_intersections: 0, miles_in_warning: 9, flood_zone_crossings: 5 });
    const leaves = routeScore({ duration_s: 39 * 60, alert_area_intersections: 0, miles_in_warning: 3, flood_zone_crossings: 5 });
    expect(leaves).toBeLessThan(lingers);
  });

  it('measures miles inside an area', () => {
    const area = { type: 'Polygon', coordinates: square(-81.0, 34.9, 0.1) } as GeoJSON.Polygon;
    const line = [[-81.05, 34.95], [-80.95, 34.95], [-80.85, 34.95]];
    // only the first segment (about 5.7 mi) has its middle inside
    expect(milesInside(line, [area])).toBeCloseTo(5.7, 0);
  });

  it('a route through a warning area loses to one up to 30 minutes slower that avoids it', () => {
    const through = routeScore({ duration_s: 20 * 60, alert_area_intersections: 1, miles_in_warning: 0, flood_zone_crossings: 2 });
    const around = routeScore({ duration_s: (20 + ALERT_AREA_PENALTY_MIN - 1) * 60, alert_area_intersections: 0, miles_in_warning: 0, flood_zone_crossings: 2 });
    expect(around).toBeLessThan(through);
  });

  it('counts which areas a line passes through', () => {
    const line = [[-81.05, 34.95], [-81.0, 35.0], [-80.95, 35.05]];
    expect(countAreasCrossed(line, [{ type: 'Polygon', coordinates: square(-81.02, 34.98, 0.04) }])).toBe(1);
    expect(countAreasCrossed(line, [{ type: 'Polygon', coordinates: square(-80.5, 34.5, 0.04) }])).toBe(0);
  });

  it('formats time and distance', () => {
    expect(formatDuration(28 * 60)).toBe('28 min');
    expect(formatDuration(65 * 60)).toBe('1 hr 5 min');
    expect(formatMiles(1609.344 * 23)).toBe('23.0 mi');
  });

  it('thins long lines but keeps both ends', () => {
    const line = Array.from({ length: 1000 }, (_, i) => [i, i]);
    const thin = thinLine(line, 100);
    expect(thin).toHaveLength(100);
    expect(thin[0]).toEqual([0, 0]);
    expect(thin[99]).toEqual([999, 999]);
  });
});

describe('handoff links', () => {
  it('open the same trip in Google Maps and Apple Maps', () => {
    expect(googleMapsLink([-81.029, 34.923], [-80.771, 34.72])).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=34.92300,-81.02900&destination=34.72000,-80.77100&travelmode=driving',
    );
    expect(appleMapsLink([-81.029, 34.923], [-80.771, 34.72])).toBe('https://maps.apple.com/?saddr=34.92300,-81.02900&daddr=34.72000,-80.77100&dirflg=d');
  });
});

describe('destinations', () => {
  const towns: Town[] = JSON.parse(readFileSync('public/data/towns.json', 'utf8'));

  it('lists only shelters FEMA says are OPEN', () => {
    const parsed = parseShelters(shelters as never, '2026-10-17T23:00:00Z');
    expect(parsed.length).toBe((shelters as any).features.filter((f: any) => f.attributes.shelter_status === 'OPEN').length);
    const closed = { features: [{ attributes: { ...(shelters as any).features[0].attributes, shelter_status: 'CLOSED' } }] };
    expect(parseShelters(closed as never, '')).toHaveLength(0);
  });

  it('sorts by distance', () => {
    const sorted = byDistance(towns, [-81.029, 34.923]);
    expect(sorted[0].name).toBe('Rock Hill');
  });

  it('"away from the warning area" picks the nearest town outside the warning, not the one you are in', () => {
    const rockHill: [number, number] = [-81.029, 34.923];
    const warning = square(-81.15, 34.85, 0.25); // covers Rock Hill and nearby
    const pick = awayFromWarning(towns, rockHill, [warning])!;
    expect(pick).not.toBeNull();
    expect(pick.name).not.toBe('Rock Hill');
    expect(pick.km).toBeGreaterThanOrEqual(3);
  });

  it('has nothing to get away from when there are no warning areas', () => {
    expect(awayFromWarning(towns, [-81.029, 34.923], [])).toBeNull();
  });
});

describe('route parsing', () => {
  it('reads an OpenRouteService GeoJSON response', () => {
    const r = parseOrs({
      features: [
        {
          geometry: { type: 'LineString', coordinates: [[-81, 35], [-80.9, 35]] },
          properties: { summary: { distance: 9000, duration: 600 }, segments: [{ steps: [{ instruction: 'Head east on Main St', distance: 9000 }] }] },
        },
      ],
    });
    expect(r[0].duration_s).toBe(600);
    expect(r[0].steps[0].instruction).toBe('Head east on Main St');
  });

  it('writes readable steps for the OSRM backup', () => {
    expect(osrmInstruction({ distance: 1, name: 'Hampton Street', maneuver: { type: 'turn', modifier: 'left' } })).toBe('Turn left onto Hampton Street');
    expect(osrmInstruction({ distance: 1, name: '', maneuver: { type: 'arrive' } })).toBe('Arrive at your destination');
  });
});

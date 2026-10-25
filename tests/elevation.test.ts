import { describe, it, expect } from 'vitest';
import { elevationProfile, flatLine } from '../shared/routing/elevation';
import { routeScore } from '../shared/routing/score';

/** A straight route heading east, one point every ~100 m, with the given heights (meters). */
function line(heights: number[]): number[][] {
  return heights.map((h, i) => [-81 + i * 0.0011, 35, h]);
}

describe('route elevation', () => {
  it('returns null when the route has no heights (backup router)', () => {
    expect(elevationProfile([[-81, 35], [-81.01, 35]])).toBeNull();
  });

  it('finds the lowest point and how far along it is', () => {
    const p = elevationProfile(line([200, 195, 180, 190, 200]))!;
    expect(p.lowest_ft).toBe(Math.round(180 * 3.28084));
    expect(p.lowest_at_mi).toBeCloseTo(0.1, 1); // ~200 m in
    expect(p.highest_ft).toBe(Math.round(200 * 3.28084));
  });

  it('counts a creek valley (40 ft lower than both sides) as one dip', () => {
    const valley = [200, 200, 197, 192, 188, 186, 189, 194, 198, 200, 200];
    expect(elevationProfile(line(valley))!.dips).toBe(1);
  });

  it('two valleys far apart are two dips', () => {
    const flat = Array(12).fill(200);
    const v = [200, 195, 190, 186, 190, 195, 200];
    expect(elevationProfile(line([...v, ...flat, ...v]))!.dips).toBe(2);
  });

  it('a gentle slope or a small bump is not a dip', () => {
    expect(elevationProfile(line([200, 199, 198, 197, 196, 195, 194, 193, 192]))!.dips).toBe(0); // downhill only
    expect(elevationProfile(line([200, 200, 195, 193, 195, 200, 200]))!.dips).toBe(0); // only 7 m (23 ft) deep: a hill, not a valley
  });

  it('flatLine drops the heights for FEMA', () => {
    expect(flatLine([[-81, 35, 200]])).toEqual([[-81, 35]]);
  });

  it('each low dip adds 2 points to the route score', () => {
    const base = { duration_s: 600, alert_area_intersections: 0, miles_in_warning: 0, flood_zone_crossings: 0 };
    expect(routeScore({ ...base, low_dips: 3 }) - routeScore({ ...base, low_dips: 0 })).toBe(6);
    expect(routeScore({ ...base, low_dips: null })).toBe(10);
  });
});

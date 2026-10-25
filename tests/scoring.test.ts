import { describe, it, expect } from 'vitest';
import grid from './fixtures/nws-gridpoint-qpf.json';
import { durationHours, sumRainInches, parseRain } from '../shared/data/rain';
import { percentileRank, scoreTracts, dataQuality, districtAverage, scoreBand, type TractRaw } from '../shared/hazards/vulnerability';
import { pointInGeometry, distanceKm } from '../shared/geo';

describe('rain forecast', () => {
  it('reads ISO durations', () => {
    expect(durationHours('PT6H')).toBe(6);
    expect(durationHours('PT1H')).toBe(1);
    expect(durationHours('P1DT6H')).toBe(30);
  });

  it('sums whole and partial time blocks inside the window', () => {
    const now = Date.parse('2026-10-18T00:00:00Z');
    const values = [
      { validTime: '2026-10-18T00:00:00+00:00/PT6H', value: 25.4 }, // 1 inch, fully inside
      { validTime: '2026-10-18T21:00:00+00:00/PT6H', value: 25.4 }, // half inside a 24 h window
      { validTime: '2026-10-19T06:00:00+00:00/PT6H', value: 25.4 }, // outside 24 h, inside 48 h
    ];
    expect(sumRainInches(values, now, 24)).toBe(1.5);
    expect(sumRainInches(values, now, 48)).toBe(3);
  });

  it('parses the real Rock Hill forecast (millimeters) without errors', () => {
    const r = parseRain(grid as never, Date.parse('2026-10-17T23:00:00Z'));
    expect(r.next24h_in).toBeGreaterThanOrEqual(0);
    expect(r.next48h_in).toBeGreaterThanOrEqual(r.next24h_in);
  });

  it('refuses units other than millimeters', () => {
    const bad = { properties: { updateTime: '', quantitativePrecipitation: { uom: 'wmoUnit:in', values: [] } } };
    expect(() => parseRain(bad, 0)).toThrow(/unit/);
  });
});

describe('percentileRank', () => {
  it('counts ties as half', () => {
    expect(percentileRank(20, [10, 20, 20, 40])).toBe(50);
    expect(percentileRank(10, [10, 20, 20, 40])).toBe(12.5);
    expect(percentileRank(40, [10, 20, 20, 40])).toBe(87.5);
  });
});

const tract = (geoid: string, v: number, extra: Partial<TractRaw> = {}): TractRaw => ({
  geoid,
  county_fips: '45091',
  population: 3000,
  households: 1200,
  pct_65plus: v,
  pct_no_vehicle: v,
  pct_poverty: v,
  pct_disability: v,
  pct_sfha: v,
  ...extra,
});

describe('vulnerability scoring (brief 7.5)', () => {
  it('flags tiny tracts (dorms, prisons) as insufficient data', () => {
    expect(dataQuality(tract('a', 5, { population: 190 }))).toBe('insufficient');
    expect(dataQuality(tract('a', 5, { households: 0 }))).toBe('insufficient');
    expect(dataQuality(tract('a', 5, { pct_poverty: null }))).toBe('insufficient');
    expect(dataQuality(tract('a', 5))).toBe('ok');
  });

  it('scores are relative ranks: the highest tract scores highest', () => {
    const scored = scoreTracts([tract('low', 1), tract('mid', 5), tract('high', 9)]);
    const by = Object.fromEntries(scored.map((t) => [t.geoid, t]));
    expect(by.low.vulnerability_score!).toBeLessThan(by.mid.vulnerability_score!);
    expect(by.mid.vulnerability_score!).toBeLessThan(by.high.vulnerability_score!);
    expect(by.high.vulnerability_score).toBe(83); // (2 + 0.5) / 3 = 83.3%
  });

  it('vulnerability is the mean of the four measure ranks', () => {
    // "a" ranks highest on two measures and lowest on two: it lands in the middle.
    const scored = scoreTracts([
      tract('a', 0, { pct_65plus: 9, pct_no_vehicle: 9, pct_poverty: 1, pct_disability: 1 }),
      tract('b', 5),
    ]);
    expect(scored[0].vulnerability_score).toBe(50);
  });

  it('insufficient tracts get no vulnerability score and are left out of the ranking', () => {
    const scored = scoreTracts([tract('tiny', 99, { population: 50 }), tract('x', 1), tract('y', 2)]);
    expect(scored[0].vulnerability_score).toBeNull();
    expect(scored[0].priority_score).toBeNull();
    expect(scored[2].vulnerability_score).toBe(75); // ranked among x and y only
  });

  it('priority is the average of vulnerability and exposure', () => {
    const [a] = scoreTracts([tract('a', 9), tract('b', 1)]);
    expect(a.priority_score).toBe(Math.round((a.vulnerability_score! + a.exposure_score!) / 2));
  });

  it('district average is population-weighted', () => {
    const avg = districtAverage([tract('a', 10, { population: 1000 }), tract('b', 20, { population: 3000 })], 'pct_poverty');
    expect(avg).toBe(17.5);
  });

  it('bands scores in plain language', () => {
    expect(scoreBand(85)).toBe('Very high');
    expect(scoreBand(10)).toBe('Very low');
    expect(scoreBand(null)).toBe('Insufficient data');
  });
});

describe('geometry helpers', () => {
  const withHole: GeoJSON.Polygon = {
    type: 'Polygon',
    coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
    ],
  };
  it('point in polygon respects holes', () => {
    expect(pointInGeometry(2, 2, withHole)).toBe(true);
    expect(pointInGeometry(5, 5, withHole)).toBe(false);
    expect(pointInGeometry(12, 5, withHole)).toBe(false);
  });
  it('distance between Rock Hill and Lancaster is about 30 km', () => {
    expect(distanceKm(34.9249, -81.0251, 34.7204, -80.7709)).toBeCloseTo(32, 0);
  });
});

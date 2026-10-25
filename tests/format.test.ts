import { describe, it, expect } from 'vitest';
import { gaugeName, feet } from '../shared/format';
import { sparklinePoints } from '../shared/sparkline';

describe('gaugeName', () => {
  it('makes USGS names readable', () => {
    expect(gaugeName('CATAWBA RIVER BL LAKE WYLIE DAM FEWELL ISLAND, SC')).toBe('Catawba River below Lake Wylie Dam Fewell Island');
    expect(gaugeName('ALLISON CREEK AT RD 114 NEAR YORK, SC')).toBe('Allison Creek at Rd 114 near York');
    expect(gaugeName('SUGAR CREEK NR FORT MILL, SC')).toBe('Sugar Creek near Fort Mill');
  });
});

describe('feet', () => {
  it('shows two decimals', () => expect(feet(5.1)).toBe('5.10 ft'));
});

describe('sparklinePoints', () => {
  it('needs at least two readings', () => {
    expect(sparklinePoints([{ time: '2026-10-17T20:00:00Z', value: 1 }])).toBe('');
  });
  it('puts the first point on the left and the last on the right', () => {
    const pts = sparklinePoints(
      [
        { time: '2026-10-17T20:00:00Z', value: 1 },
        { time: '2026-10-17T21:00:00Z', value: 2 },
      ],
      100,
      20,
    ).split(' ');
    expect(pts[0].startsWith('2.0,')).toBe(true);
    expect(pts[1].startsWith('98.0,')).toBe(true);
  });
});

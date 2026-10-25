import { describe, it, expect } from 'vitest';
import latest from './fixtures/usgs-latest-continuous-york.json';
import series6h from './fixtures/usgs-continuous-pt6h.json';
import legacy from './fixtures/usgs-nwis-iv-york.json';
import {
  floodCategory,
  computeTrend,
  parseOgcReadings,
  parseLegacyReadings,
  buildGauge,
} from '../shared/data/usgs';
import type { FloodStages, Reading } from '../shared/data/types';

// Real official stages for Catawba River near Rock Hill (NOAA RHIS1)
const RHIS1: FloodStages = { action: 13, minor: 15, moderate: 25, major: 30 };

describe('floodCategory', () => {
  it('is null below action stage', () => expect(floodCategory(5.11, RHIS1)).toBeNull());

  it('uses the highest stage reached', () => {
    expect(floodCategory(13, RHIS1)).toBe('action');
    expect(floodCategory(15.2, RHIS1)).toBe('minor');
    expect(floodCategory(25, RHIS1)).toBe('moderate');
    expect(floodCategory(31, RHIS1)).toBe('major');
  });

  it('never invents a category for gauges with no official stage', () => {
    expect(floodCategory(99, null)).toBeNull();
  });

  it('skips stages NOAA left undefined', () => {
    expect(floodCategory(20, { action: null, minor: 15, moderate: null, major: null })).toBe('minor');
  });
});

describe('computeTrend', () => {
  const at = (hour: number, value: number): Reading => ({
    time: new Date(Date.UTC(2026, 9, 17, hour)).toISOString(),
    value,
  });

  it('rising when the water went up 0.1 ft or more over 3 hours', () => {
    expect(computeTrend([at(10, 5.0), at(11, 5.1), at(13, 5.4)])).toBe('rising');
  });

  it('falling when it went down 0.1 ft or more', () => {
    expect(computeTrend([at(10, 5.4), at(13, 5.2)])).toBe('falling');
  });

  it('steady for small changes', () => {
    expect(computeTrend([at(10, 5.0), at(13, 5.05)])).toBe('steady');
  });

  it('unknown with too little data', () => {
    expect(computeTrend([at(13, 5)])).toBe('unknown');
  });

  it('works on a real 6-hour USGS series', () => {
    const s = parseOgcReadings(series6h as never).get('02146000')!;
    expect(s.length).toBeGreaterThan(10);
    expect(['rising', 'falling', 'steady']).toContain(computeTrend(s));
  });
});

describe('parseOgcReadings (real Water Data API response)', () => {
  it('strips the USGS- prefix and converts text values to numbers', () => {
    expect(parseOgcReadings(latest as never).get('02146000')?.[0].value).toBe(5.11);
  });

  it('keeps readings sorted oldest to newest', () => {
    const s = parseOgcReadings(series6h as never).get('02146000')!;
    for (let i = 1; i < s.length; i++) expect(s[i].time >= s[i - 1].time).toBe(true);
  });
});

describe('parseLegacyReadings (real legacy response)', () => {
  it('reads gage height for each site', () => {
    const bySite = parseLegacyReadings(legacy as never);
    expect(bySite.get('02146000')!.at(-1)!.value).toBe(5.11);
    expect(bySite.get('021459367')!.length).toBeGreaterThan(0);
  });
});

describe('buildGauge', () => {
  const site = {
    site_id: '02146000',
    nws_id: 'RHIS1',
    name: 'CATAWBA RIVER NEAR ROCK HILL, SC',
    lat: 34.98,
    lon: -80.97,
    county_fips: '45091',
    stages: RHIS1,
  };

  it('marks data provisional and flags official stages', () => {
    const g = buildGauge(site, [{ time: '2026-10-17T22:00:00.000Z', value: 16 }]);
    expect(g.provisional).toBe(true);
    expect(g.has_official_stage).toBe(true);
    expect(g.flood_category).toBe('minor');
  });

  it('handles a gauge with no recent readings', () => {
    const g = buildGauge(site, []);
    expect(g.latest).toBeNull();
    expect(g.flood_category).toBeNull();
  });
});

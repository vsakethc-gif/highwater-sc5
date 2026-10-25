import { describe, it, expect } from 'vitest';
import { makeSnapshot, restoreSnapshot } from '../shared/data/snapshot';
import { buildGauge } from '../shared/data/usgs';
import { evaluate } from '../shared/hazards/engine';
import type { Alert, GaugeSite } from '../shared/data/types';

const NOW = Date.parse('2026-10-17T23:00:00Z');
const alert = (event: string, fips: string, ends: string): Alert => ({
  id: event + fips,
  event,
  severity: 'Severe',
  urgency: 'Expected',
  certainty: 'Likely',
  headline: event,
  description: '',
  instruction: '',
  sent: '2026-10-17T20:00:00Z',
  onset: null,
  ends,
  county_fips: [fips],
  geometry: null,
  url: 'https://api.weather.gov/alerts/x',
  action: 'CON',
  damage_threat: {},
});
const SITE: GaugeSite = {
  site_id: '02146000',
  nws_id: 'RHIS1',
  name: 'CATAWBA RIVER NEAR ROCK HILL, SC',
  lat: 34.98,
  lon: -80.97,
  county_fips: '45091',
  stages: { action: 13, minor: 15, moderate: 25, major: 30 },
};
const series = Array.from({ length: 25 }, (_, i) => ({ time: new Date(NOW - (24 - i) * 15 * 60_000).toISOString(), value: 16 }));

describe('offline "last loaded" copy (P1a)', () => {
  const snap = makeSnapshot(
    '45091',
    [alert('Flood Warning', '45091', '2026-10-18T06:00:00Z'), alert('Lake Wind Advisory', '45057', '2026-10-18T06:00:00Z')],
    [buildGauge(SITE, series), buildGauge({ ...SITE, site_id: 'other', county_fips: '45057' }, series)],
    { next24h_in: 0.5, next48h_in: 0.7, updated_at: '2026-10-17T22:00:00Z' },
    NOW,
  );

  it('keeps only the chosen county, and only the last 3 hours of readings', () => {
    expect(snap.alerts.map((a) => a.event)).toEqual(['Flood Warning']);
    expect(snap.gauges).toHaveLength(1);
    expect(snap.gauges[0].recent_series.length).toBe(13); // 3 hours of 15-minute readings
  });

  it('round-trips through storage text', () => {
    const back = restoreSnapshot(JSON.stringify(snap), NOW);
    expect(back?.saved_at).toBe(snap.saved_at);
    expect(back?.gauges[0].latest?.value).toBe(16);
  });

  it('drops alerts that ended after the copy was saved', () => {
    const later = Date.parse('2026-10-18T07:00:00Z');
    expect(restoreSnapshot(JSON.stringify(snap), later)?.alerts).toHaveLength(0);
  });

  it('ignores broken saved data', () => {
    expect(restoreSnapshot('not json')).toBeNull();
    expect(restoreSnapshot('{"foo":1}')).toBeNull();
    expect(restoreSnapshot(null)).toBeNull();
  });

  it('old saved gauge readings never raise the level (stale rule still applies)', () => {
    const fourHoursLater = NOW + 4 * 3600_000;
    const back = restoreSnapshot(JSON.stringify({ ...snap, alerts: [] }), fourHoursLater)!;
    const s = evaluate({ alerts: back.alerts, gauges: back.gauges, rain: back.rain, now: fourHoursLater }, { kind: 'county', fips: '45091' });
    expect(s.level).toBe(0);
    expect(s.complete).toBe(false);
  });

  it('stores no exact location', () => {
    expect(JSON.stringify(snap)).not.toMatch(/"lat":\s*3[45]\.\d{3,}.*"label"/);
    expect(Object.keys(snap)).toEqual(['saved_at', 'fips', 'alerts', 'gauges', 'rain']);
  });
});

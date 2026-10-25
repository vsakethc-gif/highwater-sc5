import { describe, it, expect } from 'vitest';
import samples from './fixtures/nws-alerts-samples.json';
import active from './fixtures/nws-alerts-active-sc.json';
import { parseAlert, parseAlerts } from '../shared/data/nws';
import { buildGauge } from '../shared/data/usgs';
import { classifyAlert, ALERT_TABLE } from '../shared/hazards/alertMap';
import { evaluate, alertAppliesTo } from '../shared/hazards/engine';
import type { Alert, GaugeSite } from '../shared/data/types';
import type { HazardInputs, Place } from '../shared/hazards/types';

const NOW = Date.parse('2026-10-17T23:00:00Z');
const YORK: Place = { kind: 'county', fips: '45091' };

/** A minimal alert for rule tests. */
function alert(event: string, extra: Partial<Alert> = {}): Alert {
  return {
    id: event,
    event,
    severity: 'Severe',
    urgency: 'Immediate',
    certainty: 'Observed',
    headline: event,
    description: '',
    instruction: '',
    sent: '2026-10-17T22:00:00Z',
    onset: null,
    ends: '2026-10-18T06:00:00Z',
    county_fips: ['45091'],
    geometry: null,
    url: 'https://api.weather.gov/alerts/x',
    action: 'NEW',
    damage_threat: {},
    ...extra,
  };
}

const RHIS1: GaugeSite = {
  site_id: '02146000',
  nws_id: 'RHIS1',
  name: 'CATAWBA RIVER NEAR ROCK HILL, SC',
  lat: 34.98,
  lon: -80.97,
  county_fips: '45091',
  stages: { action: 13, minor: 15, moderate: 25, major: 30 },
};
const NO_STAGE: GaugeSite = { ...RHIS1, site_id: '02145910', nws_id: null, name: 'CATAWBA RIVER BL LAKE WYLIE DAM, SC', stages: null };
const reading = (value: number, minutesAgo = 15) => [{ time: new Date(NOW - minutesAgo * 60_000).toISOString(), value }];

const calm: HazardInputs = {
  alerts: [],
  gauges: [buildGauge(RHIS1, reading(5.1))],
  rain: { next24h_in: 0.2, next48h_in: 0.4, updated_at: new Date(NOW).toISOString() },
  now: NOW,
};

describe('classifyAlert (mapping table, brief 7.3)', () => {
  it('maps watches, warnings, and advisories', () => {
    expect(classifyAlert(alert('Flood Watch'))).toEqual({ hazard: 'flood', level: 1 });
    expect(classifyAlert(alert('Flood Advisory'))).toEqual({ hazard: 'flood', level: 1 });
    expect(classifyAlert(alert('Flash Flood Warning'))).toEqual({ hazard: 'flood', level: 2 });
    expect(classifyAlert(alert('Tornado Watch'))).toEqual({ hazard: 'tornado', level: 1 });
    expect(classifyAlert(alert('Tornado Warning'))).toEqual({ hazard: 'tornado', level: 2 });
    expect(classifyAlert(alert('Lake Wind Advisory'))).toEqual({ hazard: 'wind', level: 1 });
  });

  it('knows both new and old NWS heat and cold names', () => {
    expect(classifyAlert(alert('Extreme Heat Warning')).hazard).toBe('heat');
    expect(classifyAlert(alert('Excessive Heat Warning')).hazard).toBe('heat');
    expect(classifyAlert(alert('Extreme Cold Warning')).hazard).toBe('cold');
    expect(classifyAlert(alert('Wind Chill Warning')).hazard).toBe('cold');
  });

  it('raises a real Flash Flood Warning tagged CONSIDERABLE to Danger', () => {
    const ff = parseAlert((samples as any).features.find((f: any) => f.properties.event === 'Flash Flood Warning'));
    const result = classifyAlert(ff);
    expect(result.level).toBe(3);
    expect(result.reason).toMatch(/considerable/);
  });

  it('raises tornado warnings with a catastrophic tag or emergency wording to Danger', () => {
    expect(classifyAlert(alert('Tornado Warning', { damage_threat: { tornadoDamageThreat: 'CATASTROPHIC' } })).level).toBe(3);
    expect(classifyAlert(alert('Tornado Warning', { description: 'This is a TORNADO EMERGENCY for Rock Hill.' })).level).toBe(3);
  });

  it('raises a destructive severe thunderstorm warning to Danger', () => {
    expect(classifyAlert(alert('Severe Thunderstorm Warning', { damage_threat: { thunderstormDamageThreat: 'DESTRUCTIVE' } })).level).toBe(3);
    expect(classifyAlert(alert('Severe Thunderstorm Warning', { damage_threat: { thunderstormDamageThreat: 'CONSIDERABLE' } })).level).toBe(2);
  });

  it('a PDS Tornado WATCH stays a Watch', () => {
    expect(classifyAlert(alert('Tornado Watch', { description: 'PARTICULARLY DANGEROUS SITUATION' })).level).toBe(1);
  });

  it('only storm-related Special Weather Statements count as storms', () => {
    expect(classifyAlert(alert('Special Weather Statement', { description: 'A strong thunderstorm will impact...' })).hazard).toBe('severe_storm');
    const real = parseAlert((samples as any).features.find((f: any) => f.properties.event === 'Special Weather Statement'));
    expect(classifyAlert(real)).toEqual({ hazard: 'other', level: 1 });
  });

  it('unknown events become "Other" at Watch; information-only events never raise the status', () => {
    expect(classifyAlert(alert('Something New'))).toEqual({ hazard: 'other', level: 1 });
    expect(classifyAlert(alert('Hazardous Weather Outlook')).level).toBe(0);
  });

  it('every table entry has a valid level', () => {
    for (const rule of Object.values(ALERT_TABLE)) expect([0, 1, 2, 3]).toContain(rule.level);
  });
});

describe('alertAppliesTo', () => {
  const square: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[-81.1, 34.9], [-80.9, 34.9], [-80.9, 35.1], [-81.1, 35.1], [-81.1, 34.9]]] };

  it('county view: any alert listing the county', () => {
    expect(alertAppliesTo(alert('Tornado Warning', { geometry: square }), YORK)).toBe(true);
    expect(alertAppliesTo(alert('Tornado Warning', { county_fips: ['45057'] }), YORK)).toBe(false);
  });

  it('point view: must be inside the warning polygon when NWS drew one', () => {
    const inside: Place = { kind: 'point', fips: '45091', lat: 35.0, lon: -81.0, label: 'Rock Hill' };
    const outside: Place = { kind: 'point', fips: '45091', lat: 34.95, lon: -81.3, label: 'York' };
    expect(alertAppliesTo(alert('Tornado Warning', { geometry: square }), inside)).toBe(true);
    expect(alertAppliesTo(alert('Tornado Warning', { geometry: square }), outside)).toBe(false);
    expect(alertAppliesTo(alert('Flood Watch'), outside)).toBe(true); // no polygon: whole county
  });
});

describe('evaluate: overall status', () => {
  it('Normal with no alerts, gauges below flood stage, light rain', () => {
    const s = evaluate(calm, YORK);
    expect(s.level).toBe(0);
    expect(s.complete).toBe(true);
    expect(s.all[0].hazard).toBe('flood');
  });

  it('is the highest level across hazards, and lists active hazards highest first', () => {
    const s = evaluate({ ...calm, alerts: [alert('Flood Watch'), alert('Tornado Warning')] }, YORK);
    expect(s.level).toBe(2);
    expect(s.active.map((h) => h.hazard)).toEqual(['tornado', 'flood']);
  });

  it('every active hazard explains itself with triggers and sources', () => {
    const s = evaluate({ ...calm, alerts: [alert('Flood Warning')] }, YORK);
    expect(s.active[0].triggers[0]).toMatchObject({ level: 2, text: 'Flood Warning', source: 'National Weather Service' });
  });

  it('ignores the real Oct 17 Lancaster wind advisory when looking at York', () => {
    const alerts = parseAlerts(active as never, NOW);
    expect(evaluate({ ...calm, alerts }, YORK).level).toBe(0);
    expect(evaluate({ ...calm, alerts }, { kind: 'county', fips: '45057' }).active[0].hazard).toBe('wind');
  });
});

describe('evaluate: flood rules (brief 7.4)', () => {
  const withGauge = (value: number, site = RHIS1, minutesAgo = 15) =>
    evaluate({ ...calm, gauges: [buildGauge(site, reading(value, minutesAgo))] }, YORK);

  it('action stage → Watch, minor → Warning, moderate or major → Danger', () => {
    expect(withGauge(13.5).level).toBe(1);
    expect(withGauge(16).level).toBe(2);
    expect(withGauge(26).level).toBe(3);
    expect(withGauge(31).level).toBe(3);
  });

  it('describes the gauge in the trigger', () => {
    expect(withGauge(16).active[0].triggers[0].text).toBe('Catawba River near Rock Hill is in minor flood (16.00 ft)');
  });

  it('gauges without an official flood stage never raise the level', () => {
    expect(withGauge(99, NO_STAGE).level).toBe(0);
  });

  it('a stale gauge reading never raises the level, and the status is marked incomplete', () => {
    const s = withGauge(26, RHIS1, 180);
    expect(s.level).toBe(0);
    expect(s.complete).toBe(false);
    expect(s.gaps[0]).toMatch(/old or missing/);
  });

  it('2 inches of forecast rain in 24 hours → Watch; less does not', () => {
    const rain = (inches: number) => evaluate({ ...calm, rain: { next24h_in: inches, next48h_in: inches, updated_at: '' } }, YORK);
    expect(rain(2).level).toBe(1);
    expect(rain(1.99).level).toBe(0);
  });
});

describe('evaluate: missing data is never an all-clear', () => {
  it('marks status incomplete when alerts fail to load', () => {
    const s = evaluate({ ...calm, alerts: null }, YORK);
    expect(s.complete).toBe(false);
    expect(s.gaps.join(' ')).toMatch(/National Weather Service/);
  });

  it('marks status incomplete when gauges or rain fail to load', () => {
    expect(evaluate({ ...calm, gauges: null }, YORK).complete).toBe(false);
    expect(evaluate({ ...calm, rain: null }, YORK).complete).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import active from './fixtures/nws-alerts-active-sc.json';
import samples from './fixtures/nws-alerts-samples.json';
import { vtecAction, parseAlert, parseAlerts, alertsForCounty, sameToFips, isEnded } from '../shared/data/nws';

const sampleFeatures = (samples as any).features as any[];
const feature = (event: string) => sampleFeatures.find((f) => f.properties.event === event);

describe('vtecAction', () => {
  it('reads the action code', () => {
    expect(vtecAction('/O.NEW.KGSP.FF.W.0024.261011T0911Z-261011T1500Z/')).toBe('NEW');
    expect(vtecAction('/O.CAN.KCAE.FL.W.0004.000000T0000Z-261014T2106Z/')).toBe('CAN');
  });

  it('is null for alerts without VTEC (statements)', () => expect(vtecAction(undefined)).toBeNull());
});

describe('sameToFips', () => {
  it('drops the leading zero', () => expect(sameToFips('045091')).toBe('45091'));
});

describe('parseAlert (real alerts)', () => {
  it('reads the flash flood damage threat tag', () => {
    const a = parseAlert(feature('Flash Flood Warning'));
    expect(a.action).toBe('NEW');
    expect(a.damage_threat.flashFloodDamageThreat).toBe('CONSIDERABLE');
    expect(a.geometry).not.toBeNull();
  });

  it('keeps the polygon of a tornado warning', () => {
    expect(parseAlert(feature('Tornado Warning')).geometry?.type).toBe('Polygon');
  });

  it('links to the official alert', () => {
    expect(parseAlert(feature('Tornado Warning')).url).toMatch(/^https:\/\/api\.weather\.gov\/alerts\//);
  });
});

describe('parseAlerts filters out alerts that are over', () => {
  it('drops cancelled warnings', () => {
    const cancelled = sampleFeatures.filter((f) => f.properties.parameters.VTEC?.[0].includes('.CAN.'));
    expect(cancelled.length).toBeGreaterThan(0);
    expect(parseAlerts({ features: cancelled }, Date.parse('2026-10-10T00:00:00Z'))).toHaveLength(0);
  });

  it('drops alerts whose end time has passed', () => {
    const now = Date.parse('2026-10-17T13:00:00Z');
    expect(isEnded({ action: 'CON', ends: '2026-10-17T12:00:00Z' }, now)).toBe(true);
    expect(isEnded({ action: 'CON', ends: '2026-10-17T14:00:00Z' }, now)).toBe(false);
  });
});

describe('alertsForCounty (real Oct 17 alerts)', () => {
  const alerts = parseAlerts(active as never, Date.parse('2026-10-17T22:55:00Z'));

  it('finds the Lake Wind Advisory for Lancaster County', () => {
    expect(alertsForCounty(alerts, '45057').map((a) => a.event)).toContain('Lake Wind Advisory');
  });

  it('finds no alerts for York County', () => {
    expect(alertsForCounty(alerts, '45091')).toHaveLength(0);
  });
});

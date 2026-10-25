import { describe, it, expect } from 'vitest';
import { guidanceFor, routeAllowed, TURN_AROUND } from '../shared/guidance/guidance';
import type { GuidanceContext } from '../shared/guidance/types';
import type { HazardId, HazardStatus } from '../shared/hazards/types';
import type { Level } from '../shared/hazards/levels';

const ctx: GuidanceContext = { placeName: 'York County', inFloodZone: null, pctNoVehicle: 3, vulnerability: 40 };
const status = (hazard: HazardId, level: Level, text = 'Test alert'): HazardStatus => ({
  hazard,
  level,
  triggers: level ? [{ level, text, source: 'test' }] : [],
  updated_at: '',
});

describe('guidance selection (brief 9)', () => {
  it('every flood level includes "Turn around, don’t drown" from Watch up', () => {
    for (const level of [1, 2, 3] as Level[]) {
      expect(guidanceFor(status('flood', level), ctx).doNow.join(' ')).toContain('Turn around, don’t drown');
    }
  });

  it('gives 3 to 6 "do this now" steps for every hazard and level', () => {
    const hazards: HazardId[] = ['flood', 'tornado', 'severe_storm', 'heat', 'wind', 'other'];
    for (const h of hazards) {
      for (const level of [0, 1, 2, 3] as Level[]) {
        if (h !== 'flood' && level === 0) continue;
        const n = guidanceFor(status(h, level), ctx).doNow.length;
        expect(n, `${h} level ${level}`).toBeGreaterThanOrEqual(3);
        expect(n, `${h} level ${level}`).toBeLessThanOrEqual(6);
      }
    }
  });

  it('builds "What’s happening" from the actual trigger', () => {
    const g = guidanceFor(status('flood', 2, 'Catawba River near Rock Hill is in minor flood (16.00 ft)'), ctx);
    expect(g.whatsHappening).toContain('Catawba River near Rock Hill is in minor flood');
  });

  it('tornado: shelter in place, NO route button, never suggests driving away', () => {
    const g = guidanceFor(status('tornado', 2, 'Tornado Warning'), ctx);
    expect(g.shelterInPlace).toBe(true);
    expect(g.canRoute).toBe(false);
    expect(g.doNow.join(' ')).toMatch(/interior room on the lowest floor/);
    expect(routeAllowed([g])).toBe(false);
  });

  it('severe storm and extreme heat/cold never offer a route', () => {
    for (const h of ['severe_storm', 'heat', 'cold'] as HazardId[]) {
      expect(guidanceFor(status(h, 2), ctx).canRoute).toBe(false);
    }
  });

  it('flood Warning or Danger can offer a route; Watch cannot', () => {
    expect(guidanceFor(status('flood', 1), ctx).canRoute).toBe(false);
    expect(guidanceFor(status('flood', 2), ctx).canRoute).toBe(true);
  });

  it('a Tornado Warning during a flood blocks the route button (do not drive into a tornado)', () => {
    const blocks = [guidanceFor(status('flood', 2), ctx), guidanceFor(status('tornado', 2), ctx)];
    expect(routeAllowed(blocks)).toBe(false);
  });

  it('in a FEMA flood zone, a flood Watch says to be ready to leave', () => {
    const g = guidanceFor(status('flood', 1), { ...ctx, inFloodZone: true });
    expect(g.doNow.join(' ')).toMatch(/high-risk flood zone/);
  });

  it('many households without a car: adds transportation help and a stronger check-on-others line', () => {
    const g = guidanceFor(status('flood', 2), { ...ctx, pctNoVehicle: 12 });
    expect(g.doNow.join(' ')).toMatch(/don’t have a car/);
    expect(g.checkOnOthers).toMatch(/knock on doors/);
  });

  it('never calls a place or route "safe"', () => {
    const hazards: HazardId[] = ['flood', 'tornado', 'severe_storm', 'tropical', 'heat', 'other'];
    for (const h of hazards) {
      for (const level of [0, 1, 2, 3] as Level[]) {
        const g = guidanceFor(status(h, level), { ...ctx, inFloodZone: true, pctNoVehicle: 20, vulnerability: 90 });
        const all = [g.whatsHappening, ...g.doNow, ...g.ifWorse, g.checkOnOthers].join(' ');
        expect(all, `${h} ${level}`).not.toMatch(/\bsafe(ly|ty)?\b/i);
      }
    }
    expect(TURN_AROUND).not.toMatch(/\bsafe\b/i);
  });

  it('links to official sources', () => {
    for (const link of guidanceFor(status('flood', 2), ctx).links) {
      expect(link.url).toMatch(/^https:\/\/(www\.)?(weather\.gov|ready\.gov|scemd\.org|redcross\.org)\//);
    }
  });
});

describe('multi-hazard guidance (P1a)', () => {
  const ALL: HazardId[] = ['tropical', 'winter', 'cold', 'heat', 'wind', 'fire_weather', 'fog', 'air_quality', 'evacuation'];

  it('every hazard has 3–6 steps, official links, and no "safe" at every level', () => {
    for (const h of ALL) {
      for (const level of [1, 2, 3] as Level[]) {
        const g = guidanceFor(status(h, level, 'Test alert'), ctx);
        expect(g.doNow.length, `${h} ${level}`).toBeGreaterThanOrEqual(3);
        expect(g.doNow.length, `${h} ${level}`).toBeLessThanOrEqual(6);
        expect(g.links.length, `${h} links`).toBeGreaterThan(0);
        for (const l of g.links) expect(l.url).toMatch(/^https:\/\/(www\.)?(weather\.gov|ready\.gov|scemd\.org|airnow\.gov)\//);
        const text = [g.whatsHappening, ...g.doNow, ...g.ifWorse].join(' ');
        expect(text, `${h} ${level}`).not.toMatch(/\bsafe(ly|ty)?\b/i);
        expect(text, `${h} ${level}`).not.toContain('{');
      }
    }
  });

  it('Watch gives "get ready" steps and Warning gives "act now" steps', () => {
    expect(guidanceFor(status('winter', 1), ctx).doNow[0]).toMatch(/food, water, and medicine/);
    expect(guidanceFor(status('winter', 2), ctx).doNow[0]).toMatch(/Stay off the roads/);
  });

  it('Extreme Wind Warning (tropical Danger) means take shelter now, no route', () => {
    const g = guidanceFor(status('tropical', 3, 'Extreme Wind Warning'), ctx);
    expect(g.shelterInPlace).toBe(true);
    expect(g.canRoute).toBe(false);
    expect(g.doNow[0]).toMatch(/interior room on the lowest floor/);
  });

  it('a hurricane warning can offer a route; heat, cold, winter, and wind never do', () => {
    expect(guidanceFor(status('tropical', 2), ctx).canRoute).toBe(true);
    for (const h of ['heat', 'cold', 'winter', 'wind'] as HazardId[]) expect(guidanceFor(status(h, 2), ctx).canRoute).toBe(false);
  });

  it('an evacuation order says leave now and can offer a route', () => {
    const g = guidanceFor(status('evacuation', 3, 'Evacuation Immediate'), ctx);
    expect(g.doNow[0]).toMatch(/^Leave now/);
    expect(g.canRoute).toBe(true);
  });

  it('heat guidance says never leave people or pets in a closed car', () => {
    expect(guidanceFor(status('heat', 2), ctx).doNow.join(' ')).toMatch(/Never leave people or pets in a closed car/);
  });

  it('builds "What’s happening" from the trigger and the place', () => {
    const g = guidanceFor(status('heat', 2, 'Extreme Heat Warning'), ctx);
    expect(g.whatsHappening).toBe('Dangerous heat is happening or about to happen in York County: Extreme Heat Warning.');
  });
});

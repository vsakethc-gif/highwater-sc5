import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SCENARIOS, scenarioAlerts, scenarioGauges, scenarioRain, loadScenario, type ScenarioFile } from '../shared/scenario/scenario';
import { evaluate } from '../shared/hazards/engine';
import { guidanceFor, routeAllowed } from '../shared/guidance/guidance';
import type { GaugeSite } from '../shared/data/types';
import type { HazardId } from '../shared/hazards/types';

// The real gauge list the app ships with.
const SITES: GaugeSite[] = JSON.parse(readFileSync('public/data/gauges.json', 'utf8')).gauges;
const NOW = Date.parse('2026-10-17T23:00:00Z');

// Load every scenario up front (the Helene replays are loaded on demand in the app).
const ALL = new Map<string, ScenarioFile>();
for (const info of SCENARIOS) ALL.set(info.id, (await loadScenario(info.id))!);
const SYNTHETIC = [...ALL.values()].filter((s) => !s.replay);

function run(id: string, county?: string) {
  const s = ALL.get(id)!;
  const status = evaluate(
    { alerts: scenarioAlerts(s, NOW), gauges: scenarioGauges(s, SITES, NOW), rain: scenarioRain(s, NOW), now: NOW },
    { kind: 'county', fips: county ?? s.county },
  );
  const ctx = { placeName: 'test', inFloodZone: null, pctNoVehicle: null, vulnerability: null };
  return { status, blocks: status.active.map((a) => guidanceFor(a, ctx)) };
}

describe('Scenario Mode (brief 12.8)', () => {
  it('every scenario gauge exists in the real gauge list', () => {
    for (const s of ALL.values()) {
      for (const id of Object.keys(s.gauges)) expect(SITES.some((g) => g.site_id === id), `${s.id}: ${id}`).toBe(true);
    }
  });

  it('every simulated alert says SIMULATED in its text', () => {
    for (const s of SYNTHETIC) for (const a of s.alerts) expect(a.description).toMatch(/^SIMULATED/);
  });

  it.each([
    ['york-flood-watch', 1, 'flood'],
    ['york-flood-warning', 2, 'flood'],
    ['york-flash-flood-emergency', 3, 'flood'],
    ['lancaster-tornado-warning', 2, 'tornado'],
    ['cherokee-extreme-heat', 2, 'heat'],
    ['kershaw-tropical-storm', 2, 'tropical'],
  ] as [string, number, HazardId][])('%s → level %i, top hazard %s', (id, level, hazard) => {
    const { status } = run(id);
    expect(status.level).toBe(level);
    expect(status.active[0].hazard).toBe(hazard);
    expect(status.complete).toBe(true);
  });

  it('shows all four levels across scenarios plus live Normal, and at least three hazard types', () => {
    const levels = new Set(SYNTHETIC.map((s) => run(s.id).status.level));
    expect([...levels].sort()).toEqual([1, 2, 3]);
    expect(new Set(SYNTHETIC.map((s) => run(s.id).status.active[0].hazard)).size).toBeGreaterThanOrEqual(3);
  });

  it('the river flood warning comes from both the NWS alert and a gauge in minor flood', () => {
    const texts = run('york-flood-warning').status.active[0].triggers.map((t) => t.text);
    expect(texts).toContain('Flood Warning');
    expect(texts.some((t) => t.startsWith('Catawba River near Rock Hill is in minor flood'))).toBe(true);
  });

  it('tornado scenario: no route button', () => {
    expect(routeAllowed(run('lancaster-tornado-warning').blocks)).toBe(false);
  });

  it('simulated readings end at "now" so they are never treated as stale', () => {
    const s = ALL.get('york-flood-warning')!;
    const g = scenarioGauges(s, SITES, NOW).find((x) => x.site_id === '02146000')!;
    expect(g.latest?.time).toBe(new Date(NOW).toISOString());
    expect(g.latest?.value).toBe(16.4);
    expect(g.trend).toBe('rising');
  });
});

describe('multi-hazard scenarios', () => {
  it('tropical storm scenario shows two hazards: tropical first, then flooding (rain + Flood Watch)', () => {
    const { status } = run('kershaw-tropical-storm');
    expect(status.active.map((a) => a.hazard)).toEqual(['tropical', 'flood']);
    expect(status.active[1].level).toBe(1);
  });

  it('heat scenario: shelter in place, no route button, heat stroke advice', () => {
    const { blocks } = run('cherokee-extreme-heat');
    expect(blocks[0].shelterInPlace).toBe(true);
    expect(routeAllowed(blocks)).toBe(false);
    expect(blocks[0].ifWorse.join(' ')).toMatch(/Heat stroke is an emergency/);
  });
});

// The Helene replays are built from real archived data by scripts/build-helene.mjs.
// These checks compare the app's result with what actually happened.
describe('Hurricane Helene replays (real data)', () => {
  it('every replayed alert says it is a REPLAY of a real archived alert', () => {
    for (const id of ['helene-arrives', 'helene-rivers-crest']) {
      for (const a of ALL.get(id)!.alerts) expect(a.description).toMatch(/^REPLAY of a real alert/);
    }
  });

  it('Sept 27, 7:30 AM: York is Danger, because NWS tagged its Flash Flood Warning "considerable"', () => {
    const { status } = run('helene-arrives', '45091');
    expect(status.level).toBe(3);
    expect(status.active[0].hazard).toBe('flood');
    expect(status.active.map((a) => a.hazard)).toContain('tropical');
  });

  it('Sept 29, 2:30 AM: Kershaw is Danger from the Wateree River gauge in major flood', () => {
    const { status } = run('helene-rivers-crest', '45055');
    expect(status.level).toBe(3);
    expect(status.active[0].triggers.some((t) => t.text.startsWith('Wateree River') && t.text.includes('major flood'))).toBe(true);
  });

  it('a gauge with no archived reading is shown with no reading, never a made-up value', () => {
    const s = ALL.get('helene-arrives')!;
    const empty = SITES.find((g) => !('readings' in (s.gauges[g.site_id] ?? {})) || (s.gauges[g.site_id] as { readings: unknown[] }).readings.length === 0)!;
    expect(empty).toBeDefined();
    expect(scenarioGauges(s, SITES, NOW).find((g) => g.site_id === empty.site_id)!.latest).toBeNull();
  });
});

describe('Storm timeline (phone app Scenario timeline)', () => {
  it('steps through Normal → Watch → Warning → Danger in order, all in York County', async () => {
    const { STORM_TIMELINE, findScenario, timelineIndex } = await import('../shared/scenario/scenario');
    const levels: number[] = [];
    for (const step of STORM_TIMELINE.steps) {
      const s = (await loadScenario(step.id))!;
      expect(s.county).toBe('45091');
      expect(findScenario(step.id)?.id).toBe(step.id);
      const status = evaluate({ alerts: scenarioAlerts(s, NOW), gauges: scenarioGauges(s, SITES, NOW), rain: scenarioRain(s, NOW), now: NOW }, { kind: 'county', fips: s.county });
      expect(status.complete).toBe(true);
      levels.push(status.level);
    }
    expect(levels).toEqual([0, 1, 2, 3]);
    expect(timelineIndex('york-flood-warning')).toBe(2);
    expect(timelineIndex('lancaster-tornado-warning')).toBe(-1);
    // The calm step is timeline-only: not offered in the scenario picker.
    expect(SCENARIOS.some((x) => x.id === 'york-calm')).toBe(false);
  });
});

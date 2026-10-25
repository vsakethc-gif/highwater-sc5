/**
 * scenario.ts — Scenario Mode (brief 12.8): clearly labeled SIMULATIONS for demos.
 *
 * Each scenario is a small JSON file in ./scenarios with fake alerts, gauge readings,
 * and a rain forecast. They are turned into the same shapes as live data and run
 * through the same engine, so the demo shows exactly how the real rules respond.
 * Times are relative to "now" so a scenario always looks current.
 * Nothing from Scenario Mode is ever sent anywhere or saved.
 *
 * Two scenarios are REPLAYS of Hurricane Helene (Sept 2024) built from real archived data by
 * scripts/build-helene.mjs. They're larger, so they download only when someone picks them.
 */
import type { Alert, Gauge, GaugeSite, Reading } from '../data/types';
import { buildGauge } from '../data/usgs';
import type { RainForecast } from '../hazards/types';
import floodWarning from './scenarios/york-flood-warning.json';
import flashFlood from './scenarios/york-flash-flood-emergency.json';
import floodWatch from './scenarios/york-flood-watch.json';
import tornado from './scenarios/lancaster-tornado-warning.json';
import heat from './scenarios/cherokee-extreme-heat.json';
import tropical from './scenarios/kershaw-tropical-storm.json';
import calm from './scenarios/york-calm.json';

interface ScenarioAlert {
  event: string;
  headline: string;
  description: string;
  instruction: string;
  county_fips: string[];
  damage_threat?: Record<string, string>;
  polygon?: number[][];
  startOffsetMin: number;
  endOffsetMin: number;
}

/** What the picker and banner need to know about a scenario. */
export interface ScenarioInfo {
  id: string;
  title: string;
  summary: string;
  county: string;
}

export interface ScenarioFile extends ScenarioInfo {
  alerts: ScenarioAlert[];
  /**
   * USGS site id → either a made-up straight-line rise from `from` to `to` over 6 hours,
   * or (replays) real `readings` as [minutes before the moment, feet].
   */
  gauges: Record<string, { from: number; to: number } | { readings: [number, number][] }>;
  rain: { next24h_in: number; next48h_in: number };
  /** Set only on replays of a real event. */
  replay?: { moment: string; note: string };
}

const SYNTHETIC = [floodWatch, floodWarning, flashFlood, tornado, heat, tropical] as ScenarioFile[];

/** Real-data replays: downloaded only when someone picks one (each file is about 80 KB). */
const REPLAYS: Record<string, { info: ScenarioInfo; load: () => Promise<ScenarioFile> }> = {
  'helene-arrives': {
    info: {
      id: 'helene-arrives',
      title: 'Hurricane Helene arrives (real data, Sept 27, 2024)',
      summary: 'Real alerts and river readings from 7:30 AM on Sept 27, 2024, as Helene’s remnants crossed SC-5.',
      county: '45091',
    },
    load: () => import('./scenarios/helene-arrives.json').then((m) => m.default as unknown as ScenarioFile),
  },
  'helene-rivers-crest': {
    info: {
      id: 'helene-rivers-crest',
      title: 'Helene: rivers crest (real data, Sept 29, 2024)',
      summary: 'Real alerts and river readings from 2:30 AM on Sept 29, 2024, as the Broad, Catawba, and Wateree rivers crested.',
      county: '45091',
    },
    load: () => import('./scenarios/helene-rivers-crest.json').then((m) => m.default as unknown as ScenarioFile),
  },
};

/** Every scenario for the picker: the two real-data replays first. */
export const SCENARIOS: ScenarioInfo[] = [...Object.values(REPLAYS).map((r) => r.info), ...SYNTHETIC];

/**
 * The storm timeline (phone app): four made-up moments of one storm over York County, from calm to a
 * Flash Flood Emergency. Dragging the timeline steps through them, so a viewer sees Normal → Watch →
 * Warning → Danger. The calm step is used only here, so it isn't listed in SCENARIOS.
 */
export interface TimelineStep {
  id: string;
  /** The simulated moment, e.g. "Sat · 4 AM". */
  time: string;
}
export const STORM_TIMELINE: { title: string; steps: TimelineStep[] } = {
  title: 'Made-up storm over York County',
  steps: [
    { id: 'york-calm', time: 'Fri · 6 PM' },
    { id: 'york-flood-watch', time: 'Fri · 9 PM' },
    { id: 'york-flood-warning', time: 'Sat · 4 AM' },
    { id: 'york-flash-flood-emergency', time: 'Sat · 7 AM' },
  ],
};
const TIMELINE_ONLY = [calm] as ScenarioFile[];

/** Which step of the storm timeline a scenario is (-1 when it isn't part of it). */
export const timelineIndex = (id: string | null): number => STORM_TIMELINE.steps.findIndex((s) => s.id === id);

export function findScenario(id: string | null): ScenarioInfo | null {
  return SCENARIOS.find((s) => s.id === id) ?? TIMELINE_ONLY.find((s) => s.id === id) ?? null;
}

/** True for the replays built from real archived data (the Helene scenarios). */
export const isReplay = (id: string | null): boolean => id !== null && id in REPLAYS;

/** The full scenario (alerts, gauges, rain). Replays are downloaded the first time they're used. */
export async function loadScenario(id: string | null): Promise<ScenarioFile | null> {
  if (id === null) return null;
  if (id in REPLAYS) return REPLAYS[id].load();
  return SYNTHETIC.find((s) => s.id === id) ?? TIMELINE_ONLY.find((s) => s.id === id) ?? null;
}

const minutes = (now: number, offset: number) => new Date(now + offset * 60_000).toISOString();

export function scenarioAlerts(s: ScenarioFile, now: number): Alert[] {
  return s.alerts.map((a, i) => ({
    id: `simulated-${s.id}-${i}`,
    event: a.event,
    severity: 'Severe',
    urgency: 'Immediate',
    certainty: 'Likely',
    headline: a.headline,
    description: a.description,
    instruction: a.instruction,
    sent: minutes(now, Math.min(a.startOffsetMin, 0)),
    onset: minutes(now, a.startOffsetMin),
    ends: minutes(now, a.endOffsetMin),
    county_fips: a.county_fips,
    geometry: a.polygon ? { type: 'Polygon', coordinates: [a.polygon] } : null,
    url: 'https://www.weather.gov/alerts',
    action: 'NEW',
    damage_threat: a.damage_threat ?? {},
  }));
}

/** 25 readings, 15 minutes apart, from `from` to `to`. */
function ramp(from: number, to: number, now: number): Reading[] {
  const steps = 24;
  return Array.from({ length: steps + 1 }, (_, i) => ({
    time: new Date(now - (steps - i) * 15 * 60_000).toISOString(),
    value: Math.round((from + ((to - from) * i) / steps) * 100) / 100,
  }));
}

/**
 * Simulated gauges. Made-up scenarios: listed sites follow their ramp; every other gauge
 * gets a steady, ordinary level (35% of its action stage, or 2 ft with no stage).
 * Replays: every gauge uses its real archived readings, shifted so the moment is "now".
 * A gauge with no archived reading gets none (it shows as offline), never a made-up value.
 */
export function scenarioGauges(s: ScenarioFile, sites: GaugeSite[], now: number): Gauge[] {
  return sites.map((site) => {
    const plan = s.gauges[site.site_id];
    if (plan && 'readings' in plan) {
      return buildGauge(site, plan.readings.map(([offsetMin, value]) => ({ time: new Date(now + offsetMin * 60_000).toISOString(), value })));
    }
    if (s.replay) return buildGauge(site, []);
    const normal = site.stages?.action ? Math.round(site.stages.action * 0.35 * 100) / 100 : 2;
    const series = plan ? ramp(plan.from, plan.to, now) : ramp(normal, normal, now);
    return buildGauge(site, series);
  });
}

export function scenarioRain(s: ScenarioFile, now: number): RainForecast {
  return { ...s.rain, updated_at: new Date(now).toISOString() };
}

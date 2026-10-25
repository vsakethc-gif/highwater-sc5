/**
 * engine.ts — the rule-based hazard engine (brief, section 7).
 *
 * Input: official alerts, live gauges, the rain forecast, and a place.
 * Output: a level (0–3) for each hazard, with a list of human-readable triggers,
 * plus the overall status (the highest level).
 *
 * Everything here is a pure function: same inputs, same answer, no internet.
 * Every rule is listed in METHODOLOGY.md.
 */
import { THRESHOLDS } from '../config';
import type { Alert, FloodCategory } from '../data/types';
import { gaugeName, feet } from '../format';
import { pointInGeometry } from '../geo';
import { isStale } from '../time';
import { classifyAlert } from './alertMap';
import { LEVELS, highestLevel, type Level } from './levels';
import type { HazardId, HazardInputs, HazardStatus, OverallStatus, Place, Trigger } from './types';

const OFFICIAL_ALERTS_PAGE = 'https://www.weather.gov/alerts';

/** Flood rules for gauges (brief 7.4): action → Watch, minor → Warning, moderate/major → Danger. */
export const GAUGE_LEVEL: Record<FloodCategory, Level> = { action: 1, minor: 2, moderate: 3, major: 3 };

const CATEGORY_TEXT: Record<FloodCategory, string> = {
  action: 'at action stage',
  minor: 'in minor flood',
  moderate: 'in moderate flood',
  major: 'in major flood',
};

/**
 * Does this alert apply to this place?
 * - County view: the alert lists the county.
 * - Point view: the alert lists the county, AND if NWS drew a polygon,
 *   the point is inside it (a storm-based warning may cover only part of a county).
 */
export function alertAppliesTo(alert: Alert, place: Place): boolean {
  if (!alert.county_fips.includes(place.fips)) return false;
  if (place.kind === 'point' && alert.geometry) return pointInGeometry(place.lon, place.lat, alert.geometry);
  return true;
}

/** Evaluate every hazard for a place. */
export function evaluate(inputs: HazardInputs, place: Place): OverallStatus {
  const now = new Date(inputs.now).toISOString();
  const triggers = new Map<HazardId, Trigger[]>();
  const add = (hazard: HazardId, t: Trigger) => triggers.set(hazard, [...(triggers.get(hazard) ?? []), t]);
  const gaps: string[] = [];

  // 1. Official alerts
  if (inputs.alerts === null) {
    gaps.push('Official alerts from the National Weather Service could not be loaded.');
  } else {
    for (const alert of inputs.alerts.filter((a) => alertAppliesTo(a, place))) {
      const rule = classifyAlert(alert);
      add(rule.hazard, {
        level: rule.level,
        text: rule.reason ? `${alert.event} (${rule.reason})` : alert.event,
        source: 'National Weather Service',
        url: OFFICIAL_ALERTS_PAGE,
        time: alert.sent,
      });
    }
  }

  // 2. Flood: official gauges in the county (gauges without official stages never raise the level)
  if (inputs.gauges === null) {
    gaps.push('River gauge readings from USGS could not be loaded.');
  } else {
    const official = inputs.gauges.filter((g) => g.county_fips === place.fips && g.has_official_stage);
    const stale = official.filter((g) => !g.latest || isStale(g.latest.time, inputs.now));
    if (official.length > 0 && stale.length === official.length) {
      gaps.push('All official river gauges in this county have old or missing readings.');
    } else if (stale.length > 0) {
      gaps.push(`${stale.length} of ${official.length} official river gauges have old or missing readings.`);
    }
    for (const g of official) {
      if (!g.latest || isStale(g.latest.time, inputs.now) || !g.flood_category) continue;
      add('flood', {
        level: GAUGE_LEVEL[g.flood_category],
        text: `${gaugeName(g.name)} is ${CATEGORY_TEXT[g.flood_category]} (${feet(g.latest.value)})`,
        source: 'USGS gauge, NOAA flood stages',
        url: `https://waterdata.usgs.gov/monitoring-location/USGS-${g.site_id}/`,
        time: g.latest.time,
      });
    }
  }

  // 3. Flood: heavy rain in the forecast
  if (inputs.rain === null) {
    gaps.push('The rain forecast could not be loaded.');
  } else if (inputs.rain.next24h_in >= THRESHOLDS.rainWatchInches24h) {
    add('flood', {
      level: 1,
      text: `${inputs.rain.next24h_in.toFixed(1)} inches of rain forecast in the next 24 hours`,
      source: 'National Weather Service forecast',
      time: inputs.rain.updated_at,
    });
  }

  // 4. One status per hazard. Flooding is always included, even at Normal.
  if (!triggers.has('flood')) triggers.set('flood', []);
  const all: HazardStatus[] = [...triggers.entries()].map(([hazard, list]) => ({
    hazard,
    level: highestLevel(list.map((t) => t.level)),
    triggers: [...list].sort((a, b) => b.level - a.level),
    updated_at: now,
  }));
  all.sort((a, b) => b.level - a.level || (a.hazard === 'flood' ? -1 : b.hazard === 'flood' ? 1 : 0));

  return {
    level: highestLevel(all.map((s) => s.level)),
    active: all.filter((s) => s.level > 0),
    all,
    complete: gaps.length === 0,
    gaps,
  };
}

/** The headline for a status, e.g. "Warning: Flooding". Used by the status card. */
export function levelName(level: Level): string {
  return LEVELS[level].name;
}

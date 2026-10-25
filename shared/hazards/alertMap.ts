/**
 * alertMap.ts — which hazard each NWS alert belongs to, and at what level (brief 7.3).
 *
 * This table IS the rule. METHODOLOGY.md shows the same table in plain English.
 * NWS renamed some products in 2025 (e.g. "Excessive Heat Warning" became
 * "Extreme Heat Warning", "Wind Chill" products became "Extreme Cold" / "Cold Weather");
 * old names stay here as aliases so older alerts are still recognized.
 */
import type { Alert } from '../data/types';
import type { Level } from './levels';
import type { HazardId } from './types';

export interface AlertRule {
  hazard: HazardId;
  level: Level;
}

/** NWS event name → hazard and base level. */
export const ALERT_TABLE: Record<string, AlertRule> = {
  // Flood
  'Flood Watch': { hazard: 'flood', level: 1 },
  'Flash Flood Watch': { hazard: 'flood', level: 1 },
  'Flood Advisory': { hazard: 'flood', level: 1 },
  'Hydrologic Outlook': { hazard: 'flood', level: 1 },
  'Flood Statement': { hazard: 'flood', level: 1 },
  'Flash Flood Statement': { hazard: 'flood', level: 1 },
  'Flood Warning': { hazard: 'flood', level: 2 },
  'Flash Flood Warning': { hazard: 'flood', level: 2 },
  'Flash Flood Emergency': { hazard: 'flood', level: 3 }, // not a separate NWS event today; kept in case
  // Tornado
  'Tornado Watch': { hazard: 'tornado', level: 1 },
  'Tornado Warning': { hazard: 'tornado', level: 2 },
  'Tornado Emergency': { hazard: 'tornado', level: 3 }, // same: real emergencies arrive as tagged warnings
  // Severe thunderstorm
  'Severe Thunderstorm Watch': { hazard: 'severe_storm', level: 1 },
  'Severe Weather Statement': { hazard: 'severe_storm', level: 1 },
  'Severe Thunderstorm Warning': { hazard: 'severe_storm', level: 2 },
  // Tropical
  'Tropical Storm Watch': { hazard: 'tropical', level: 1 },
  'Hurricane Watch': { hazard: 'tropical', level: 1 },
  'Storm Surge Watch': { hazard: 'tropical', level: 1 },
  'Tropical Cyclone Local Statement': { hazard: 'tropical', level: 1 },
  'Tropical Storm Warning': { hazard: 'tropical', level: 2 },
  'Hurricane Warning': { hazard: 'tropical', level: 2 },
  'Storm Surge Warning': { hazard: 'tropical', level: 2 },
  'Extreme Wind Warning': { hazard: 'tropical', level: 3 },
  // Winter
  'Winter Storm Watch': { hazard: 'winter', level: 1 },
  'Winter Weather Advisory': { hazard: 'winter', level: 1 },
  'Winter Storm Warning': { hazard: 'winter', level: 2 },
  'Ice Storm Warning': { hazard: 'winter', level: 2 },
  'Snow Squall Warning': { hazard: 'winter', level: 2 },
  'Blizzard Warning': { hazard: 'winter', level: 3 },
  // Heat (current names first, then pre-2025 aliases)
  'Heat Advisory': { hazard: 'heat', level: 1 },
  'Extreme Heat Watch': { hazard: 'heat', level: 1 },
  'Excessive Heat Watch': { hazard: 'heat', level: 1 },
  'Extreme Heat Warning': { hazard: 'heat', level: 2 },
  'Excessive Heat Warning': { hazard: 'heat', level: 2 },
  // Cold (current names first, then pre-2025 aliases)
  'Cold Weather Advisory': { hazard: 'cold', level: 1 },
  'Extreme Cold Watch': { hazard: 'cold', level: 1 },
  'Wind Chill Advisory': { hazard: 'cold', level: 1 },
  'Wind Chill Watch': { hazard: 'cold', level: 1 },
  'Extreme Cold Warning': { hazard: 'cold', level: 2 },
  'Wind Chill Warning': { hazard: 'cold', level: 2 },
  'Freeze Watch': { hazard: 'cold', level: 1 },
  'Freeze Warning': { hazard: 'cold', level: 1 },
  // Wind
  'Wind Advisory': { hazard: 'wind', level: 1 },
  'Lake Wind Advisory': { hazard: 'wind', level: 1 },
  'High Wind Watch': { hazard: 'wind', level: 1 },
  'High Wind Warning': { hazard: 'wind', level: 2 },
  // Fire weather
  'Fire Weather Watch': { hazard: 'fire_weather', level: 1 },
  'Red Flag Warning': { hazard: 'fire_weather', level: 2 },
  'Extreme Fire Danger': { hazard: 'fire_weather', level: 2 },
  // Fog / smoke
  'Dense Fog Advisory': { hazard: 'fog', level: 1 },
  'Dense Smoke Advisory': { hazard: 'fog', level: 1 },
  'Freezing Fog Advisory': { hazard: 'fog', level: 1 },
  // Air quality
  'Air Quality Alert': { hazard: 'air_quality', level: 1 },
  'Air Stagnation Advisory': { hazard: 'air_quality', level: 1 },
  // Official orders
  'Evacuation Immediate': { hazard: 'evacuation', level: 3 },
  'Shelter In Place Warning': { hazard: 'other', level: 3 },
  'Civil Emergency Message': { hazard: 'other', level: 2 },
  'Civil Danger Warning': { hazard: 'other', level: 2 },
  // Information only: listed with the alerts, but never raise the status (level 0).
  // The outlook is issued almost every day; frost mainly affects plants.
  'Hazardous Weather Outlook': { hazard: 'other', level: 0 },
  'Frost Advisory': { hazard: 'other', level: 0 },
};

/** Damage-threat tags that raise a warning to Danger. */
const DANGER_TAGS: Partial<Record<HazardId, { key: string; values: string[] }>> = {
  flood: { key: 'flashFloodDamageThreat', values: ['CONSIDERABLE', 'CATASTROPHIC'] },
  tornado: { key: 'tornadoDamageThreat', values: ['CONSIDERABLE', 'CATASTROPHIC'] },
  severe_storm: { key: 'thunderstormDamageThreat', values: ['DESTRUCTIVE'] },
};

/** Words in an alert that mean the most extreme form of a warning. */
const DANGER_WORDS: Partial<Record<HazardId, RegExp>> = {
  flood: /FLASH FLOOD EMERGENCY/i,
  tornado: /TORNADO EMERGENCY|PARTICULARLY DANGEROUS SITUATION/i,
  tropical: /MAJOR HURRICANE|CATEGORY [345]\b/i,
};

/** A Special Weather Statement only counts as a storm alert when it's about storms. */
const STORM_WORDS = /THUNDERSTORM|HAIL|DAMAGING WIND|FUNNEL|ROTATION/i;

/**
 * Classify one alert. Returns the hazard, the level, and why.
 * Rules, in order:
 *   1. Look up the event name in ALERT_TABLE.
 *   2. A Warning becomes Danger if it carries a danger damage-threat tag
 *      or emergency / "particularly dangerous situation" wording.
 *   3. A storm-related Special Weather Statement is a Severe storm Watch.
 *   4. Anything else is "Other alert" at Watch, still shown with the official text.
 */
export function classifyAlert(alert: Alert): AlertRule & { reason?: string } {
  if (alert.event === 'Special Weather Statement') {
    const text = `${alert.headline} ${alert.description}`;
    return STORM_WORDS.test(text) ? { hazard: 'severe_storm', level: 1 } : { hazard: 'other', level: 1 };
  }
  const rule = ALERT_TABLE[alert.event];
  if (!rule) return { hazard: 'other', level: 1 };
  if (rule.level === 2) {
    const tag = DANGER_TAGS[rule.hazard];
    const tagValue = tag ? alert.damage_threat[tag.key] : undefined;
    if (tag && tagValue && tag.values.includes(tagValue.toUpperCase())) {
      return { ...rule, level: 3, reason: `damage threat tagged "${tagValue.toLowerCase()}"` };
    }
    const words = DANGER_WORDS[rule.hazard];
    if (words && words.test(`${alert.headline} ${alert.description}`)) {
      return { ...rule, level: 3, reason: 'emergency-level wording in the alert' };
    }
  }
  return rule;
}

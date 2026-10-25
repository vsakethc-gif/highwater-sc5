/**
 * types.ts — shapes used by the hazard engine (brief, sections 6 and 7).
 */
import type { Alert, Gauge } from '../data/types';
import type { Level } from './levels';

export type HazardId =
  | 'flood'
  | 'tornado'
  | 'severe_storm'
  | 'tropical'
  | 'winter'
  | 'heat'
  | 'cold'
  | 'wind'
  | 'fire_weather'
  | 'fog'
  | 'air_quality'
  | 'evacuation'
  | 'other';

/** A place the status is calculated for: a whole county, or one point (from GPS, ZIP, or a map tap). */
export type Place =
  | { kind: 'county'; fips: string }
  | { kind: 'point'; fips: string; lat: number; lon: number; label: string };

/** One human-readable reason a hazard is at its level, with where the information came from. */
export interface Trigger {
  level: Level;
  text: string;
  source: string;
  url?: string;
  time?: string;
}

export interface HazardStatus {
  hazard: HazardId;
  level: Level;
  triggers: Trigger[];
  updated_at: string;
}

/** Rain forecast for a point, in inches. */
export interface RainForecast {
  next24h_in: number;
  next48h_in: number;
  updated_at: string;
}

/** Everything the engine needs. null means "that data failed to load". */
export interface HazardInputs {
  alerts: Alert[] | null;
  gauges: Gauge[] | null;
  rain: RainForecast | null;
  now: number;
}

export interface OverallStatus {
  /** Highest level among all hazards. */
  level: Level;
  /** Hazards above Normal, highest first. */
  active: HazardStatus[];
  /** Status for every hazard we evaluated (including Normal ones). */
  all: HazardStatus[];
  /**
   * false when a key source failed or is stale. The UI must then NOT say
   * "Normal" as an all-clear (brief 5.6).
   */
  complete: boolean;
  /** Plain-language reasons the status may be incomplete. */
  gaps: string[];
}

/**
 * types.ts — the shapes of the data the app works with (brief, section 6).
 *
 * Each API returns data in its own format. The parsers in this folder convert
 * those formats into these simple, shared shapes, so the rest of the app never
 * has to know which agency the data came from.
 */

/** Official flood stages for a gauge, in feet. null = NOAA does not define that stage. */
export interface FloodStages {
  action: number | null;
  minor: number | null;
  moderate: number | null;
  major: number | null;
}

export type FloodCategory = 'action' | 'minor' | 'moderate' | 'major';
export type Trend = 'rising' | 'falling' | 'steady' | 'unknown';

/** A gauge from the static list in public/data/gauges.json. */
export interface GaugeSite {
  site_id: string;
  nws_id: string | null;
  name: string;
  lat: number;
  lon: number;
  county_fips: string;
  /** null = no official flood stage. We never invent thresholds. */
  stages: FloodStages | null;
}

/** One reading: when it was taken and the water height in feet. */
export interface Reading {
  time: string; // ISO 8601
  value: number;
}

/** A gauge plus its live readings. */
export interface Gauge extends GaugeSite {
  latest: Reading | null;
  unit: 'ft';
  recent_series: Reading[];
  trend: Trend;
  flood_category: FloodCategory | null;
  has_official_stage: boolean;
  /** USGS real-time data is provisional: it may be revised later. */
  provisional: true;
}

/** What an NWS alert message is doing, from its VTEC code. */
export type AlertAction = 'NEW' | 'CON' | 'EXT' | 'EXA' | 'EXB' | 'UPG' | 'CAN' | 'EXP' | 'COR' | 'ROU' | null;

export interface Alert {
  id: string;
  event: string;
  severity: string;
  urgency: string;
  certainty: string;
  headline: string;
  description: string;
  instruction: string;
  sent: string;
  onset: string | null;
  ends: string | null;
  county_fips: string[];
  /** Alert area polygon, when NWS provides one (storm-based warnings). */
  geometry: GeoJSON.Geometry | null;
  /** Link to the official alert. */
  url: string;
  action: AlertAction;
  /** e.g. { flashFloodDamageThreat: 'CONSIDERABLE' } */
  damage_threat: Record<string, string>;
}

/** Wraps any loaded data with when it was fetched, so the UI can show "updated" and stale states. */
export interface Loaded<T> {
  data: T;
  fetched_at: string;
  source: string;
  /** true when this came from the saved offline copy, not a live request. */
  saved?: boolean;
}

/**
 * categories.ts — what people can report, and where to send it so it actually gets fixed
 * (brief 11.1 and 11.2).
 *
 * This app does NOT send reports to any government agency. The confirmation screen
 * points to the official channel for each category. Every link below was checked on
 * 2026-10-18 (see DATA_SOURCES.md). Electric cooperatives and city utilities vary by
 * address, so for those we say "the number on your power bill" instead of guessing.
 */
import type { IconName } from '../icons';

export type ReportCategory =
  | 'streetlight_out'
  | 'traffic_signal_out'
  | 'downed_tree'
  | 'flooded_road'
  | 'blocked_drain'
  | 'road_damage'
  | 'sign_damage'
  | 'downed_power_line'
  | 'other';

export interface CategoryInfo {
  id: ReportCategory;
  label: string;
  icon: IconName;
  /** Emergency categories show a full-screen safety notice first (brief 11.1). */
  emergency: boolean;
  channels: Channel[];
}

export interface Channel {
  label: string;
  url?: string;
  phone?: string;
  note?: string;
}

const SCDOT: Channel = {
  label: 'SCDOT Maintenance Work Request',
  url: 'https://apps.scdot.org/MWRO/',
  note: 'For state roads. For local roads, the form shows which county or city is responsible.',
};
const SCDOT_PHONE: Channel = { label: 'SCDOT Customer Service', phone: '855-467-2368', note: 'Weekdays 8:30 a.m. to 5 p.m.' };
const DUKE_LIGHTS: Channel = { label: 'Duke Energy: Street & Area Light Repair', url: 'https://www.duke-energy.com/customer-service/request-light-repair' };
const DOMINION: Channel = { label: 'Dominion Energy SC: Report an outage or emergency', url: 'https://www.dominionenergy.com/South-Carolina/Report-Outage-or-Emergency' };
const DUKE_PHONE: Channel = { label: 'Duke Energy (outages and downed lines)', phone: '800-769-3766' };
const DOMINION_PHONE: Channel = { label: 'Dominion Energy SC (downed lines)', phone: '888-333-4465' };
const OTHER_POWER: Channel = {
  label: 'Electric cooperative or city utility',
  note: 'If your power comes from a cooperative or your city, call the number on your power bill.',
};
const COUNTY: Channel = { label: 'Your county’s website', note: 'Look for Public Works or Roads for county-maintained roads and drains.' };

export const CATEGORIES: CategoryInfo[] = [
  { id: 'streetlight_out', label: 'Streetlight out', icon: 'LightbulbOff', emergency: false, channels: [DUKE_LIGHTS, DOMINION, OTHER_POWER] },
  { id: 'traffic_signal_out', label: 'Traffic signal out', icon: 'TrafficCone', emergency: false, channels: [SCDOT, SCDOT_PHONE, COUNTY] },
  { id: 'downed_tree', label: 'Downed tree or debris on road', icon: 'TreeDeciduous', emergency: false, channels: [SCDOT, SCDOT_PHONE, COUNTY] },
  { id: 'flooded_road', label: 'Flooded road', icon: 'Waves', emergency: false, channels: [SCDOT, SCDOT_PHONE, COUNTY] },
  { id: 'blocked_drain', label: 'Blocked storm drain', icon: 'Grid2x2', emergency: false, channels: [COUNTY, SCDOT] },
  { id: 'road_damage', label: 'Pothole or road damage', icon: 'Construction', emergency: false, channels: [SCDOT, SCDOT_PHONE, COUNTY] },
  { id: 'sign_damage', label: 'Damaged or missing sign', icon: 'Signpost', emergency: false, channels: [SCDOT, COUNTY] },
  { id: 'downed_power_line', label: 'Downed power line', icon: 'Zap', emergency: true, channels: [DUKE_PHONE, DOMINION_PHONE, OTHER_POWER] },
  { id: 'other', label: 'Something else', icon: 'MessageSquare', emergency: false, channels: [COUNTY] },
];

export const categoryInfo = (id: string): CategoryInfo => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

/**
 * Downed power line safety (brief 11.1). The brief suggested 35 feet; both utilities that serve
 * SC-5 say at least 30 feet (Duke Energy and Dominion Energy SC), so we use their number.
 */
export const POWER_LINE_DISTANCE_FT = 30;

/** County websites (homepages, checked 2026-10-18) for county roads and drains. */
export const COUNTY_SITES: Record<string, string> = {
  '45021': 'https://cherokeecountysc.gov/',
  '45023': 'https://www.chestercountysc.gov/',
  '45039': 'https://www.fairfieldsc.com/',
  '45055': 'https://www.kershaw.sc.gov/',
  '45057': 'https://www.lancastercountysc.gov/',
  '45061': 'https://www.leecountysc.org/',
  '45087': 'https://gearupunionsc.com/',
  '45091': 'https://www.yorkcountysc.gov/',
};

/** How long a report stays visible without a "Still there" vote (matches supabase/schema.sql). */
export function expiryHours(category: string): number {
  return category === 'flooded_road' ? 48 : 30 * 24;
}

/** Text that looks like a phone number or email (we don't allow personal info). Same rule as the database. */
export function looksPersonal(text: string): boolean {
  return /\d{3}[\s.\-)]*\d{3}[\s.\-]*\d{4}/.test(text) || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text);
}

export const MAX_DESCRIPTION = 280;

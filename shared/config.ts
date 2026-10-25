/**
 * config.ts — the one place for settings that might change.
 *
 * If you want to rename the app, switch a feature off, or adjust a threshold,
 * change it here. Every other file reads from this file instead of
 * hard-coding its own copy.
 */

/** The app's display name. Placeholder: change it here and it changes everywhere. */
export const APP_NAME = 'Highwater';

/** The short motto under the name (phone app intro, About). */
export const APP_MOTTO = 'Know the water before it rises.';

/** One-sentence description used in page titles and the social preview. */
export const APP_TAGLINE =
  'Live hazard information, plain-language guidance, and community reports for South Carolina’s 5th District.';

/** A county in SC-5. `fips` is the 5-digit Census code: 45 (South Carolina) + 3-digit county code. */
export interface County {
  fips: string;
  name: string;
  /** County seat: used for the county's rain forecast. */
  seat: { name: string; lat: number; lon: number };
}

/**
 * The 8 counties fully inside SC-5.
 * FIPS codes verified against Census TIGERweb on 2026-10-17.
 * Spartanburg (45083) and Sumter (45085) are only partly in SC-5, so they are a stretch goal.
 */
export const COUNTIES: readonly County[] = [
  { fips: '45021', name: 'Cherokee', seat: { name: 'Gaffney', lat: 35.0718, lon: -81.6498 } },
  { fips: '45023', name: 'Chester', seat: { name: 'Chester', lat: 34.7049, lon: -81.2142 } },
  { fips: '45039', name: 'Fairfield', seat: { name: 'Winnsboro', lat: 34.3807, lon: -81.0865 } },
  { fips: '45055', name: 'Kershaw', seat: { name: 'Camden', lat: 34.2465, lon: -80.607 } },
  { fips: '45057', name: 'Lancaster', seat: { name: 'Lancaster', lat: 34.7204, lon: -80.7709 } },
  { fips: '45061', name: 'Lee', seat: { name: 'Bishopville', lat: 34.2185, lon: -80.2484 } },
  { fips: '45087', name: 'Union', seat: { name: 'Union', lat: 34.7154, lon: -81.6237 } },
  { fips: '45091', name: 'York', seat: { name: 'York', lat: 34.9943, lon: -81.242 } },
];

/**
 * County emergency management offices: where to confirm shelters and get official instructions.
 * Each link was checked on 2026-10-17: listed in SCEMD's "County Emergency Managers" directory
 * and loading (Lancaster's SCEMD link was broken, so this is the county's own current EM page).
 */
export const COUNTY_EM: Record<string, string> = {
  '45021': 'https://cherokeecountysc.gov/emergency-services/',
  '45023': 'https://www.chestercountysc.gov/government/emergency-management',
  '45039': 'https://www.fairfieldsc.com/departments/emergency-management',
  '45055': 'https://www.kershaw.sc.gov/government/departments-r-z/safety-and-emergency-services/emergency-management',
  '45057': 'https://www.lancastercountysc.gov/Directory.aspx?DID=49',
  '45061': 'https://www.leecountysc.org/directory/departments___elected_officials/fire_department___emergency_management.php',
  '45087': 'https://gearupunionsc.com/departments/emergency-management/',
  '45091': 'https://www.yorkcountysc.gov/149/Emergency-Management',
};

/** SCEMD's statewide directory of county emergency managers. */
export const SCEMD_COUNTY_DIRECTORY = 'https://www.scemd.org/who-we-are/county-emergency-managers/';

/**
 * The one Cloudflare Worker (brief 2.3): hides the routing key and proxies address search.
 * Deployed 2026-10-18. If empty, the route planner falls back to OSRM (no hazard avoidance).
 */
export const WORKER_URL = 'https://sc5-ready.sc5ready.workers.dev';

/**
 * Community reports (P1c). These are PUBLIC values by design: the publishable key only
 * allows what the database's Row Level Security rules allow (read active reports).
 * Writing goes through the Worker. Empty = the reports feature shows "not available yet".
 */
export const SUPABASE_URL = 'https://nywkprgdvishxicumtvx.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_R0vcZe999h5U7Co7Sx3dVA_QpQxzpPA';
/** Cloudflare Turnstile site key (public). The matching secret lives only in the Worker. */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFagqhq5XFjVLuGy';

/** The county shown first, before the person chooses their own. */
export const DEFAULT_COUNTY_FIPS = '45091'; // York

/**
 * Feature flags. Setting one to `false` hides that feature completely,
 * so an unfinished feature can never break the core app.
 * P0 features (flood status, map, scenario mode) are always on and have no flag.
 */
export const FEATURES = {
  multiHazard: true, // P1a: detailed guidance for every NWS hazard type (off = generic "follow the alert")
  offline: true, // P1a: installable app (service worker) + "last loaded" copy when offline
  routePlanner: true, // P1b: lower-exposure route map + shelters
  reports: true, // P1c: community issue reporting
  airQuality: false, // P2
  earthquakes: false, // P2
  wildfire: false, // P2
} as const;

/** Numbers the hazard engine uses. Each one is explained in METHODOLOGY.md. */
export const THRESHOLDS = {
  /** Forecast rain (inches in the next 24 hours) that raises flood status to Watch. */
  rainWatchInches24h: 2,
  /** Live data older than this is labeled stale and never shown as an "all clear". */
  staleAfterMinutes: 120,
  /** Guidance adds transportation advice when at least this share of households has no vehicle (about 2x the SC-5 tract median of 3.5%). */
  highNoVehiclePct: 7,
  /** Guidance strengthens the 'check on others' line at or above this vulnerability score. */
  highVulnerabilityScore: 60,
} as const;

/** Text that must appear at the end of every guidance block (brief, section 9). */
export const DISCLAIMER =
  'This app is not an official warning system. Follow instructions from local officials. In an emergency, call 911.';

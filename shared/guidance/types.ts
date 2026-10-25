/**
 * types.ts — the shape of a guidance block (brief, section 9).
 */
import type { HazardId } from '../hazards/types';
import type { Level } from '../hazards/levels';

export interface Link {
  label: string;
  url: string;
}

export interface GuidanceBlock {
  hazard: HazardId;
  level: Level;
  /** One sentence built from the actual triggers. */
  whatsHappening: string;
  /** 3 to 6 short actions. */
  doNow: string[];
  ifWorse: string[];
  checkOnOthers: string;
  links: Link[];
  /** true = "stay where you are and take shelter": never show a route button. */
  shelterInPlace: boolean;
  /** true = leaving can make sense here, so a route planner may be offered (P1b). */
  canRoute: boolean;
}

/** Facts about the place that change the advice. null = unknown. */
export interface GuidanceContext {
  placeName: string;
  /** Is the person's point inside a FEMA high-risk flood zone? (point views only) */
  inFloodZone: boolean | null;
  /** Share of households without a vehicle near the place (percent). */
  pctNoVehicle: number | null;
  /** Vulnerability score (0–100) near the place. */
  vulnerability: number | null;
}

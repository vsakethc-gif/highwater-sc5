/**
 * levels.ts — the four status levels shared by every hazard (brief, section 7.2).
 *
 * This file only describes the levels. The rules that decide which level
 * applies live in the hazard modules, built in Phase 2.
 */

export type Level = 0 | 1 | 2 | 3;

export interface LevelInfo {
  level: Level;
  /** Short label always shown next to the color. */
  name: 'Normal' | 'Watch' | 'Warning' | 'Danger';
  /** CSS modifier, e.g. "status-badge--watch". */
  key: 'normal' | 'watch' | 'warning' | 'danger';
  /** Name of the Lucide icon used for this level. */
  icon: 'CircleCheck' | 'Eye' | 'TriangleAlert' | 'OctagonAlert';
  /** What the level means, in plain words. */
  meaning: string;
}

export const LEVELS: Record<Level, LevelInfo> = {
  0: {
    level: 0,
    name: 'Normal',
    key: 'normal',
    icon: 'CircleCheck',
    meaning: 'No active official alerts for this hazard here right now.',
  },
  1: {
    level: 1,
    name: 'Watch',
    key: 'watch',
    icon: 'Eye',
    meaning: 'Conditions could develop. Get ready.',
  },
  2: {
    level: 2,
    name: 'Warning',
    key: 'warning',
    icon: 'TriangleAlert',
    meaning: 'It is happening or about to. Act now.',
  },
  3: {
    level: 3,
    name: 'Danger',
    key: 'danger',
    icon: 'OctagonAlert',
    meaning: 'Life-threatening, extreme, or emergency-level alert.',
  },
};

/** The overall status for a place is the highest level among its hazards (brief, 7.1). */
export function highestLevel(levels: readonly Level[]): Level {
  return levels.reduce<Level>((max, l) => (l > max ? l : max), 0);
}

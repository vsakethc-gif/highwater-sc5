/**
 * gauges.ts — loads the static gauge list (made by scripts/build-gauges.mjs).
 * Live readings are added in conditions.ts.
 */
import { loadStatic } from './static';
import type { GaugeSite } from './types';

interface GaugeFile {
  generated_at: string;
  gauges: GaugeSite[];
}

let siteList: Promise<GaugeSite[]> | null = null;

/** The gauge list is loaded once and reused (it doesn't change while the app is open). */
export function loadGaugeSites(): Promise<GaugeSite[]> {
  siteList ??= loadStatic<GaugeSite[] | GaugeFile>('gauges.json')
    .then((file) => (Array.isArray(file) ? file : file.gauges))
    .catch((err) => {
      siteList = null; // allow a retry later
      throw err;
    });
  return siteList;
}


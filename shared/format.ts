/**
 * format.ts — turns raw agency text into readable text.
 */

/** USGS abbreviations, expanded so names read naturally. */
const WORDS: Record<string, string> = {
  BL: 'below',
  BLW: 'below',
  AB: 'above',
  ABV: 'above',
  NR: 'near',
  NEAR: 'near',
  BELOW: 'below',
  ABOVE: 'above',
  AT: 'at',
  AND: 'and',
  OF: 'of',
  HWY: 'Hwy',
  RD: 'Rd',
  CR: 'Creek',
  CK: 'Creek',
  TRIB: 'tributary',
  US: 'US',
  SC: 'SC',
};

/**
 * "CATAWBA RIVER BL LAKE WYLIE DAM FEWELL ISLAND, SC" -> "Catawba River below Lake Wylie Dam Fewell Island"
 * Drops the trailing ", SC" because every gauge in the app is in South Carolina.
 */
export function gaugeName(raw: string): string {
  return raw
    .replace(/,\s*SC\s*$/i, '')
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (upper in WORDS) return WORDS[upper];
      if (/\d/.test(word)) return upper; // keep road numbers like "114" or "SC-5" as-is
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/** 5.1 -> "5.10 ft" (two decimals, like USGS reports it). */
export function feet(value: number): string {
  return `${value.toFixed(2)} ft`;
}

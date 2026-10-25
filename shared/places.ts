/**
 * places.ts — turning a county, a GPS spot, or a ZIP code into a Place the rules can use.
 * Shared by the website and the phone app, so both give the same answers and messages.
 *
 * Privacy: a spot's coordinates are only used to find its county and to ask the public data
 * services about that spot. They are never saved.
 */
import { COUNTIES } from './config';
import { loadCounties, loadZips } from './data/static';
import { featureAt } from './geo';
import type { Place } from './hazards/types';

export function countyName(fips: string): string {
  return COUNTIES.find((c) => c.fips === fips)?.name ?? 'Unknown';
}

/** "York County" or "ZIP 29730" / "Your location" style label for headings. */
export function placeLabel(place: Place): string {
  return place.kind === 'county' ? `${countyName(place.fips)} County` : place.label;
}

/** A spot (from GPS or a map tap) → a Place, or a message saying why it can't be used. */
export async function placeFromPoint(lat: number, lon: number, label: string): Promise<Place | string> {
  try {
    const county = featureAt(await loadCounties(), lon, lat);
    if (!county) return 'Your location is outside the 8 SC-5 counties this app covers. Choose a county instead.';
    return { kind: 'point', fips: county.properties.fips, lat, lon, label };
  } catch {
    return 'Couldn’t load county boundaries. Choose a county instead.';
  }
}

/** A 5-digit ZIP → a Place at the ZIP's center, or a message. Uses a built-in list (no outside service). */
export async function placeFromZip(input: string): Promise<Place | string> {
  const zip = input.trim();
  if (!/^\d{5}$/.test(zip)) return 'Enter a 5-digit ZIP code.';
  try {
    const entry = (await loadZips())[zip];
    if (!entry) return `ZIP ${zip} isn’t in the 8 SC-5 counties this app covers.`;
    const [lat, lon, fips] = entry;
    return { kind: 'point', fips, lat, lon, label: `ZIP ${zip}` };
  } catch {
    return 'Couldn’t load the ZIP code list. Choose a county instead.';
  }
}

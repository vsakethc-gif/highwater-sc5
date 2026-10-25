/**
 * links.ts — "Open in Google Maps / Apple Maps" with the same start and end (brief 10.1).
 * Those apps do NOT know about our avoid areas, which the route screen says clearly.
 * The links only open when the person taps them.
 */
import type { LonLat } from './avoid';

const fmt = ([lon, lat]: LonLat) => `${lat.toFixed(5)},${lon.toFixed(5)}`;

export function googleMapsLink(start: LonLat, end: LonLat): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${fmt(start)}&destination=${fmt(end)}&travelmode=driving`;
}

export function appleMapsLink(start: LonLat, end: LonLat): string {
  return `https://maps.apple.com/?saddr=${fmt(start)}&daddr=${fmt(end)}&dirflg=d`;
}

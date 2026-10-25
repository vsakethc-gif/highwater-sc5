/**
 * mapStyle.ts — how the native map looks.
 *   - A quiet, low-contrast basemap so our data stands out (Google Maps on Android uses the style
 *     lists below; Apple Maps on iPhone uses its "muted" map type and follows light/dark mode).
 *   - The neighborhood color scale: five steps from light to dark, the same scale as the website
 *     (ColorBrewer YlGnBu: ordered by lightness, readable with color-vision differences).
 */
import type { MapStyleElement } from 'react-native-maps';

export const googleLight: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#f2efe9' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5f6a74' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f7f5f0' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e2ddd3' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfe0ec' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9c3b8' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
];

export const googleDark: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#121a22' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8794a0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1117' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1d2833' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#22303b' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e2233' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#34424f' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
];

/** Neighborhood score colors, 0–19 … 80–100, plus "insufficient data". */
export const RAMP = ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494'];
export const RAMP_NONE = '#bfc5cb';
export const RAMP_LABELS = ['Very low (0–19)', 'Low (20–39)', 'Moderate (40–59)', 'High (60–79)', 'Very high (80–100)'];

export function rampColor(score: number | null): string {
  if (score === null) return RAMP_NONE;
  return RAMP[Math.min(4, Math.floor(score / 20))];
}

/** Add transparency to a #rrggbb color (alpha 0..1). */
export function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

/**
 * theme.ts — the video's look, taken from the app's "Night Tide" design system
 * (design-system/highwater/MASTER.md and mobile/src/theme/tokens.ts), so the video and the app look
 * like one product. Also loads the app's two fonts and defines the easing curves.
 */
import { loadFont } from '@remotion/fonts';
import { Easing, staticFile } from 'remotion';

export const color = {
  bg: '#070B10',
  surface: '#111821',
  raised: '#18222D',
  ink: '#F2F5F8',
  muted: '#A7B2BD',
  faint: '#8A96A2',
  accent: '#5EC8E5',
  hairline: 'rgba(255,255,255,0.10)',
  sim: '#C7B8FF',
  // Status colors (Normal, Watch, Warning, Danger)
  normal: '#6FD3C2',
  watch: '#F4D35E',
  warning: '#FF9A4D',
  danger: '#FF7A93',
  // The living scene's sky at Normal and at Warning, and its water
  skyNormal: ['#0C2438', '#03080D'],
  skyWarning: ['#4A1C0A', '#0E0503'],
  water: 'rgba(56,150,196,0.55)',
} as const;

export const font = {
  ui: 'Atkinson Hyperlegible Next',
  display: 'Newsreader',
};

/** Strong ease-out for things arriving, ease-in-out for things moving across (Emil Kowalski's curves). */
export const ease = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
};

/** Clamp both ends of every interpolation (so values never run past their range). */
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const fontsReady = Promise.all([
  loadFont({ family: font.ui, url: staticFile('fonts/AtkinsonHyperlegibleNext_400Regular.ttf'), weight: '400' }),
  loadFont({ family: font.ui, url: staticFile('fonts/AtkinsonHyperlegibleNext_600SemiBold.ttf'), weight: '600' }),
  loadFont({ family: font.ui, url: staticFile('fonts/AtkinsonHyperlegibleNext_700Bold.ttf'), weight: '700' }),
  loadFont({ family: font.display, url: staticFile('fonts/Newsreader_600SemiBold.ttf'), weight: '600' }),
]);

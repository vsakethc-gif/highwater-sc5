/**
 * sparkline.ts — turns recent water heights into points for a tiny line chart.
 * Shared by the website (SVG in the browser) and the phone app (react-native-svg).
 */
import type { Reading } from './data/types';

const WIDTH = 96;
const HEIGHT = 28;
const PAD = 2;

/** Convert readings to "x,y" points inside the box. Exported so it can be tested. */
export function sparklinePoints(series: Reading[], width = WIDTH, height = HEIGHT): string {
  if (series.length < 2) return '';
  const times = series.map((r) => Date.parse(r.time));
  const values = series.map((r) => r.value);
  const t0 = times[0];
  const tSpan = times[times.length - 1] - t0 || 1;
  const vMin = Math.min(...values);
  // A flat line still needs a little vertical room, so use at least 0.2 ft of range.
  const vSpan = Math.max(Math.max(...values) - vMin, 0.2);
  return series
    .map((r, i) => {
      const x = PAD + ((times[i] - t0) / tSpan) * (width - PAD * 2);
      const y = height - PAD - ((r.value - vMin) / vSpan) * (height - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

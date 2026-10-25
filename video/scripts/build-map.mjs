/**
 * build-map.mjs — turns HighWater's own county outlines (public/data/counties.geojson) into SVG paths
 * for the video's map scene, so the 8 SC-5 counties can "draw in" without any map service.
 *
 * It projects longitude/latitude onto a flat 1000 x 700 box (an equirectangular projection, squeezed by
 * cos(latitude) so shapes aren't stretched), and writes src/data/sc5-map.json.
 *   node scripts/build-map.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../public/data/counties.geojson', import.meta.url));
const out = fileURLToPath(new URL('../src/data/sc5-map.json', import.meta.url));
const geo = JSON.parse(readFileSync(src, 'utf8'));

const rings = (g) => (g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]));
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
const k = Math.cos((34.5 * Math.PI) / 180);
for (const f of geo.features) for (const r of rings(f.geometry)) for (const [lon, lat] of r) {
  minX = Math.min(minX, lon * k); maxX = Math.max(maxX, lon * k);
  minY = Math.min(minY, lat); maxY = Math.max(maxY, lat);
}
const W = 1000, H = 700, pad = 30;
const s = Math.min((W - 2 * pad) / (maxX - minX), (H - 2 * pad) / (maxY - minY));
const ox = (W - (maxX - minX) * s) / 2, oy = (H - (maxY - minY) * s) / 2;
const px = ([lon, lat]) => [ox + (lon * k - minX) * s, oy + (maxY - lat) * s];

const counties = geo.features.map((f) => {
  let len = 0, cx = 0, cy = 0, n = 0;
  const d = rings(f.geometry).map((r) => {
    const pts = r.map(px);
    pts.forEach(([x, y], i) => { if (i) len += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]); cx += x; cy += y; n++; });
    return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';
  }).join('');
  return { fips: f.properties.fips, name: f.properties.name, d, length: Math.round(len), cx: Math.round(cx / n), cy: Math.round(cy / n) };
});
writeFileSync(out, JSON.stringify({ width: W, height: H, counties }, null, 1));
console.log(`wrote ${counties.length} counties:`, counties.map((c) => c.name).join(', '));

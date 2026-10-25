/**
 * build-icons.mjs — makes the app icons (PNG) phones need to install the app.
 *
 * Run with:  node scripts/build-icons.mjs
 *
 * The design: the deep water-blue accent with two waves (water) and a gauge staff
 * (the vertical line), matching favicon.svg. "Maskable" icons keep the drawing inside
 * the middle 80% so Android can crop them into circles or rounded squares.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const BLUE = '#0b4f7c';

/** The drawing on a 32×32 grid. `inset` shrinks it toward the center (for maskable icons). */
function svg({ rounded, inset }) {
  const scale = 1 - inset * 2;
  const offset = 32 * inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${rounded ? 6 : 0}" fill="${BLUE}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
    <path d="M16 6v7"/>
    <path d="M5 19c3.5 0 3.5-2.5 7-2.5s3.5 2.5 7 2.5 3.5-2.5 7-2.5"/>
    <path d="M5 24c3.5 0 3.5-2.5 7-2.5s3.5 2.5 7 2.5 3.5-2.5 7-2.5" opacity=".6"/>
  </g>
</svg>`;
}

const ICONS = [
  { file: 'icon-192.png', size: 192, rounded: true, inset: 0 },
  { file: 'icon-512.png', size: 512, rounded: true, inset: 0 },
  { file: 'icon-maskable-512.png', size: 512, rounded: false, inset: 0.12 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false, inset: 0.06 },
];

await mkdir('public/icons', { recursive: true });
for (const icon of ICONS) {
  const png = new Resvg(svg(icon), { fitTo: { mode: 'width', value: icon.size } }).render().asPng();
  await writeFile(`public/icons/${icon.file}`, png);
  console.log(`public/icons/${icon.file} (${icon.size}px, ${png.length} bytes)`);
}

// ---------- Phone app (Expo) icons and splash screen: same design ----------
/** Just the white waves and staff on a transparent background (Android draws its own blue behind it). */
function marks(inset, color = '#fff') {
  const scale = 1 - inset * 2;
  const offset = 32 * inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round">
    <path d="M16 6v7"/>
    <path d="M5 19c3.5 0 3.5-2.5 7-2.5s3.5 2.5 7 2.5 3.5-2.5 7-2.5"/>
    <path d="M5 24c3.5 0 3.5-2.5 7-2.5s3.5 2.5 7 2.5 3.5-2.5 7-2.5" opacity=".6"/>
  </g>
</svg>`;
}
const solid = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${BLUE}"/></svg>`;
const MOBILE = [
  { file: 'icon.png', svg: svg({ rounded: false, inset: 0.08 }), size: 1024 }, // iOS rounds the corners itself
  { file: 'android-icon-foreground.png', svg: marks(0.22), size: 1024 },
  { file: 'android-icon-background.png', svg: solid, size: 1024 },
  { file: 'android-icon-monochrome.png', svg: marks(0.22, '#000'), size: 1024 },
  { file: 'splash-icon.png', svg: svg({ rounded: true, inset: 0 }), size: 512 },
  { file: 'favicon.png', svg: svg({ rounded: true, inset: 0 }), size: 48 },
];
for (const icon of MOBILE) {
  const png = new Resvg(icon.svg, { fitTo: { mode: 'width', value: icon.size } }).render().asPng();
  await writeFile(`mobile/assets/images/${icon.file}`, png);
  console.log(`mobile/assets/images/${icon.file} (${icon.size}px)`);
}

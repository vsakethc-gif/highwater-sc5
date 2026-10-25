// icons.mjs — draws the Highwater mark and renders the app icon, Android adaptive icon layers,
// splash image, and favicon from it. Run from the repo root:  node mobile/scripts/icons.mjs
// The same drawing is used inside the app by components/Logo.tsx (keep the two in step).
//
// The mark: a deep water-blue square with lighter water rising inside it, a white wave line on the
// water's surface, and three gauge ticks on the left edge, like the measuring stick on a river gauge.
import fs from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const BLUE = '#0B4F7A';
const WATER_TOP = '#2A7AB0';
const WATER_BOTTOM = '#1B5F8E';

/** The mark's inner drawing on a 100×100 grid (no background). */
export function markShapes({ water = true, ticks = '#FFFFFF', wave = '#FFFFFF' } = {}) {
  const surface = 'M-4 58 C 12 47, 30 47, 50 58 S 88 69, 104 58';
  return `
    ${water ? `<defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${WATER_TOP}"/><stop offset="1" stop-color="${WATER_BOTTOM}"/></linearGradient></defs>
    <path d="${surface} L 104 104 L -4 104 Z" fill="url(#w)"/>` : ''}
    <g stroke="${ticks}" stroke-linecap="round" stroke-width="3.2" opacity="0.9">
      <line x1="22" y1="22" x2="31" y2="22"/>
      <line x1="22" y1="33" x2="28" y2="33"/>
      <line x1="22" y1="44" x2="31" y2="44"/>
    </g>
    <path d="${surface}" fill="none" stroke="${wave}" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M-4 76 C 12 66, 30 66, 50 76 S 88 86, 104 76" fill="none" stroke="${wave}" stroke-width="3.4" stroke-linecap="round" opacity="0.45"/>`;
}

const svg = (size, inner, { bg = BLUE, radius = 0, scale = 1 } = {}) => {
  const pad = (100 - 100 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    ${bg ? `<rect width="100" height="100" rx="${radius}" fill="${bg}"/>` : ''}
    <clipPath id="c"><rect width="100" height="100" rx="${radius}"/></clipPath>
    <g clip-path="url(#c)"><g transform="translate(${pad} ${pad}) scale(${scale})">${inner}</g></g>
  </svg>`;
};

const out = (file, data, size) => {
  fs.writeFileSync(file, new Resvg(data, { fitTo: { mode: 'width', value: size } }).render().asPng());
  console.log('wrote', file);
};

const dir = 'mobile/assets/images';
out(`${dir}/icon.png`, svg(1024, markShapes()), 1024);
// Android adaptive icon: the system crops to a circle or squircle, so the mark sits in the middle 66%.
out(`${dir}/android-icon-background.png`, svg(1024, '', {}), 1024);
out(`${dir}/android-icon-foreground.png`, svg(1024, markShapes({ water: false }), { bg: null, scale: 0.66 }), 1024);
out(`${dir}/android-icon-monochrome.png`, svg(1024, markShapes({ water: false }), { bg: null, scale: 0.66 }), 1024);
// Splash and favicon: the rounded mark.
out(`${dir}/splash-icon.png`, svg(512, markShapes(), { radius: 22 }), 512);
out(`${dir}/favicon.png`, svg(48, markShapes(), { radius: 22 }), 48);

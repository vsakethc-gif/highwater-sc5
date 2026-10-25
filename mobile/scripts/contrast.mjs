/**
 * contrast.mjs — checks every text color against the backgrounds it sits on, in both themes,
 * using the WCAG formula. Body text needs 4.5:1; large text and icons need 3:1.
 * Run: node scripts/contrast.mjs
 */
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const THEMES = {
  light: { bg: '#F7F5F0', surface: '#FFFFFF', surfaceSunken: '#EFEBE3', ink: '#0F1A24', inkMuted: '#47535E', inkFaint: '#5F6A74', accent: '#0B4F7A', accentSoft: '#DCE9F2', onAccent: '#FFFFFF',
    status: [['#17694F', '#D6F0E4', '#14775A', '#FFFFFF'], ['#7F5100', '#FCE7B0', '#F2B41E', '#0F1A24'], ['#AE3A00', '#FDD8C2', '#C4490A', '#FFFFFF'], ['#A30D2A', '#F9D0D8', '#B5102F', '#FFFFFF']] },
  dark: { bg: '#070B10', surface: '#111821', surfaceSunken: '#18222D', ink: '#F2F5F8', inkMuted: '#A7B2BD', inkFaint: '#8A96A2', accent: '#5EC8E5', accentSoft: '#0E2C38', onAccent: '#070B10',
    status: [['#6FD3C2', '#0E2D29', '#17766A', '#FFFFFF'], ['#F4D35E', '#33290A', '#E2B92C', '#070B10'], ['#FF9A4D', '#3D1E0B', '#BD4A0C', '#FFFFFF'], ['#FF7A93', '#40121D', '#B0182F', '#FFFFFF']] },
};
const NAMES = ['Normal', 'Watch', 'Warning', 'Danger'];
let fails = 0;
for (const [theme, t] of Object.entries(THEMES)) {
  const rows = [];
  for (const fg of ['ink', 'inkMuted', 'inkFaint', 'accent']) for (const bg of ['bg', 'surface', 'surfaceSunken']) rows.push([`${fg} on ${bg}`, t[fg], t[bg], 4.5]);
  rows.push(['accent on accentSoft', t.accent, t.accentSoft, 4.5], ['onAccent on accent', t.onAccent, t.accent, 4.5], ['ink on accentSoft', t.ink, t.accentSoft, 4.5]);
  t.status.forEach(([fg, bg, band, onBand], i) => {
    rows.push([`text on ${NAMES[i]} band`, onBand, band, 4.5]);
    rows.push([`${NAMES[i]} fg on its bg`, fg, bg, 4.5], [`${NAMES[i]} fg on surface`, fg, t.surface, 4.5], [`${NAMES[i]} fg on bg (icons, 3:1)`, fg, t.bg, 3], [`ink on ${NAMES[i]} bg`, t.ink, bg, 4.5], [`inkMuted on ${NAMES[i]} bg`, t.inkMuted, bg, 4.5]);
  });
  console.log(`\n${theme.toUpperCase()}`);
  for (const [name, fg, bg, need] of rows) {
    const r = ratio(fg, bg);
    const ok = r >= need;
    if (!ok) fails++;
    console.log(`${ok ? ' ok ' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (need ${need})  ${name}`);
  }
}
// The Status 'living scene' (REDESIGN.md 2.1): white text at 100% / 72% / 62% and the level accent,
// checked against the lightest part of each gradient (its top) and against a module (7% white) on it.
const mix = (fg, bg, a) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('');
const SCENES = { Normal: ['#0C2438', '#6FD3C2'], Watch: ['#3B2A0A', '#F4D35E'], Warning: ['#4A1C0A', '#FF9A4D'], Danger: ['#4D0D1B', '#FF7A93'], Unknown: ['#232A31', '#C9D2DA'] };
console.log('\nSCENE');
for (const [name, [top, accent]] of Object.entries(SCENES)) {
  const module = mix('#FFFFFF', top, 0.07);
  for (const [bgName, bg] of [['sky', top], ['module', module]]) {
    for (const [what, fg] of [['white', '#FFFFFF'], ['72% white', mix('#FFFFFF', bg, 0.72)], ['62% white', mix('#FFFFFF', bg, 0.62)], ['accent', accent]]) {
      const r = ratio(fg, bg);
      const ok = r >= 4.5;
      if (!ok) fails++;
      console.log(`${ok ? ' ok ' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (need 4.5)  ${what} on ${name} ${bgName}`);
    }
  }
}
console.log(`\n${fails} failing pair(s)`);
process.exitCode = fails ? 1 : 0;

/**
 * app.mjs — records smooth footage of the HighWater phone app for the demo video.
 *
 * It runs the phone app's own code (built for the web with `npx expo export --platform web` into
 * video/raw/app-web) in a hidden Chrome window sized like an iPhone (390 x 844 points, 2x pixels).
 * Nothing is uploaded or hosted: Playwright hands the browser the built files straight from disk.
 * The script taps and drags through each shot slowly, taking a screenshot about 30 times a second,
 * and ffmpeg joins them into a 30 fps MP4 in video/raw/app-<shot>.mp4.
 *
 *   node capture/app.mjs probe            screenshot + list of buttons (to plan a shot)
 *   node capture/app.mjs <shot> | all
 */
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAW = fileURLToPath(new URL('../raw/', import.meta.url));
const BUILD = join(RAW, 'app-web');
const ORIGIN = 'http://highwater.app.test';
const VIEW = { width: 390, height: 844 };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const FFMPEG = join(RAW, '..', 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');

const pause = (page, ms) => page.waitForTimeout(ms);

/** Drag with a finger-like, eased motion. */
async function drag(page, from, to, ms = 1200) {
  const steps = Math.round(ms / 16);
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const p = i / steps;
    const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    await page.mouse.move(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e);
    await pause(page, 16);
  }
  await page.mouse.up();
}

/** Scroll like a thumb: a smooth, eased series of small wheel steps. */
async function glide(page, px, ms = 900) {
  const steps = Math.round(ms / 16);
  let done = 0;
  for (let i = 1; i <= steps; i++) {
    const p = i / steps;
    const target = px * (1 - (1 - p) ** 3);
    await page.mouse.wheel(0, target - done);
    done = target;
    await pause(page, 16);
  }
}

const tap = async (page, locator, wait = 900) => {
  await locator.first().click();
  await pause(page, wait);
};
const byLabel = (page, re) => page.getByRole('button', { name: re });

/** Open a Scenario Mode replay from the More tab. */
async function scenario(page, title) {
  await page.goto(`${ORIGIN}/more`, { waitUntil: 'networkidle' });
  await pause(page, 1200);
  await tap(page, byLabel(page, /^More scenarios/), 1500);
  await tap(page, page.getByRole('button', { name: title }), 3000);
}

/** Where the storm timeline's track is on screen. */
async function track(page) {
  const box = await page.getByLabel('Storm timeline').first().boundingBox();
  return { y: box.y + box.height / 2, x0: box.x + 14, x1: box.x + box.width - 14 };
}

export const SHOTS = {
  /** The hero shot: drag the storm replay from calm to Danger, pausing at each level. */
  storm: {
    async setup(page) {
      await page.goto(`${ORIGIN}/more`, { waitUntil: 'networkidle' });
      await pause(page, 1200);
      await tap(page, byLabel(page, /^Replay a storm/), 3000);
    },
    async run(page) {
      await pause(page, 1500);
      const t = await track(page);
      const at = (p) => [t.x0 + (t.x1 - t.x0) * p, t.y];
      await drag(page, at(0), at(0.33), 1800);
      await pause(page, 1600);
      await drag(page, at(0.33), at(0.66), 1800);
      await pause(page, 1600);
      await drag(page, at(0.66), at(1), 1800);
      await pause(page, 2600);
      await drag(page, at(1), at(0), 2600);
      await pause(page, 1200);
      await drag(page, at(0), at(1), 1400);
      await pause(page, 2500);
    },
  },
  /** Real Helene data: Danger, then every reason with its source. */
  helene: {
    setup: (page) => scenario(page, /^Hurricane Helene arrives/),
    async run(page) {
      await pause(page, 2500);
      await tap(page, byLabel(page, /^See everything we checked/), 1800);
      await glide(page, 420, 1400);
      await pause(page, 2000);
      await glide(page, 420, 1400);
      await pause(page, 2000);
    },
  },
  /** Tornado warning: stay where you are and take shelter. */
  tornado: {
    setup: (page) => scenario(page, /tornado/i),
    async run(page) {
      await pause(page, 2500);
      await glide(page, 500, 1500);
      await pause(page, 2500);
      await glide(page, 400, 1300);
      await pause(page, 2000);
    },
  },
  /** Report a problem: the category grid, then picking "Streetlight out" (stops before anything is sent). */
  report: {
    async setup(page) {
      await page.goto(`${ORIGIN}/report`, { waitUntil: 'networkidle' });
      await pause(page, 1500);
    },
    async run(page) {
      await pause(page, 2200);
      await tap(page, page.getByRole('button', { name: /^Streetlight out/ }), 2500);
    },
  },
  /** Live York County: scroll to the reasons and the rivers, open a river and scrub its chart. */
  live: {
    async run(page) {
      await pause(page, 2200);
      await tap(page, byLabel(page, /^See everything we checked/), 1600);
      await glide(page, 600, 1500);
      await pause(page, 1500);
      await glide(page, 700, 1600);
      await pause(page, 1500);
      await tap(page, page.getByRole('button', { name: /^Catawba River near Rock Hill/ }), 2200);
      const chart = await page.getByLabel(/chart/i).first().boundingBox().catch(() => null);
      if (chart) {
        const y = chart.y + chart.height / 2;
        await drag(page, [chart.x + 20, y], [chart.x + chart.width - 20, y], 2600);
        await pause(page, 1200);
      }
      await pause(page, 1500);
    },
  },
};

async function open(browser) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark', reducedMotion: process.env.REDUCE ? 'reduce' : 'no-preference' });
  // Serve the built app from disk; any page path falls back to index.html (it's a single-page app).
  await context.route(`${ORIGIN}/**`, (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    let file = join(BUILD, path);
    if (!existsSync(file) || path.endsWith('/')) file = join(BUILD, 'index.html');
    route.fulfill({ body: readFileSync(file), contentType: TYPES[extname(file)] ?? 'application/octet-stream' });
  });
  // Skip the first-run welcome screens, like a phone that has used the app before.
  await context.addInitScript(() => localStorage.setItem('sc5ready.onboarded', '1'));
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('page error:', e.message));
  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  return { context, page };
}

async function probe(browser, path = "") {
  const { context, page } = await open(browser);
  if (path) await page.goto(`${ORIGIN}/${path}`, { waitUntil: "networkidle" });
  await pause(page, 3500);
  await page.screenshot({ path: join(RAW, 'probe.png') });
  const names = await page.getByRole('button').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 60)));
  console.log(names.join(' | '));
  await context.close();
}

async function record(browser, name) {
  const tmp = join(RAW, `tmp-${name}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const { context, page } = await open(browser);
  await pause(page, 2500);
  await SHOTS[name].setup?.(page);
  if (process.env.REDUCE && process.env.MOTION_AFTER) await page.emulateMedia({ reducedMotion: 'no-preference' });

  const frames = [];
  let recording = true;
  const loop = (async () => {
    while (recording) {
      const t = Date.now() / 1000;
      const buf = await page.screenshot({ type: 'jpeg', quality: 92, scale: 'device', animations: 'allow', caret: 'initial' }).catch(() => null);
      if (buf) {
        const file = join(tmp, `f${String(frames.length).padStart(5, '0')}.jpg`);
        writeFileSync(file, buf);
        frames.push({ file, t });
      }
      const wait = 1 / 30 - (Date.now() / 1000 - t);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait * 1000));
    }
  })();
  const started = Date.now() / 1000;
  await (SHOTS[name].run ?? SHOTS[name])(page);
  await pause(page, 600);
  const ended = Date.now() / 1000;
  recording = false;
  await loop;
  await context.close();

  // Each screenshot stays on screen until the next one's time, so timing matches what happened.
  const lines = [];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : f.t + (ended - Math.max(started, f.t));
    lines.push(`file '${f.file.replace(/\\/g, '/')}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  lines.push(`file '${frames[frames.length - 1].file.replace(/\\/g, '/')}'`);
  writeFileSync(join(tmp, 'list.txt'), lines.join('\n'));
  const out = join(RAW, `app-${name}.mp4`);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-vf', 'scale=780:-2,format=yuv420p', '-r', '30', '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', out]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`recorded app-${name}.mp4 (${frames.length} frames, ${(ended - started).toFixed(1)} s)`);
}

const [which = 'probe', path] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
if (which === 'probe') await probe(browser, path);
else for (const name of which === 'all' ? Object.keys(SHOTS).filter((s) => s !== 'probe') : [which]) await record(browser, name);
await browser.close();

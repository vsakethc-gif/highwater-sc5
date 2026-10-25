import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Builds the service worker (src/sw/sw-template.js) after the app is bundled.
 * It fills in the list of files to save for offline use, plus a version number
 * that changes whenever any of those files change (so phones pick up updates).
 *
 * Saved for offline: the page, all code and styles EXCEPT the big map library,
 * the main (Latin) fonts, the icons, and the built data files.
 * The map needs live map tiles anyway, so it isn't saved.
 */
function serviceWorker(): Plugin {
  return {
    name: 'sc5ready-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((file) => {
        if (file.endsWith('.map') || file === 'sw.js') return false;
        // The map library and the pages that need it (district map, route planner) need the internet anyway.
        if (/(^|\/)(map|route|routeMap|maplibre-gl)-[^/]*\.(js|css)$/.test(file) || file.includes('maplibre-gl-worker')) return false;
        if (file.endsWith('.woff2')) return /-latin-wght-/.test(file);
        return true;
      });
      const publicFiles = [
        'favicon.svg',
        'manifest.webmanifest',
        ...readdirSync('public/icons').map((f) => `icons/${f}`),
        ...readdirSync('public/data').filter((f) => /\.(json|geojson)$/.test(f)).map((f) => `data/${f}`),
      ];
      const precache = ['./', ...built, ...publicFiles];
      const hash = createHash('sha256');
      for (const file of built.sort()) {
        const item = bundle[file];
        hash.update(file);
        hash.update(item.type === 'chunk' ? item.code : item.source);
      }
      for (const file of publicFiles) hash.update(readFileSync(`public/${file}`));
      const template = readFileSync('src/sw/sw-template.js', 'utf8');
      hash.update(template); // a change to the worker itself is a new version too
      const source = template
        .replace("const VERSION = '__VERSION__';", `const VERSION = '${hash.digest('hex').slice(0, 12)}';`)
        .replace('const PRECACHE = __PRECACHE__;', `const PRECACHE = ${JSON.stringify(precache, null, 2)};`);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // './' makes every file path relative, so the built site works no matter
  // which sub-folder GitHub Pages serves it from (e.g. /highwater/).
  base: './',
  plugins: [serviceWorker()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    // The map library is ~1 MB (287 KB compressed) but loads only on the map page.
    chunkSizeWarningLimit: 1200,
  },
  // Map worker is a modern module worker.
  worker: { format: 'es' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});

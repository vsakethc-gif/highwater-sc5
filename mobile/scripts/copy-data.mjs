/**
 * copy-data.mjs — copies the website's built-in data files (../public/data) into the phone app,
 * so the app has them from its first launch, even offline. Runs automatically before `npm start`.
 * ".geojson" files are saved as ".json" because the app bundler (Metro) only reads .json data.
 */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';

const from = new URL('../../public/data/', import.meta.url);
const to = new URL('../src/generated-data/', import.meta.url);
mkdirSync(to, { recursive: true });
for (const name of readdirSync(from)) {
  if (!/\.(json|geojson)$/.test(name)) continue;
  copyFileSync(new URL(name, from), new URL(name.replace(/\.geojson$/, '.json'), to));
}
console.log('Copied built-in data into mobile/src/generated-data/');

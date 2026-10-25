// district.mjs — builds mobile/src/data/district.json from the county shapes:
//   - outline: the outer edge of all 8 SC-5 counties merged into one shape, so the phone map can
//     dim everything outside the district (one hole is cleaner than 8 touching holes)
//   - labels: one point inside each county for its name label
// Run from the repo root:  node mobile/scripts/district.mjs
import fs from 'node:fs';
import * as turf from '@turf/turf';

const counties = JSON.parse(fs.readFileSync('public/data/counties.geojson', 'utf8'));

// Merge the counties. A tiny buffer first closes hairline gaps between neighboring shapes.
const merged = turf.union(turf.featureCollection(counties.features.map((f) => turf.buffer(f, 0.05, { units: 'kilometers' }))));
const polys = merged.geometry.type === 'Polygon' ? [merged.geometry.coordinates] : merged.geometry.coordinates;
const largest = polys.sort((a, b) => turf.area(turf.polygon(b)) - turf.area(turf.polygon(a)))[0];
const outline = turf.simplify(turf.polygon([largest[0]]), { tolerance: 0.002, highQuality: true }).geometry.coordinates[0]
  .map(([lon, lat]) => [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5]);

// A label point that is guaranteed to sit inside each county (not just its center of mass).
const labels = counties.features.map((f) => {
  const center = turf.centerOfMass(f).geometry.coordinates;
  const [x, y] = turf.booleanPointInPolygon(center, f) ? center : turf.pointOnFeature(f).geometry.coordinates;
  return { fips: f.properties.fips, name: f.properties.name, lat: Math.round(y * 1e4) / 1e4, lon: Math.round(x * 1e4) / 1e4 };
});

fs.mkdirSync('mobile/src/data', { recursive: true });
fs.writeFileSync('mobile/src/data/district.json', JSON.stringify({ outline, labels }));
console.log(`outline: ${outline.length} points; labels: ${labels.map((l) => l.name).join(', ')}`);

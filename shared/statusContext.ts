/**
 * statusContext.ts — two pieces of the Status screen that are pure logic, shared by both apps:
 *   - guidanceContext: facts about the place that adjust the advice (brief section 9, context rules)
 *   - checksList: the plain-language "What we checked" list under "Why this status?"
 */
import { THRESHOLDS } from './config';
import { dataOrNull, type Conditions } from './data/conditions';
import type { FloodZone } from './data/fema';
import { loadTracts } from './data/static';
import type { Alert } from './data/types';
import { featureAt } from './geo';
import type { GuidanceContext } from './guidance/types';
import type { Place } from './hazards/types';
import { districtAverage, type Tract } from './hazards/vulnerability';
import { countyName, placeLabel } from './places';

/** Facts about the place that adjust the guidance (brief 9, context rules). */
export async function guidanceContext(place: Place, zone: FloodZone | null | undefined): Promise<{ ctx: GuidanceContext; tract: Tract | null; tracts: Tract[] }> {
  const ctx: GuidanceContext = { placeName: placeLabel(place), inFloodZone: zone ? zone.highRisk : null, pctNoVehicle: null, vulnerability: null };
  try {
    const fc = await loadTracts();
    const tracts = fc.features.map((f) => f.properties);
    if (place.kind === 'point') {
      const tract = featureAt(fc, place.lon, place.lat)?.properties ?? null;
      if (tract) {
        ctx.pctNoVehicle = tract.pct_no_vehicle;
        ctx.vulnerability = tract.vulnerability_score;
      }
      return { ctx, tract, tracts };
    }
    const inCounty = tracts.filter((t) => t.county_fips === place.fips);
    ctx.pctNoVehicle = districtAverage(inCounty, 'pct_no_vehicle', 'households');
    const scored = inCounty.filter((t) => t.vulnerability_score !== null);
    const pop = scored.reduce((s, t) => s + t.population, 0);
    ctx.vulnerability = pop ? Math.round(scored.reduce((s, t) => s + t.vulnerability_score! * t.population, 0) / pop) : null;
    return { ctx, tract: null, tracts };
  } catch {
    return { ctx, tract: null, tracts: [] }; // guidance still works without the extra context
  }
}

/** Plain-language list of what the engine looked at (shown in "Why this status?"). */
export function checksList(place: Place, c: Conditions, alertsHere: Alert[] | null): string[] {
  const county = `${countyName(place.fips)} County`;
  const checks: string[] = [];
  checks.push(
    alertsHere === null
      ? 'National Weather Service alerts: could not be loaded.'
      : `National Weather Service alerts: ${alertsHere.length} active for ${placeLabel(place)}.`,
  );
  if (place.kind === 'point') checks.push('When NWS draws a warning area, it counts only if this spot is inside it.');
  const gauges = dataOrNull(c.gauges);
  if (gauges === null) checks.push('River gauges: could not be loaded.');
  else {
    const official = gauges.filter((g) => g.county_fips === place.fips && g.has_official_stage && g.latest);
    checks.push(
      official.length
        ? `River gauges: ${official.length} in ${county} with official flood stages; ${official.filter((g) => g.flood_category).length} at action stage or higher.`
        : `River gauges: ${county} has no gauges with official flood stages, so gauges can’t raise its status.`,
    );
  }
  const rain = dataOrNull(c.rain);
  checks.push(
    rain === null
      ? 'Rain forecast: could not be loaded.'
      : `Rain forecast: ${rain.next24h_in.toFixed(2)} in over the next 24 hours (Watch starts at ${THRESHOLDS.rainWatchInches24h} in).`,
  );
  return checks;
}


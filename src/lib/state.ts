/**
 * state.ts — what the person has chosen: their place, and whether Scenario Mode is on.
 *
 * Privacy: an exact location (from GPS or a map tap) is kept only in memory. It is never
 * put in the address bar or saved, so it can't leak through a shared link. Only a county
 * choice is remembered in this browser, as a convenience.
 */
import { COUNTIES, DEFAULT_COUNTY_FIPS } from '../../shared/config';
import type { Place } from '../../shared/hazards/types';

export interface AppState {
  place: Place;
  /** Scenario id when Scenario Mode is on, otherwise null. */
  scenario: string | null;
}

const COUNTY_KEY = 'sc5ready.county';
type Listener = (s: AppState) => void;
const listeners = new Set<Listener>();

function savedCounty(): string {
  try {
    const fips = localStorage.getItem(COUNTY_KEY);
    if (fips && COUNTIES.some((c) => c.fips === fips)) return fips;
  } catch {
    /* storage can be blocked: just use the default */
  }
  return DEFAULT_COUNTY_FIPS;
}

const SCENARIO_KEY = 'sc5ready.scenario';

/** Scenario Mode survives a page reload, but ends when the browser tab is closed (sessionStorage). */
function savedScenario(): string | null {
  try {
    return sessionStorage.getItem(SCENARIO_KEY);
  } catch {
    return null;
  }
}

let state: AppState = { place: { kind: 'county', fips: savedCounty() }, scenario: savedScenario() };

export const getState = (): AppState => state;

export function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  if (patch.place) {
    try {
      localStorage.setItem(COUNTY_KEY, patch.place.fips);
    } catch {
      /* ignore */
    }
  }
  if ('scenario' in patch) {
    try {
      if (patch.scenario) sessionStorage.setItem(SCENARIO_KEY, patch.scenario);
      else sessionStorage.removeItem(SCENARIO_KEY);
    } catch {
      /* ignore */
    }
  }
  for (const fn of listeners) fn(state);
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Shared with the phone app (shared/places.ts).
export { countyName, placeLabel } from '../../shared/places';

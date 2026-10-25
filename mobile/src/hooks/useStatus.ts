/**
 * useStatus.ts — loads everything the Status screen needs and runs the shared hazard engine.
 *
 *   place + Scenario Mode → alerts, gauges, rain (live, or from the scenario) → evaluate() → status,
 *   guidance, and the "What we checked" list.
 *
 * The latest result is kept in memory, so the gauge and alert detail screens open instantly with
 * the same data, and coming back to Status doesn't flash placeholders. A failed source never hides
 * the others; the offline copy (shared/data/snapshot.ts) is used only when live data fails.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { dataOrNull, loadConditions, type Conditions } from '../../../shared/data/conditions';
import { fetchFloodZone, type FloodZone } from '../../../shared/data/fema';
import type { Alert } from '../../../shared/data/types';
import { guidanceFor } from '../../../shared/guidance/guidance';
import type { GuidanceBlock } from '../../../shared/guidance/types';
import { alertAppliesTo, evaluate } from '../../../shared/hazards/engine';
import type { OverallStatus, Place } from '../../../shared/hazards/types';
import type { Tract } from '../../../shared/hazards/vulnerability';
import { timelineIndex } from '../../../shared/scenario/scenario';
import { checksList, guidanceContext } from '../../../shared/statusContext';
import { dateTime, relativeTime } from '../../../shared/time';
import { useAppState } from '../state';

export interface StatusData {
  key: string;
  c: Conditions;
  overall: OverallStatus;
  blocks: GuidanceBlock[];
  alertsHere: Alert[] | null;
  checks: string[];
  zone: FloodZone | null | Error;
  tracts: Tract[];
  tract: Tract | null;
  updatedAt: string;
}

const REFRESH_MS = 10 * 60_000;
let latest: StatusData | null = null;

/** The most recent result (used by detail screens). */
export const latestStatus = (): StatusData | null => latest;

const keyOf = (place: Place, scenario: string | null) => `${scenario ?? 'live'}|${place.kind}|${place.fips}|${place.kind === 'point' ? `${place.lat},${place.lon}` : ''}`;

/**
 * What to show while a new key loads. Normally nothing (placeholders), so one place's status never
 * appears under another place's name. One exception: moving between storm timeline steps (same place,
 * still simulated) keeps the current picture until the next step arrives, so scrubbing never flashes.
 */
function shownWhileLoading(key: string, scenario: string | null): StatusData | null {
  if (!latest) return null;
  if (latest.key === key) return latest;
  const samePlace = latest.key.slice(latest.key.indexOf('|')) === key.slice(key.indexOf('|'));
  return samePlace && timelineIndex(scenario) >= 0 && latest.c.simulated ? latest : null;
}

async function loadStatus(place: Place, scenario: string | null): Promise<StatusData> {
  const conditions = await loadConditions(place, scenario);
  // FEMA's flood zone for a spot: never wait more than 4 seconds for it.
  const zone: FloodZone | null | Error =
    place.kind === 'point' && !scenario
      ? await Promise.race([fetchFloodZone(place.lat, place.lon).catch((e: Error) => e), new Promise<Error>((r) => setTimeout(() => r(new Error('FEMA was slow')), 4000))])
      : null;
  const alerts = dataOrNull(conditions.alerts);
  const alertsHere = alerts ? alerts.filter((a) => alertAppliesTo(a, place)) : null;
  const evaluated = evaluate({ alerts, gauges: dataOrNull(conditions.gauges), rain: dataOrNull(conditions.rain), now: Date.now() }, place);
  // A status built from the saved offline copy is never complete, so it can never become an all-clear.
  const overall: OverallStatus = conditions.savedAt
    ? { ...evaluated, complete: false, gaps: [`Offline: showing info saved ${relativeTime(conditions.savedAt)} (${dateTime(conditions.savedAt)}). It may be out of date.`, ...evaluated.gaps] }
    : evaluated;
  const { ctx, tract, tracts } = await guidanceContext(place, zone instanceof Error ? null : zone);
  const shown = overall.active.length ? overall.active : overall.all.filter((h) => h.hazard === 'flood');
  return {
    key: keyOf(place, scenario),
    c: conditions,
    overall,
    blocks: shown.map((h) => guidanceFor(h, ctx)),
    alertsHere,
    checks: checksList(place, conditions, alertsHere),
    zone,
    tracts,
    tract,
    updatedAt: new Date().toISOString(),
  };
}

export function useStatus(): { data: StatusData | null; refreshing: boolean; refresh: () => Promise<void> } {
  const { place, scenario } = useAppState();
  const key = keyOf(place, scenario);
  const [data, setData] = useState<StatusData | null>(() => shownWhileLoading(key, scenario));
  const [refreshing, setRefreshing] = useState(false);
  const loadId = useRef(0);

  const load = useCallback(async () => {
    const id = ++loadId.current;
    try {
      const result = await loadStatus(place, scenario);
      if (id !== loadId.current) return; // a newer load started (the place changed): drop this one
      latest = result;
      setData(result);
    } catch {
      /* loadConditions reports each source's failure inside its result; this only guards surprises */
    }
  }, [place, scenario]);

  useEffect(() => {
    setData(shownWhileLoading(key, scenario));
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `scenario` is part of `key`
  }, [key, load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { data, refreshing, refresh };
}

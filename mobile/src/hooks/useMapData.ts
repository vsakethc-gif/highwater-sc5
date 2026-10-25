/**
 * useMapData.ts — everything the district map shows: alerts and gauges for all 8 counties
 * (live, or from Scenario Mode), county and neighborhood shapes, each county's status from the
 * shared engine, and community reports (simulated ones in Scenario Mode, never sent anywhere).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { COUNTIES } from '../../../shared/config';
import { dataOrNull, loadConditions, type Conditions } from '../../../shared/data/conditions';
import { loadCounties, loadTracts, type CountyCollection, type TractCollection } from '../../../shared/data/static';
import { evaluate } from '../../../shared/hazards/engine';
import type { OverallStatus } from '../../../shared/hazards/types';
import { fetchReports, reportsAvailable, simulatedReports, type Report } from '../../../shared/reports/client';
import { useAppState } from '../state';

export interface MapData {
  c: Conditions;
  counties: CountyCollection;
  tracts: TractCollection;
  countyStatus: Record<string, OverallStatus>;
  reports: Report[] | Error;
  loadedAt: string;
}

export function useMapData(): { data: MapData | null; error: string | null; reload: () => void } {
  const { scenario } = useAppState();
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadId = useRef(0);

  const load = useCallback(async () => {
    const id = ++loadId.current;
    setError(null);
    try {
      const [c, counties, tracts] = await Promise.all([
        loadConditions({ kind: 'county', fips: COUNTIES[0].fips }, scenario, { allCounties: true, skipRain: true }),
        loadCounties(),
        loadTracts(),
      ]);
      const reports: Report[] | Error = scenario
        ? simulatedReports()
        : reportsAvailable()
          ? await fetchReports().catch((e: Error) => e)
          : [];
      // Each county's status from alerts and gauges (the map leaves out the rain forecast, and says so).
      const countyStatus: Record<string, OverallStatus> = {};
      for (const county of COUNTIES) {
        countyStatus[county.fips] = evaluate({ alerts: dataOrNull(c.alerts), gauges: dataOrNull(c.gauges), rain: null, now: Date.now() }, { kind: 'county', fips: county.fips });
      }
      if (id !== loadId.current) return;
      setData({ c, counties, tracts, countyStatus, reports, loadedAt: new Date().toISOString() });
    } catch {
      if (id === loadId.current) setError('The map data didn’t load. Check your connection and try again.');
    }
  }, [scenario]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, reload: load };
}

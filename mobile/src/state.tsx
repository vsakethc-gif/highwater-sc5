/**
 * state.tsx — what the person has chosen, shared by every tab (read it with useAppState()):
 * their place, Scenario Mode, settings (appearance, haptics), and the Status scene's current look
 * (so the floating tab bar can pick up its tint).
 *
 * Privacy: an exact location (GPS or ZIP) is kept only in memory. Only a county choice and the
 * settings are remembered on the phone. Scenario Mode turns off when the app closes.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { COUNTIES, DEFAULT_COUNTY_FIPS } from '../../shared/config';
import type { Place } from '../../shared/hazards/types';
import type { SceneKey } from './theme/tokens';
import { platform } from '../../shared/platform';
import { HAPTICS_KEY } from './theme/haptics';

const COUNTY_KEY = 'sc5ready.county';
const APPEARANCE_KEY = 'sc5ready.appearance';

export type Appearance = 'system' | 'light' | 'dark';

interface AppState {
  place: Place;
  /** Scenario id when Scenario Mode is on, otherwise null. */
  scenario: string | null;
  appearance: Appearance;
  haptics: boolean;
  /** The Status scene's level (null until it has loaded). */
  sceneKey: SceneKey | null;
  setSceneKey: (k: SceneKey | null) => void;
  setPlace: (p: Place) => void;
  setScenario: (id: string | null, county?: string) => void;
  setAppearance: (a: Appearance) => void;
  setHaptics: (on: boolean) => void;
}

const Ctx = createContext<AppState | null>(null);

const saved = (key: string) => platform().storage.getItem(key);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [place, setPlaceState] = useState<Place>(() => {
    const fips = saved(COUNTY_KEY);
    return { kind: 'county', fips: fips && COUNTIES.some((c) => c.fips === fips) ? fips : DEFAULT_COUNTY_FIPS };
  });
  const [scenario, setScenarioState] = useState<string | null>(null);
  const [appearance, setAppearanceState] = useState<Appearance>(() => {
    const a = saved(APPEARANCE_KEY);
    // Dark-first (REDESIGN.md 1): Dark unless the person picked System or Light in More → Settings.
    return a === 'light' || a === 'system' ? a : 'dark';
  });
  const [haptics, setHapticsState] = useState(() => saved(HAPTICS_KEY) !== 'off');
  const [sceneKey, setSceneKey] = useState<SceneKey | null>(null);

  const setPlace = useCallback((p: Place) => {
    setPlaceState(p);
    if (p.kind === 'county') platform().storage.setItem(COUNTY_KEY, p.fips);
  }, []);

  /** Turning a scenario on also jumps to that scenario's county, like the website. */
  const setScenario = useCallback(
    (id: string | null, county?: string) => {
      setScenarioState(id);
      if (county) setPlace({ kind: 'county', fips: county });
    },
    [setPlace],
  );

  const setAppearance = useCallback((a: Appearance) => {
    setAppearanceState(a);
    platform().storage.setItem(APPEARANCE_KEY, a);
  }, []);

  const setHaptics = useCallback((on: boolean) => {
    setHapticsState(on);
    platform().storage.setItem(HAPTICS_KEY, on ? 'on' : 'off');
  }, []);

  const value = useMemo(
    () => ({ place, scenario, appearance, haptics, sceneKey, setSceneKey, setPlace, setScenario, setAppearance, setHaptics }),
    [place, scenario, appearance, haptics, sceneKey, setPlace, setScenario, setAppearance, setHaptics],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const s = useContext(Ctx);
  if (!s) throw new Error('useAppState must be used inside AppStateProvider');
  return s;
}

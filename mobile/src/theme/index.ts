/**
 * theme/index.ts — useTheme() gives every component the right palette for the chosen appearance
 * (Dark by default, or System / Light in More → Settings). In Scenario Mode the accent turns slate.
 *
 * <ScenePaletteProvider> overrides the palette for everything drawn on the Status scene: white ink
 * and the level's accent on dark, whatever the appearance setting, because the scene is always dark.
 */
import { createContext, createElement, use, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';
import { useAppState } from '../state';
import { dark, light, scenePalette, simulationAccent, type Palette, type SceneKey } from './tokens';

export * from './tokens';
export * from './motion';
export { haptic } from './haptics';

const SceneCtx = createContext<Palette | null>(null);

export function ScenePaletteProvider({ sceneKey, children }: { sceneKey: SceneKey; children: ReactNode }) {
  return createElement(SceneCtx.Provider, { value: scenePalette(sceneKey) }, children);
}

export function useTheme(): { c: Palette; isDark: boolean } {
  const system = useColorScheme();
  const { scenario, appearance } = useAppState();
  const onScene = use(SceneCtx);
  if (onScene) return { c: onScene, isDark: true };
  const isDark = appearance === 'system' ? system !== 'light' : appearance === 'dark';
  const base = isDark ? dark : light;
  const c = scenario ? { ...base, ...simulationAccent[isDark ? 'dark' : 'light'] } : base;
  return { c, isDark };
}

/** True when iOS "Reduce Transparency" is on (or on Android, where blur isn't used): draw solid surfaces. */
export function useReduceTransparency(): boolean {
  const [solid, setSolid] = useState(Platform.OS !== 'ios');
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AccessibilityInfo.isReduceTransparencyEnabled().then(setSolid).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setSolid);
    return () => sub.remove();
  }, []);
  return solid;
}

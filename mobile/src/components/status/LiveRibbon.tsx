/**
 * LiveRibbon.tsx — the small pill at the top of the Status scene that says how fresh the picture is
 * (a Flighty-style live status ribbon, REDESIGN.md 3.1). Tap it to see every source and its time.
 *
 *   LIVE · Updated 3 min ago        teal dot, softly pinging
 *   UPDATING…                       while a refresh runs
 *   OFFLINE · from 2:14 PM          amber dot: showing the saved copy
 *   MAY BE OUT OF DATE              amber dot: a source failed or is old, so this isn't a full picture
 *   SIMULATION · not live data      violet, with an Exit button
 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { clockTime, relativeTime } from '../../../../shared/time';
import type { StatusData } from '../../hooks/useStatus';
import { easing, font, radius, sceneInk, space, useMotionReduced } from '../../theme';
import { Pressable } from '../ui/Button';
import { Txt } from '../ui/Text';
import { Glass } from './Module';

function Dot({ color, ping }: { color: string; ping: boolean }) {
  const reduced = useMotionReduced();
  const t = useSharedValue(0);
  useEffect(() => {
    if (ping && !reduced) t.set(withRepeat(withTiming(1, { duration: 2000, easing: easing.emphasized }), -1, false));
    else cancelAnimation(t);
    return () => cancelAnimation(t);
  }, [ping, reduced, t]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - t.get()), transform: [{ scale: 1 + 1.6 * t.get() }] }));
  return (
    <View style={s.dotBox}>
      {ping ? <Animated.View style={[s.dot, { position: 'absolute', backgroundColor: color }, ring]} /> : null}
      <View style={[s.dot, { backgroundColor: color }]} />
    </View>
  );
}

export function LiveRibbon({ data, refreshing, onExitSimulation }: { data: StatusData | null; refreshing: boolean; onExitSimulation: () => void }) {
  const sim = data?.c.simulated ?? false;
  const live = !!data && !sim && !data.c.savedAt && data.overall.complete;
  const label = !data
    ? 'LOADING'
    : sim
      ? 'SIMULATION · not live data'
      : refreshing
        ? 'UPDATING…'
        : data.c.savedAt
          ? `OFFLINE · from ${clockTime(data.c.savedAt)}`
          : live
            ? `LIVE · Updated ${relativeTime(data.updatedAt).replace(/ minutes?/, ' min')}`
            : 'MAY BE OUT OF DATE';
  const color = sim ? sceneInk.sim : live || !data ? sceneInk.live : sceneInk.amber;

  return (
    <View style={s.row}>
      <Pressable onPress={() => router.push('/sources')} accessibilityRole="button" accessibilityLabel={`${label}. Shows data sources and times`} scaleTo={0.96} disabled={!data} hitSlop={6}>
        <Glass rounded={radius.pill} style={[s.pill, sim && { borderColor: sceneInk.sim }]} floating>
          <Dot color={color} ping={live && !refreshing} />
          <Animated.View key={label} entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)}>
            <Txt variant="footnote" color={sim ? sceneInk.sim : sceneInk.primary} style={s.text} numberOfLines={1}>
              {label}
            </Txt>
          </Animated.View>
        </Glass>
      </Pressable>
      {sim ? (
        <Pressable onPress={onExitSimulation} accessibilityRole="button" accessibilityLabel="Exit Scenario Mode" scaleTo={0.96} hitSlop={6}>
          <Glass rounded={radius.pill} style={[s.pill, { borderColor: sceneInk.sim }]} floating>
            <Txt variant="footnote" color={sceneInk.sim} style={s.text}>
              Exit
            </Txt>
          </Glass>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 32, paddingHorizontal: space.m },
  text: { fontFamily: font.semibold, letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  dotBox: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
});

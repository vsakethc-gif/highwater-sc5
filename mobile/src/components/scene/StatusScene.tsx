/**
 * StatusScene.tsx — the "living scene" behind the Status screen (REDESIGN.md sections 1 and 4).
 *
 * Four layers, back to front, all drawn by us in code:
 *   1. Sky: the level's vertical gradient. Two gradients are stacked; when the level changes the new
 *      one fades in over the old one (400 ms), so the whole screen shifts color smoothly.
 *   2. Glow: at Danger only, a soft red light at the top that slowly "breathes" (opacity 0.25 ↔ 0.4).
 *   3. Rain: thin streaks falling at a slight angle when 0.25 in or more is forecast in 24 hours.
 *      More rain, more streaks (30 to 80). They live in 3 layers that each slide down and repeat,
 *      so the phone animates 3 things, not 80.
 *   4. Water: our water line, two overlapping waves drifting sideways at different speeds. Its height
 *      follows `waterLevel` (0 = Normal … 3 = Danger): 18% of the screen at Normal, up to 42% at
 *      Danger. Pulling down to refresh lifts the water with your finger.
 *   Then a black shade that deepens as you scroll, so the modules stay easy to read.
 *
 * Why it stays smooth: every moving part is a shared value animated on the UI thread with transforms
 * and opacity only, so loading data never makes the water stutter. Everything stops when the Status
 * tab isn't on screen or the app is in the background (`active`), to save battery.
 * Reduce Motion: the water and sky still change with the level (as a plain 200 ms fade), but the
 * waves stand still, there's no rain motion, and the glow doesn't pulse.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { duration, easing, scene, SCENE_WATER, sceneInk, spring, useMotionReduced, type SceneKey } from '../../theme';

/** How far you pull down before a refresh starts (matches iOS's pull-to-refresh distance). */
export const PULL_THRESHOLD = 72;

/** One wave across `width`: crests every quarter, drawn as a filled strip `amp * 3` tall. */
function wavePath(width: number, amp: number, crests: number): string {
  const q = width / (crests * 2);
  let d = `M0 ${amp} Q ${q / 2} 0 ${q} ${amp}`;
  for (let x = q; x < width; x += q) d += ` T ${x + q} ${amp}`;
  return `${d} V ${amp * 3} H 0 Z`;
}

/** A tiny repeatable random generator, so the rain looks the same every time (no jumping on re-render). */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Each wave layer: how long one full sideways drift takes at each level (calm water barely moves). */
const DRIFT_MS: Record<SceneKey, [number, number]> = { 0: [22000, 31000], 1: [14000, 21000], 2: [9000, 13500], 3: [6500, 9800], unknown: [22000, 31000] };

function Wave({ width, amp, color, periodMs, active, reverse }: { width: number; amp: number; color: string; periodMs: number; active: boolean; reverse?: boolean }) {
  const drift = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(drift);
      return;
    }
    drift.set(0);
    drift.set(withRepeat(withTiming(1, { duration: periodMs, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(drift);
  }, [active, periodMs, drift]);
  // The strip is twice the screen wide and slides by exactly one screen, then repeats seamlessly.
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: (reverse ? drift.get() - 1 : -drift.get()) * width }] }));
  return (
    <Animated.View style={[{ position: 'absolute', top: -amp, left: 0, width: width * 2, height: amp * 3 }, style]}>
      <Svg width={width * 2} height={amp * 3}>
        <Path d={wavePath(width * 2, amp, 4)} fill={color} />
      </Svg>
    </Animated.View>
  );
}

/** One wave and the water body beneath it. `surge` stretches the wave taller from its base. */
function WaterLayer({ width, top, amp, color, periodMs, active, surge, reverse }: { width: number; top: number; amp: number; color: string; periodMs: number; active: boolean; surge: SharedValue<number>; reverse?: boolean }) {
  const surgeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: surge.get() }] }));
  return (
    <View style={{ position: 'absolute', top, left: 0, width, bottom: 0 }}>
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width, height: amp * 2, transformOrigin: 'center bottom' }, surgeStyle]}>
        <Wave width={width} amp={amp} color={color} periodMs={periodMs} active={active} reverse={reverse} />
      </Animated.View>
      <View style={{ position: 'absolute', top: amp * 2, left: 0, right: 0, bottom: 0, backgroundColor: color }} />
    </View>
  );
}

function RainLayer({ width, height, count, seed, fallMs, opacity, active }: { width: number; height: number; count: number; seed: number; fallMs: number; opacity: number; active: boolean }) {
  const fall = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(fall);
      return;
    }
    fall.set(0);
    fall.set(withRepeat(withTiming(1, { duration: fallMs, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(fall);
  }, [active, fallMs, fall]);
  // The layer is two screens tall with the same streaks in each half; it slides down one screen and repeats.
  const streaks = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, () => ({ x: rand() * width, y: rand() * height, len: 10 + rand() * 14 }));
  }, [count, seed, width, height]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (fall.get() - 1) * height }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width, height: height * 2, opacity }, style]}>
      <Svg width={width} height={height * 2}>
        {[0, height].flatMap((offset) =>
          streaks.map((s, i) => <Line key={`${offset}-${i}`} x1={s.x} y1={s.y + offset} x2={s.x - s.len * 0.21} y2={s.y + offset + s.len} stroke={sceneInk.primary} strokeWidth={1.2} strokeLinecap="round" />),
        )}
      </Svg>
    </Animated.View>
  );
}

export function StatusScene({
  sceneKey,
  waterLevel,
  rainIn,
  scrollY,
  active,
  onPullThreshold,
}: {
  sceneKey: SceneKey;
  /** 0..3, continuous: the screen springs it to the level, the Scenario timeline drags it with a finger.
   *  Below 0 drains toward the floor (used when you come back to the tab and it refills). */
  waterLevel: SharedValue<number>;
  /** Forecast rain in the next 24 hours, in inches (0 when unknown). */
  rainIn: number;
  scrollY: SharedValue<number>;
  /** False when the tab isn't visible or the app is in the background: all loops stop. */
  active: boolean;
  /** Called once each time a pull-down passes the refresh threshold (iOS). */
  onPullThreshold?: () => void;
}) {
  const { width: W, height: H } = useWindowDimensions();
  const reduced = useMotionReduced();
  const moving = active && !reduced;

  // 1. Sky: two slots. Slot B sits on top of slot A; `mix` is B's opacity (0 shows A, 1 shows B).
  // A new level is always written into the slot that's hidden right now, then `mix` fades over to it,
  // so a color never changes on the slot you're looking at (no flash).
  const [slots, setSlots] = useState<{ a: SceneKey; b: SceneKey; front: 'a' | 'b' }>({ a: sceneKey, b: sceneKey, front: 'a' });
  if (slots[slots.front] !== sceneKey) {
    // Adjusting state while rendering (React's pattern for "a prop changed"): no extra effect pass.
    const next = slots.front === 'a' ? 'b' : 'a';
    setSlots({ ...slots, [next]: sceneKey, front: next });
  }
  const mix = useSharedValue(0);
  useEffect(() => {
    mix.set(withTiming(slots.front === 'b' ? 1 : 0, { duration: reduced ? duration.fast : duration.slow, easing: easing.standard }));
  }, [slots.front, reduced, mix]);
  const bStyle = useAnimatedStyle(() => ({ opacity: mix.get() }));
  const aStyle = useAnimatedStyle(() => ({ opacity: 1 - mix.get() }));

  // A brief bigger wave when the level changes, and a ripple when a pull passes the threshold.
  const surge = useSharedValue(1);
  const firstKey = useRef(true);
  useEffect(() => {
    if (firstKey.current) {
      firstKey.current = false;
      return;
    }
    if (!reduced) surge.set(withSequence(withTiming(2.2, { duration: 260, easing: easing.emphasized }), withSpring(1, spring.gentle)));
  }, [sceneKey, reduced, surge]);

  useAnimatedReaction(
    () => scrollY.get() < -PULL_THRESHOLD,
    (past, before) => {
      if (past && before === false) {
        surge.set(withSequence(withTiming(1.8, { duration: 180 }), withSpring(1, spring.gentle)));
        if (onPullThreshold) scheduleOnRN(onPullThreshold);
      }
    },
  );

  // 2. Glow (Danger only): fades in with the level, then breathes.
  const glow = useSharedValue(0);
  useEffect(() => {
    if (sceneKey !== 3) {
      cancelAnimation(glow);
      glow.set(withTiming(0, { duration: duration.slow }));
    } else if (!moving) {
      cancelAnimation(glow);
      glow.set(withTiming(0.32, { duration: duration.slow }));
    } else {
      glow.set(withSequence(withTiming(0.25, { duration: duration.slow }), withRepeat(withTiming(0.4, { duration: 2000, easing: Easing.inOut(Easing.sin) }), -1, true)));
    }
    return () => cancelAnimation(glow);
  }, [sceneKey, moving, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  // 4. Water: height from the level (interpolated between levels while scrubbing) plus any pull-down.
  const AMP = 14;
  const waterStyle = useAnimatedStyle(() => {
    const share = interpolate(waterLevel.get(), [-1, 0, 1, 2, 3], [0, SCENE_WATER[0], SCENE_WATER[1], SCENE_WATER[2], SCENE_WATER[3]], 'clamp');
    const pull = Math.min(160, Math.max(0, -scrollY.get()) * 0.7);
    return { transform: [{ translateY: H * (1 - share) - pull }] };
  });

  // Shade: the scene darkens up to 35% as content scrolls over it.
  const shadeStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [0, 360], [0, 0.35], 'clamp') }));

  // 3. Rain: 30 to 80 streaks, split across three layers that fall at different speeds.
  const rainCount = rainIn >= 0.25 ? Math.round(Math.min(80, 30 + ((rainIn - 0.25) / 2.75) * 50)) : 0;
  const [driftA, driftB] = DRIFT_MS[sceneKey];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LinearGradient colors={[scene[slots.a].top, scene[slots.a].bottom]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, bStyle]}>
        <LinearGradient colors={[scene[slots.b].top, scene[slots.b].bottom]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: H * 0.45 }, glowStyle]}>
        <LinearGradient colors={[sceneInk.glow, sceneInk.glowEnd]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {rainCount > 0 && moving ? (
        <View style={StyleSheet.absoluteFill}>
          <RainLayer width={W} height={H} count={Math.round(rainCount * 0.45)} seed={11} fallMs={1500} opacity={0.12} active={moving} />
          <RainLayer width={W} height={H} count={Math.round(rainCount * 0.35)} seed={23} fallMs={1050} opacity={0.18} active={moving} />
          <RainLayer width={W} height={H} count={Math.round(rainCount * 0.2)} seed={37} fallMs={780} opacity={0.24} active={moving} />
        </View>
      ) : null}

      {/* The water: a full-screen-tall body moved up and down. Two layers, each a wave with a solid
          body under it, so where they overlap the color is even all the way down. */}
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: W, height: H + 200 }, waterStyle]}>
        {/* Each sky slot has its own water, fading with it, so water and sky change color together. */}
        {(['a', 'b'] as const).map((slot) => (
          <Animated.View key={slot} style={[StyleSheet.absoluteFill, slot === 'a' ? aStyle : bStyle]}>
            <WaterLayer width={W} top={-10} amp={AMP} color={scene[slots[slot]].waterBack} periodMs={driftB} active={moving} surge={surge} reverse />
            <WaterLayer width={W} top={0} amp={AMP * 0.75} color={scene[slots[slot]].water} periodMs={driftA} active={moving} surge={surge} />
          </Animated.View>
        ))}
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: sceneInk.shade }, shadeStyle]} />
    </View>
  );
}

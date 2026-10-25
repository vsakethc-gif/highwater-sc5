/**
 * WaterLine.tsx — the app's signature motif (brief section 3): a soft water surface with a gentle
 * wave edge over a subtle top-to-bottom water fill. The same component draws the water in the hero
 * status card, the gauge tubes, empty states, and pull-to-refresh, so the motif is always identical.
 *
 *   fill    0..1: how high the water is in its box (animates with a gentle spring when it changes)
 *   moving  whether the surface ripples sideways (off when Reduce Motion is on)
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { spring, useMotionReduced } from '../../theme';

/** One smooth wave across `width`, `amp` points tall: two gentle crests. */
function wavePath(width: number, amp: number): string {
  const q = width / 4;
  return `M0 ${amp} Q ${q} 0 ${2 * q} ${amp} T ${4 * q} ${amp} T ${6 * q} ${amp} T ${8 * q} ${amp} V ${amp * 3} H 0 Z`;
}

export function WaterLine({
  fill,
  top,
  bottom,
  moving = true,
  amplitude = 5,
  periodMs = 4200,
  style,
}: {
  fill: number;
  top: string;
  bottom: string;
  moving?: boolean;
  amplitude?: number;
  periodMs?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useMotionReduced();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const level = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    level.value = reduced ? fill : withSpring(fill, spring.gentle);
  }, [fill, reduced, level]);

  useEffect(() => {
    if (moving && !reduced && box.w > 0) {
      drift.value = 0;
      drift.value = withRepeat(withTiming(1, { duration: periodMs, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(drift);
    }
    return () => cancelAnimation(drift);
  }, [moving, reduced, box.w, periodMs, drift]);

  // The water body moves up and down; the wave on top slides sideways by one wavelength, then repeats.
  const body = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - Math.max(0, Math.min(1, level.value))) * box.h }] }));
  const surface = useAnimatedStyle(() => ({ transform: [{ translateX: -drift.value * (box.w / 2) }] }));

  return (
    <View
      style={[{ overflow: 'hidden' }, style]}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {box.w > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, body]}>
          <Animated.View style={[{ position: 'absolute', top: -amplitude, left: 0, width: box.w * 2, height: amplitude * 3 }, surface]}>
            <Svg width={box.w * 2} height={amplitude * 3}>
              <Path d={wavePath(box.w * 2, amplitude)} fill={top} />
            </Svg>
          </Animated.View>
          <LinearGradient colors={[top, bottom]} style={{ position: 'absolute', top: amplitude * 2 - amplitude, left: 0, right: 0, bottom: 0 }} />
        </Animated.View>
      ) : null}
    </View>
  );
}

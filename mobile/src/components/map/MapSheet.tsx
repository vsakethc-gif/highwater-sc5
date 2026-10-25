/**
 * MapSheet.tsx — the map's always-there bottom sheet (REDESIGN.md 5.2, the Apple Maps pattern).
 *
 * It never closes. It rests at one of three heights:
 *   0 peek  just the summary line and the layer chips, so the map gets almost the whole screen
 *   1 half  the details of what you tapped, or the list of counties
 *   2 full  everything, for long lists
 * Drag the top part to move it; a flick carries it to the next height. Tapping something on the map
 * raises it to half. The sheet's position is one number on the UI thread that the finger moves 1:1,
 * then a spring settles it, so it stays smooth while the map is busy.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { duration, haptic, radius, space, spring, useMotionReduced, useTheme } from '../../theme';
import { tabBarClearance } from '../TabBar';

export type Detent = 0 | 1 | 2;

/** How much of the sheet shows at "peek", above the floating tab bar. */
export const PEEK = 132;

/** Distance from the bottom of the screen to the top of the sheet at each height. */
export function sheetTop(detent: Detent, height: number, topInset: number, bottomInset: number): number {
  const peek = tabBarClearance(bottomInset) + PEEK;
  return detent === 0 ? height - peek : detent === 1 ? height * 0.5 : topInset + 72;
}

export function MapSheet({ detent, onDetent, header, children }: { detent: Detent; onDetent: (d: Detent) => void; header: ReactNode; children: ReactNode }) {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const stops = [0, 1, 2].map((d) => sheetTop(d as Detent, height, insets.top, insets.bottom));
  const y = useSharedValue(stops[detent]);
  const start = useSharedValue(stops[detent]);
  const [headerH, setHeaderH] = useState(PEEK);
  // Set when a drag picked the height: its spring (carrying the finger's speed) is already running,
  // so the effect below must not restart it from zero.
  const fromDrag = useRef<Detent | null>(null);

  useEffect(() => {
    const skip = fromDrag.current === detent;
    fromDrag.current = null;
    if (skip) return;
    y.set(reduced ? withTiming(stops[detent], { duration: duration.fast }) : withSpring(stops[detent], spring.sheet));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stops follow height and insets
  }, [detent, height, insets.top, insets.bottom, reduced]);

  // One light tap when the sheet catches a new height; none when it springs back to the same one.
  const settle = (d: Detent) => {
    if (d === detent) return; // sprang back to the same height: nothing changes
    haptic.press();
    fromDrag.current = d;
    onDetent(d);
  };

  const pan = usePanGesture({
    onActivate: () => {
      'worklet';
      start.set(y.get());
    },
    onUpdate: (e) => {
      'worklet';
      // Follows the finger, with a little resistance past the top and bottom heights.
      const next = start.get() + e.translationY;
      const top = stops[2];
      const bottom = stops[0];
      y.set(next < top ? top - (top - next) * 0.25 : next > bottom ? bottom + (next - bottom) * 0.25 : next);
    },
    onDeactivate: (e) => {
      'worklet';
      // Where would a flick carry it? Pick the nearest height to that.
      const projected = y.get() + e.velocityY * 0.15;
      let best = 0;
      for (let i = 1; i < stops.length; i++) if (Math.abs(stops[i] - projected) < Math.abs(stops[best] - projected)) best = i;
      y.set(withSpring(stops[best], { ...spring.sheet, velocity: e.velocityY }));
      scheduleOnRN(settle, best as Detent);
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  return (
    <Animated.View style={[s.sheet, { height, backgroundColor: c.surface, borderColor: c.hairline }, sheetStyle]}>
      <GestureDetector gesture={pan}>
        <View onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)} accessible accessibilityRole="adjustable" accessibilityLabel="Map details. Drag up or down to resize." accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={(e) => onDetent((e.nativeEvent.actionName === 'increment' ? Math.min(2, detent + 1) : Math.max(0, detent - 1)) as Detent)}>
          <View style={s.grab}>
            <View style={[s.handle, { backgroundColor: c.inkFaint }]} />
          </View>
          {header}
        </View>
      </GestureDetector>
      {/* The body fills down to the floating tab bar at the current height, so its list can scroll to the end. */}
      <View style={{ height: Math.max(0, height - stops[detent] - headerH - tabBarClearance(insets.bottom) - space.s) }}>{children}</View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, top: 0, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, borderCurve: 'continuous' },
  grab: { paddingTop: space.s, paddingBottom: space.s, alignItems: 'center' },
  handle: { width: 36, height: 5, borderRadius: 3, opacity: 0.6 },
});

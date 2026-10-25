/**
 * Sheet.tsx — a bottom sheet (brief section 6, item 10), built with Reanimated + Gesture Handler
 * instead of a library, because the popular sheet library doesn't yet promise support for the
 * gesture library version in our Expo SDK.
 *
 * How it works: the sheet's position is one number (how far down it is). Your finger moves that
 * number 1:1 while dragging; when you let go, a spring carries it to the nearest snap point (or
 * closes it if you flicked down). The dark backdrop's opacity is computed from the same number,
 * so it fades exactly with the drag. All of this runs on the UI thread, so it stays smooth.
 */
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { duration, elevation, radius, sceneInk, space, spring, useMotionReduced, useTheme } from '../../theme';
import { Txt } from './Text';

export function Sheet({
  open,
  onClose,
  snaps = [0.45, 0.88],
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Heights as fractions of the screen, smallest first. Opens at the first one. */
  snaps?: number[];
  title?: string;
  children: ReactNode;
}) {
  const { c, isDark } = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  // y = distance from the top of the screen to the top of the sheet.
  const stops = snaps.map((f) => height * (1 - f));
  const closed = height;
  const y = useSharedValue(closed);
  const start = useSharedValue(closed);

  useEffect(() => {
    const target = open ? stops[0] : closed;
    y.value = reduced ? withTiming(target, { duration: duration.fast }) : withSpring(target, spring.sheet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, height]);

  const pan = usePanGesture({
    onActivate: () => {
      'worklet';
      start.value = y.value;
    },
    onUpdate: (e) => {
      'worklet';
      y.value = Math.max(stops[stops.length - 1] - 24, start.value + e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      // A downward flick, or dragging below the lowest stop, closes the sheet.
      if (e.velocityY > 900 || y.value > stops[0] + 80) {
        y.value = withSpring(closed, spring.sheet);
        scheduleOnRN(onClose);
        return;
      }
      const projected = y.value + e.velocityY * 0.12;
      let best = stops[0];
      for (const s of stops) if (Math.abs(s - projected) < Math.abs(best - projected)) best = s;
      y.value = withSpring(best, { ...spring.sheet, velocity: e.velocityY });
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [stops[0], closed], [0.4, 0], 'clamp') }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: sceneInk.shade }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        style={[s.sheet, { height, backgroundColor: c.surface, paddingBottom: insets.bottom + space.l }, elevation(c, isDark, 2), sheetStyle]}
        accessibilityViewIsModal={open}
      >
        <GestureDetector gesture={pan}>
          <View style={s.grab} accessibilityRole="adjustable" accessibilityLabel={title ? `${title}. Drag to resize.` : 'Drag to resize'}>
            <View style={[s.handle, { backgroundColor: c.hairline }]} />
            {title ? (
              <Txt variant="title3" style={{ alignSelf: 'flex-start', paddingHorizontal: space.xl, marginTop: space.s }} accessibilityRole="header">
                {title}
              </Txt>
            ) : null}
          </View>
        </GestureDetector>
        <View style={{ flex: 1, paddingHorizontal: space.xl }}>{children}</View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, top: 0, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  grab: { paddingTop: space.s, paddingBottom: space.m, alignItems: 'center' },
  handle: { width: 40, height: 5, borderRadius: 3 },
});

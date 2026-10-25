/**
 * Button.tsx — the app's buttons (brief section 6, items 1–3).
 *
 *   Button:     primary (water-blue fill), secondary (surface + hairline), text, danger.
 *   IconButton: a 44 pt circle, for map controls and headers.
 *   Pressable:  any tappable area with the same press feel (cards, rows, tiles).
 *
 * Press feel: shrinks to 97% with the "snappy" spring and springs back; primary buttons give a
 * light tap haptic. Loading: the label cross-fades to a small progress bar, and the width stays put.
 */
import { useEffect, type ReactNode } from 'react';
import { Pressable as RNPressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { easing as curves } from '../../theme/motion';
import { duration, easing, font, haptic, radius, space, spring, tapTarget, useMotionReduced, useTheme } from '../../theme';
import { Icon, type IconName } from '../Icon';
import { Txt } from './Text';

/** A tappable area that presses in slightly and springs back. */
export function Pressable({ children, style, scaleTo = 0.97, onPressIn, onPressOut, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; children: ReactNode }) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[pressStyle, style]}>
      <RNPressable
        {...rest}
        onPressIn={(e) => {
          // Touch-down answers at once (120 ms ease-out); letting go springs back.
          scale.value = withTiming(scaleTo, { duration: 120, easing: curves.standard });
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.value = withSpring(1, spring.snappy);
          onPressOut?.(e);
        }}
      >
        {children}
      </RNPressable>
    </Animated.View>
  );
}

type Kind = 'primary' | 'secondary' | 'text' | 'danger';

export function Button({
  label,
  icon,
  onPress,
  kind = 'secondary',
  disabled,
  loading,
  hint,
  style,
  compact,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  kind?: Kind;
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const { c } = useTheme();
  const colors: Record<Kind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: c.accent, fg: c.onAccent },
    secondary: { bg: c.surface, fg: c.ink, border: c.hairline },
    text: { bg: 'transparent', fg: c.accent },
    danger: { bg: c.levels[3].bg, fg: c.levels[3].fg, border: c.levels[3].fg },
  };
  const k = colors[kind];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={() => {
        if (kind === 'primary' || kind === 'danger') haptic.press();
        onPress();
      }}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={style}
    >
      <View
        style={[
          s.button,
          compact && { minHeight: tapTarget, paddingHorizontal: space.m },
          kind === 'text' && { paddingHorizontal: space.xs },
          { backgroundColor: k.bg, borderColor: k.border ?? 'transparent', borderWidth: k.border ? 1 : 0, opacity: disabled ? 0.45 : 1 },
        ]}
      >
        {/* The label stays in place (invisible) while loading, so the button keeps its width. */}
        <View style={[s.row, loading && { opacity: 0 }]}>
          {icon ? <Icon name={icon} tint={k.fg} size={18} /> : null}
          <Txt variant="headline" color={k.fg} style={{ fontFamily: font.semibold }}>
            {label}
          </Txt>
        </View>
        {loading ? <LoadingBar color={k.fg} /> : null}
      </View>
    </Pressable>
  );
}

/** A thin bar that slides back and forth: "working on it" without a spinner. */
function LoadingBar({ color }: { color: string }) {
  const x = useSharedValue(0);
  const reduced = useMotionReduced();
  useEffect(() => {
    x.value = reduced ? 0.5 : withRepeat(withTiming(1, { duration: 900, easing: easing.move }), -1, true);
  }, [x, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -18 + 36 * x.value }] }));
  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} accessibilityElementsHidden>
      <View style={{ width: 48, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: color + '33' }}>
        <Animated.View style={[{ width: 12, height: 3, borderRadius: 2, backgroundColor: color, marginLeft: 18 }, style]} />
      </View>
    </View>
  );
}

export function IconButton({ icon, label, onPress, tint, style, filled }: { icon: IconName; label: string; onPress: () => void; tint?: string; style?: StyleProp<ViewStyle>; filled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.95} style={style}>
      <View style={[s.iconButton, { backgroundColor: filled ? c.surface : 'transparent', borderColor: filled ? c.hairline : 'transparent' }]}>
        <Icon name={icon} tint={tint ?? c.ink} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: space.xl, borderRadius: radius.md, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  iconButton: { width: tapTarget, height: tapTarget, borderRadius: tapTarget / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});

export { duration };

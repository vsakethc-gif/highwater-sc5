/**
 * Chips.tsx — StatusBadge, HazardChip, LayerChip, and SegmentedControl (brief section 6, items 4–7).
 * Every status is shown with an icon AND a word, never color alone.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { HAZARDS } from '../../../../shared/hazards/hazards';
import { LEVELS, type Level } from '../../../../shared/hazards/levels';
import type { HazardId } from '../../../../shared/hazards/types';
import { duration, easing, font, haptic, radius, space, spring, tapTarget, useMotionReduced, useTheme } from '../../theme';
import { Icon } from '../Icon';
import { Pressable } from './Button';
import { Txt } from './Text';

/**
 * Icon + level word on the level's colors. When the level changes, the colors morph (slow).
 * `pulse`: at Danger, the icon breathes gently (1 → 1.06, 1.6 s) unless Reduce Motion is on.
 */
export function StatusBadge({ level, size = 'm', pulse }: { level: Level; size?: 's' | 'm'; pulse?: boolean }) {
  const { c } = useTheme();
  const reduced = useMotionReduced();
  const info = LEVELS[level];
  const morph = useSharedValue<number>(level);
  const beat = useSharedValue(1);
  useEffect(() => {
    morph.value = withTiming(level, { duration: 240, easing: easing.standard });
  }, [level, morph]);
  useEffect(() => {
    if (pulse && level === 3 && !reduced) beat.value = withRepeat(withSequence(withTiming(1.06, { duration: 800 }), withTiming(1, { duration: 800 })), -1, false);
    else {
      cancelAnimation(beat);
      beat.value = 1;
    }
  }, [pulse, level, reduced, beat]);
  const bgs = [0, 1, 2, 3].map((l) => c.levels[l as Level].bg);
  const badgeStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(morph.value, [0, 1, 2, 3], bgs) }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  const fg = c.levels[level].fg;
  const small = size === 's';
  return (
    <Animated.View style={[s.badge, small && s.badgeSmall, badgeStyle]} accessible accessibilityLabel={`${info.name} level`}>
      <Animated.View style={iconStyle}>
        <Icon name={info.icon} size={small ? 14 : 18} tint={fg} />
      </Animated.View>
      <Txt variant={small ? 'footnote' : 'headline'} color={fg} style={{ fontFamily: font.semibold }}>
        {info.name}
      </Txt>
    </Animated.View>
  );
}

/** A hazard with its level: icon, name, and a small level dot plus word. */
export function HazardChip({ hazard, level, onPress }: { hazard: HazardId; level: Level; onPress?: () => void }) {
  const { c } = useTheme();
  const h = HAZARDS[hazard];
  const body = (
    <View style={[s.chip, { backgroundColor: c.surface, borderColor: c.hairline }]}>
      <Icon name={h.icon} size={18} />
      <Txt variant="callout">{h.label}</Txt>
      <View style={[s.dot, { backgroundColor: c.levels[level].fg }]} />
      <Txt variant="footnote" color={c.levels[level].fg}>
        {LEVELS[level].name}
      </Txt>
    </View>
  );
  if (!onPress) return <View accessible accessibilityLabel={`${h.label}, ${LEVELS[level].name} level`}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${h.label}, ${LEVELS[level].name} level`}>
      {body}
    </Pressable>
  );
}

/** A map layer toggle: when switched on, the chip fills and a checkmark draws itself in. */
export function LayerChip({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  const { c } = useTheme();
  const draw = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    draw.value = withTiming(on ? 1 : 0, { duration: duration.fast, easing: easing.standard });
  }, [on, draw]);
  const checkStyle = useAnimatedStyle(() => ({ width: 16 * draw.value, opacity: draw.value }));
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onToggle();
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
    >
      <View style={[s.chip, { backgroundColor: on ? c.accentSoft : c.surface, borderColor: on ? c.accent : c.hairline }]}>
        <Animated.View style={[{ overflow: 'hidden', height: 16 }, checkStyle]}>
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path d="M20 6 9 17l-5-5" stroke={c.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
        <Txt variant="callout" color={on ? c.accent : c.ink}>
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}

/** Two to four options on a sunken track; the thumb slides to the choice with a snappy spring. */
export function SegmentedControl<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const { c, isDark } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width / options.length;
  const x = useSharedValue(index * segment);
  useEffect(() => {
    x.value = withTiming(index * segment, { duration: 200, easing: easing.move });
  }, [index, segment, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View
      style={[s.track, { backgroundColor: c.surfaceSunken }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 4)}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {width > 0 ? (
        <Animated.View
          style={[
            s.thumb,
            { width: segment, backgroundColor: c.surface },
            isDark ? { borderWidth: 1, borderColor: c.hairline } : { shadowColor: c.shadow, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
            thumb,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <View key={o.value} style={{ flex: 1 }}>
            <Pressable
              onPress={() => {
                if (!selected) {
                  haptic.select();
                  onChange(o.value);
                }
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              scaleTo={0.98}
            >
              <View style={s.segment}>
                <Txt variant="callout" color={selected ? c.ink : c.inkMuted} style={selected ? { fontFamily: font.semibold } : undefined}>
                  {o.label}
                </Txt>
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, paddingHorizontal: space.m, minHeight: 36, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeSmall: { minHeight: 26, paddingHorizontal: space.s, gap: space.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: tapTarget, paddingHorizontal: space.m, borderWidth: 1, borderRadius: radius.pill },
  dot: { width: 8, height: 8, borderRadius: 4 },
  track: { flexDirection: 'row', padding: 2, borderRadius: radius.sm + 2 },
  thumb: { position: 'absolute', top: 2, bottom: 2, left: 2, borderRadius: radius.sm },
  segment: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.s },
});

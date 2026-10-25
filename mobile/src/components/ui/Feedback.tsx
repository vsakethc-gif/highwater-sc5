/**
 * Feedback.tsx — how the app talks about state (brief sections 6 and 12):
 *   Banner      info / stale / offline / simulation / emergency; slides in from the top
 *   Notice      an inline card: what failed, what still works, and a Retry button
 *   Skeleton    placeholders shaped like the real content, with a soft moving shimmer
 *   EmptyState  a small water-line drawing, one helpful sentence, an optional action
 */
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion, SlideInUp, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { duration, font, radius, space, useMotionReduced, useTheme } from '../../theme';
import { Icon, type IconName } from '../Icon';
import { Button, Pressable } from './Button';
import { Txt } from './Text';

type BannerKind = 'info' | 'stale' | 'offline' | 'simulation' | 'emergency';

export function Banner({ kind, title, detail, action, onAction }: { kind: BannerKind; title: string; detail?: string; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  const look: Record<BannerKind, { bg: string; fg: string; icon: IconName }> = {
    info: { bg: c.accentSoft, fg: c.ink, icon: 'Info' },
    stale: { bg: c.levels[1].bg, fg: c.levels[1].fg, icon: 'Clock' },
    offline: { bg: c.surfaceSunken, fg: c.ink, icon: 'CloudOff' },
    simulation: { bg: c.simBg, fg: c.simFg, icon: 'FlaskConical' },
    emergency: { bg: c.levels[3].bg, fg: c.levels[3].fg, icon: 'OctagonAlert' },
  };
  const l = look[kind];
  return (
    <Animated.View
      entering={kind === 'emergency' ? undefined : SlideInUp.duration(duration.base).reduceMotion(ReduceMotion.System)}
      style={[s.banner, { backgroundColor: l.bg }]}
      accessibilityRole={kind === 'emergency' ? 'alert' : 'summary'}
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
    >
      <Icon name={l.icon} tint={l.fg} size={18} />
      <View style={{ flex: 1 }}>
        <Txt variant="footnote" color={l.fg} style={{ fontFamily: font.bold }}>
          {title}
        </Txt>
        {detail ? (
          <Txt variant="footnote" color={l.fg} numberOfLines={2}>
            {detail}
          </Txt>
        ) : null}
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={action} hitSlop={8}>
          <View style={[s.bannerAction, { borderColor: l.fg }]}>
            <Txt variant="footnote" color={l.fg}>
              {action}
            </Txt>
          </View>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

export function Notice({ icon = 'CloudOff', title, detail, onRetry, tone = 'error' }: { icon?: IconName; title: string; detail?: string; onRetry?: () => void; tone?: 'error' | 'info' }) {
  const { c } = useTheme();
  const edge = tone === 'error' ? c.levels[2].fg : c.accent;
  return (
    <View style={[s.notice, { backgroundColor: c.surface, borderColor: c.hairline, borderLeftColor: edge }]} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      <Icon name={icon} tint={edge} />
      <View style={{ flex: 1, gap: space.xs }}>
        <Txt variant="headline" accessibilityLabel={detail ? `${title} ${detail}` : title}>{title}</Txt>
        {onRetry ? <Button label="Try again" icon="RotateCcw" kind="text" onPress={onRetry} style={{ alignSelf: 'flex-start' }} /> : null}
      </View>
    </View>
  );
}

/** A soft highlight sweeps across (1.2 s loop, low contrast). Static under Reduce Motion. */
export function Skeleton({ height, width, radius: r = radius.md, style }: { height: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { c, isDark } = useTheme();
  const reduced = useMotionReduced();
  const x = useSharedValue(0);
  useEffect(() => {
    if (!reduced) x.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [reduced, x]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: -160 + x.value * 560 }] }));
  return (
    <View style={[{ height, width: width ?? '100%', borderRadius: r, backgroundColor: c.surfaceSunken, overflow: 'hidden' }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: 140, backgroundColor: isDark ? '#FFFFFF0A' : '#FFFFFF8C' }, sweep]} />
    </View>
  );
}

/** A small line drawing in the water-line style, one helpful sentence, and an optional action. */
export function EmptyState({ title, detail, action, onAction, children }: { title: string; detail?: string; action?: string; onAction?: () => void; children?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={s.empty}>
      <Svg width={72} height={36} viewBox="0 0 72 36" accessibilityElementsHidden>
        <Path d="M2 20c6 0 6-5 12-5s6 5 12 5 6-5 12-5 6 5 12 5 6-5 12-5 6 5 8 5" stroke={c.accent} strokeWidth={2} fill="none" strokeLinecap="round" />
        <Path d="M2 30c6 0 6-5 12-5s6 5 12 5 6-5 12-5 6 5 12 5 6-5 12-5 6 5 8 5" stroke={c.accent} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.45} />
        <Path d="M36 2v10" stroke={c.accent} strokeWidth={2} strokeLinecap="round" />
      </Svg>
      <Txt variant="headline" style={{ textAlign: 'left' }} accessibilityLabel={detail ? `${title} ${detail}` : title}>
        {title}
      </Txt>
      {children}
      {action && onAction ? <Button label={action} kind="secondary" onPress={onAction} compact style={{ alignSelf: 'flex-start' }} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.xl, paddingVertical: space.s, minHeight: 52 },
  bannerAction: { minHeight: 36, paddingHorizontal: space.m, borderRadius: radius.sm, borderWidth: 1, justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: space.m, padding: space.l, borderWidth: 1, borderLeftWidth: 4, borderRadius: radius.md },
  empty: { gap: space.s, paddingVertical: space.l, alignItems: 'flex-start' },
});

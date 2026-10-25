/**
 * Module.tsx — one translucent card floating on the Status scene, like the modules in a weather app
 * (REDESIGN.md 2.3). Each has a small icon and an uppercase label ("WHY THIS STATUS"), then content.
 *
 * On iPhone it's a real frosted-glass blur of the scene behind it. With "Reduce Transparency" on, and
 * on Android (where blur is slow and experimental), it's a flat, faintly lighter panel instead.
 * No shadows: a 1 pt hairline border separates it from the scene.
 *
 * Modules rise 12 pt and fade in once, 40 ms apart, when the screen first gets data. At Danger they
 * appear at once (emergency information never waits for an animation).
 */
import { BlurView } from 'expo-blur';
import { createContext, use, useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { duration, easing, radius, sceneInk, space, STAGGER_MS, useReduceTransparency } from '../../theme';
import { Icon, type IconName } from '../Icon';
import { Txt } from '../ui/Text';

/**
 * The entrance for the i-th module. Danger: none (emergency information appears instantly).
 * `quick` is for coming back to a tab you've already seen: the same rise, but shorter and tighter,
 * because you see it many times a day.
 */
export function moduleEntering(index: number, urgent: boolean, quick = false) {
  if (urgent) return undefined;
  return FadeInDown.duration(quick ? 180 : duration.base)
    .delay(index * (quick ? 25 : STAGGER_MS))
    .easing(easing.emphasized)
    .withInitialValues({ opacity: 0, transform: [{ translateY: quick ? 6 : 12 }] })
    .reduceMotion(ReduceMotion.System);
}

/** True inside a screen you've come back to (see useFocusReplay): modules use the quick entrance. */
export const QuickEntrance = createContext(false);

/**
 * The glass panel on its own (used by the modules, the action tiles, the ribbon and the timeline).
 * `floating` is for chrome that hovers over scrolling content (the ribbon, the timeline): a stronger
 * blur, and without blur a nearly opaque dark backing, so text scrolling underneath never shows through.
 */
export function Glass({ children, style, rounded = radius.module, floating }: { children: ReactNode; style?: StyleProp<ViewStyle>; rounded?: number; floating?: boolean }) {
  const solid = useReduceTransparency();
  const frame = [s.glass, { borderRadius: rounded }, solid && { backgroundColor: floating ? sceneInk.floating : sceneInk.module }, style];
  if (solid) return <View style={frame}>{children}</View>;
  return (
    <BlurView intensity={floating ? 70 : 30} tint="dark" style={[frame, { overflow: 'hidden', backgroundColor: floating ? sceneInk.floatingTint : sceneInk.glassTint }]}>
      {children}
    </BlurView>
  );
}

export function Module({
  icon,
  label,
  right,
  index,
  urgent,
  children,
  padded = true,
}: {
  icon: IconName;
  label: string;
  /** Optional small action at the right of the label row ("See all"). */
  right?: ReactNode;
  /** Position on the screen, for the one-time staggered entrance. */
  index: number;
  urgent: boolean;
  children: ReactNode;
  /** False for modules whose rows run edge to edge with their own padding. */
  padded?: boolean;
}) {
  const quick = use(QuickEntrance);
  const entering = useMemo(() => moduleEntering(index, urgent, quick), [index, urgent, quick]);
  return (
    <Animated.View entering={entering}>
      <Glass>
        <View style={s.labelRow}>
          <Icon name={icon} size={14} tint={sceneInk.meta} />
          <Txt variant="moduleLabel" color={sceneInk.meta} style={{ flex: 1 }} accessibilityRole="header">
            {label}
          </Txt>
          {right}
        </View>
        <View style={padded ? s.body : s.bodyFlush}>{children}</View>
      </Glass>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  glass: { borderWidth: StyleSheet.hairlineWidth, borderColor: sceneInk.moduleBorder, borderCurve: 'continuous' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 44, paddingHorizontal: space.l, paddingTop: space.xs },
  body: { paddingHorizontal: space.l, paddingBottom: space.l },
  bodyFlush: { paddingBottom: space.xs },
});

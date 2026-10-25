/**
 * TabBar.tsx — the bottom tab bar (brief section 6, item 21): five tabs, each with an icon AND a label.
 * It floats as a rounded pill just above the bottom edge. A soft blue pill sits behind the selected
 * tab and slides to the next one with a snappy spring; the selected icon grows a little and fills in.
 * On iPhone the bar uses the system blur, unless "Reduce Transparency" is on; on Android it's solid.
 * Over the Status scene it picks up the scene's tint: dark glass, white labels, the level's accent.
 */
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { easing, elevation, font, haptic, radius, scene, sceneInk, space, spring, useReduceTransparency, useTheme, type SceneKey } from '../theme';
import { useAppState } from '../state';
import { Icon, type IconName } from './Icon';
import { Txt } from './ui/Text';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Status', icon: 'Activity' },
  map: { label: 'Map', icon: 'Map' },
  route: { label: 'Route', icon: 'Signpost' },
  report: { label: 'Report', icon: 'Megaphone' },
  more: { label: 'More', icon: 'Menu' },
};

/** The pill's own height, and how far it floats above the bottom. */
const BAR = 62;
const SIDE = 12;
/** Room screens leave at the bottom (added to the safe-area inset) so nothing hides under the bar. */
export const TAB_BAR_HEIGHT = BAR + 14;

/** How far the bar floats above the bottom edge, given the home-indicator inset. */
const barBottom = (bottomInset: number) => (bottomInset > 0 ? bottomInset - 6 : space.m);
/** Distance from the bottom of the screen to the top of the bar: what floating content must clear. */
export const tabBarClearance = (bottomInset: number) => barBottom(bottomInset) + BAR;

/** Over the Status scene: the scene's accent for the selected tab, soft white for the rest. */
function sceneTint(key: SceneKey) {
  return { active: scene[key].accent, idle: sceneInk.secondary, pill: sceneInk.control };
}

function TabButton({ name, focused, onPress, onScene }: { name: string; focused: boolean; onPress: () => void; onScene: SceneKey | null }) {
  const { c } = useTheme();
  const tint0 = onScene !== null ? sceneTint(onScene) : null;
  const grow = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    grow.value = withSpring(focused ? 1 : 0, spring.snappy);
  }, [focused, grow]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.1 * grow.value }] }));
  const tab = TABS[name];
  if (!tab) return null;
  const tint = tint0 ? (focused ? tint0.active : tint0.idle) : focused ? c.accent : c.inkMuted;
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={tab.label} style={s.tab}>
      <Animated.View style={iconStyle}>
        <Icon name={tab.icon} size={22} tint={tint} filled={focused} />
      </Animated.View>
      <Txt variant="footnote" color={tint} maxFontSizeMultiplier={1.3} style={{ fontSize: 11, lineHeight: 14, fontFamily: focused ? font.bold : font.medium }}>
        {tab.label}
      </Txt>
    </Pressable>
  );
}

export function TabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const { c, isDark } = useTheme();
  const { sceneKey } = useAppState();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const solid = useReduceTransparency();
  const onScene = state.routes[state.index]?.name === 'index' ? sceneKey : null;
  const glassDark = isDark || onScene !== null;
  // Tabs switched off in features.ts (href: null) are left out of the bar.
  const visible = state.routes.filter((r) => (descriptors[r.key]?.options as { href?: unknown } | undefined)?.href !== null);
  const tabWidth = width / Math.max(1, visible.length);
  const visibleIndex = Math.max(0, visible.findIndex((r) => r.key === state.routes[state.index]?.key));
  const x = useSharedValue(0);
  useEffect(() => {
    // Ease-in-out, 220 ms: it moves across the bar, so it eases in and out; a spring here wobbled.
    // withTiming starts from wherever the pill is, so tapping fast retargets it smoothly.
    x.value = withTiming(visibleIndex * tabWidth, { duration: 220, easing: easing.move });
  }, [visibleIndex, tabWidth, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const content = (
    <View style={{ flexDirection: 'row', height: BAR, paddingHorizontal: 4 }} accessibilityRole="tablist">
      <View style={StyleSheet.absoluteFill} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)} pointerEvents="none" />
      {width > 0 ? (
        <Animated.View style={[s.indicator, { width: tabWidth }, indicator]} pointerEvents="none">
          <View style={[s.indicatorPill, { backgroundColor: onScene !== null ? sceneTint(onScene).pill : c.accentSoft }]} />
        </Animated.View>
      ) : null}
      {visible.map((route) => (
        <TabButton
          key={route.key}
          name={route.name}
          focused={state.routes[state.index]?.key === route.key}
          onScene={onScene}
          onPress={() => {
            if (state.routes[state.index]?.key !== route.key) {
              haptic.select();
              navigateToTab(route.key);
            }
          }}
        />
      ))}
    </View>
  );

  const frame = [s.bar, { bottom: barBottom(insets.bottom), borderColor: onScene !== null ? sceneInk.moduleBorder : c.hairline }];
  const solidBg = onScene !== null ? scene[onScene].bottom : c.surface;
  return (
    <View style={[frame, elevation(c, glassDark, 2), { backgroundColor: solid ? solidBg : 'transparent' }]}>
      {solid ? content : (
        <BlurView intensity={onScene !== null ? 60 : 90} tint={glassDark ? 'dark' : 'light'} style={s.blur}>
          {content}
        </BlurView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { position: 'absolute', left: SIDE, right: SIDE, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  blur: { borderRadius: radius.pill, overflow: 'hidden' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  indicator: { position: 'absolute', top: 5, bottom: 5, left: 4, paddingHorizontal: 3 },
  indicatorPill: { flex: 1, borderRadius: radius.pill },
});

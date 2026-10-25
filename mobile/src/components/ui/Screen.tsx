/**
 * Screen.tsx — the frame every tab uses:
 *   - safe areas (notch, home bar), status bar style per theme
 *   - the persistent "SIMULATION — not live data" banner while Scenario Mode is on
 *   - an error boundary, so a crash in one tab shows a calm recovery card instead of a blank app
 *   - optional large title that collapses into a compact header as you scroll (brief section 7)
 */
import { StatusBar } from 'expo-status-bar';
import { Component, type ReactNode } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { findScenario } from '../../../../shared/scenario/scenario';
import { useAppState } from '../../state';
import { SCREEN_PAD, space, useTheme } from '../../theme';
import { Banner, Notice } from './Feedback';
import { Txt } from './Text';

/** Catches a crash inside one tab and shows a recovery card with Retry. */
export class TabErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ padding: SCREEN_PAD, paddingTop: space.x4 }}>
        <Notice title="This screen didn’t load." detail="Your other tabs still work. In an emergency, call 911." onRetry={() => this.setState({ failed: false })} />
      </View>
    );
  }
}

export function SimulationBanner() {
  const { scenario, setScenario } = useAppState();
  const info = findScenario(scenario);
  if (!info) return null;
  return <Banner kind="simulation" title="SIMULATION — not live data" detail={info.title} action="Exit" onAction={() => setScenario(null)} />;
}

export function Screen({ children, edges = ['top', 'left', 'right'] }: { children: ReactNode; edges?: ('top' | 'left' | 'right' | 'bottom')[] }) {
  const { c, isDark } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SimulationBanner />
      <TabErrorBoundary>{children}</TabErrorBoundary>
    </SafeAreaView>
  );
}

/**
 * A scroll view with a large title that shrinks into a compact header as you scroll, with a
 * hairline appearing once content slides beneath it. `header` sits under the large title.
 */
export function LargeTitleScroll({
  title,
  right,
  header,
  children,
  refreshControl,
  onScroll,
}: {
  title: string;
  right?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  refreshControl?: React.ReactElement;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const { c } = useTheme();
  const scrollY = useSharedValue(0);
  const handler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const compact = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [28, 52], [0, 1], 'clamp') }));
  const hairline = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [40, 60], [0, 1], 'clamp') }));
  const big = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 40], [1, 0], 'clamp'),
    transform: [{ translateY: interpolate(scrollY.value, [-80, 0, 60], [10, 0, -12], 'clamp') }, { scale: interpolate(scrollY.value, [-80, 0], [1.06, 1], 'clamp') }],
  }));
  return (
    <View style={{ flex: 1 }}>
      {/* The compact header: fades in (with its own background) once the large title scrolls away. */}
      <Animated.View style={[s.compactBar, { backgroundColor: c.bg }, compact]} pointerEvents="none" accessibilityElementsHidden>
        <Txt variant="headline">{title}</Txt>
        <Animated.View style={[s.hairline, { backgroundColor: c.hairline }, hairline]} />
      </Animated.View>
      <Animated.ScrollView
        onScroll={handler}
        scrollEventThrottle={16}
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingHorizontal: SCREEN_PAD, paddingBottom: 140 }}
        onMomentumScrollEnd={onScroll}
      >
        <Animated.View style={[s.largeRow, big]}>
          <Txt variant="title1" accessibilityRole="header" style={{ flex: 1 }}>
            {title}
          </Txt>
          {right}
        </Animated.View>
        {header}
        {children}
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  compactBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 44, zIndex: 2, alignItems: 'center', justifyContent: 'center' },
  hairline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
  largeRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, paddingBottom: space.s },
});

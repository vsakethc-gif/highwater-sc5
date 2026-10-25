/**
 * onboarding.tsx — three short pages, shown once on first launch (brief section 8.1), skippable:
 *   1. Know what's happening near you    (water line rising beside a river and a house)
 *   2. Clear steps when it matters       (a checklist)
 *   3. Use your location?                (why, and that it's not stored; or choose a county)
 * The page dots stretch into a pill for the current page. The illustrations drift slightly as you
 * swipe (parallax), driven by the scroll position on the UI thread.
 */
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { APP_NAME } from '../../../shared/config';
import { Wordmark } from '../components/Logo';
import { platform } from '../../../shared/platform';
import { Button, Pressable } from '../components/ui/Button';
import { Txt } from '../components/ui/Text';
import { WaterLine } from '../components/ui/WaterLine';
import { font, haptic, radius, SCREEN_PAD, space, spring, useTheme } from '../theme';

export const ONBOARDED_KEY = 'sc5ready.onboarded';

function finish(chooseCounty = false) {
  platform().storage.setItem(ONBOARDED_KEY, '1');
  router.replace('/');
  if (chooseCounty) setTimeout(() => router.push('/county'), 350);
}

/** Page 1: a house and a river; the water line rises beside them. */
function RiverArt() {
  const { c } = useTheme();
  return (
    <View style={[s.art, { backgroundColor: c.surface, borderColor: c.hairline }]}>
      <Svg width="100%" height="100%" viewBox="0 0 280 180" style={StyleSheet.absoluteFill}>
        <Path d="M170 110 L205 82 L240 110 V150 H170 Z" fill="none" stroke={c.ink} strokeWidth={2} strokeLinejoin="round" />
        <Rect x={198} y={124} width={14} height={26} fill="none" stroke={c.ink} strokeWidth={2} />
        <Path d="M30 150 C 70 140, 110 160, 150 150" stroke={c.inkFaint} strokeWidth={2} fill="none" strokeLinecap="round" />
        <Path d="M70 40 V 128" stroke={c.accent} strokeWidth={3} strokeLinecap="round" />
        {[56, 76, 96, 116].map((y) => (
          <Path key={y} d={`M64 ${y} H 76`} stroke={c.accent} strokeWidth={2} strokeLinecap="round" />
        ))}
      </Svg>
      <WaterLine fill={0.42} top={c.waterTop} bottom={c.waterBottom} amplitude={6} style={s.artWater} />
    </View>
  );
}

/** Page 2: a short checklist, two items ticked. */
function ChecklistArt() {
  const { c } = useTheme();
  return (
    <View style={[s.art, { backgroundColor: c.surface, borderColor: c.hairline, padding: space.xl, gap: space.m, justifyContent: 'center' }]}>
      {[true, true, false].map((done, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <Svg width={26} height={26} viewBox="0 0 26 26">
            <Circle cx={13} cy={13} r={11} fill={done ? c.accent : 'none'} stroke={done ? c.accent : c.inkFaint} strokeWidth={2} />
            {done ? <Path d="M8 13.5 l3.5 3.5 l6.5 -7" stroke={c.onAccent} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
          </Svg>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: c.surfaceSunken, width: [180, 140, 160][i] }} />
        </View>
      ))}
      <WaterLine fill={0.14} top={c.waterTop} bottom={c.waterBottom} amplitude={4} style={s.artWater} />
    </View>
  );
}

const PAGES = [
  { title: 'Know what’s happening near you.', body: `Live river levels and official alerts for the 8 counties of South Carolina’s 5th District, in plain words.`, Art: RiverArt },
  { title: 'Clear steps when it matters.', body: 'Plain-language steps to take, routes that avoid known danger areas, and reports from neighbors.', Art: ChecklistArt },
  { title: 'Use your location?', body: 'Your location shows hazards near you. It stays on your phone, goes only to the public weather and flood services that answer for that spot, and is never stored.', Art: null },
];

function Dot({ active }: { active: boolean }) {
  const { c } = useTheme();
  const w = useSharedValue(active ? 24 : 8);
  useEffect(() => {
    w.value = withSpring(active ? 24 : 8, spring.snappy);
  }, [active, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: active ? c.accent : c.hairline }, style]} />;
}

function Page({ index, x, width, children }: { index: number; x: SharedValue<number>; width: number; children: React.ReactNode }) {
  // Parallax: the art drifts at a different speed than the page as you swipe.
  const drift = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(x.value, [(index - 1) * width, index * width, (index + 1) * width], [width * 0.25, 0, -width * 0.25]) }] }));
  return <Animated.View style={drift}>{children}</Animated.View>;
}

export default function Onboarding() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const scroller = useRef<ComponentRef<typeof Animated.ScrollView>>(null);
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });
  const last = page === PAGES.length - 1;
  const goTo = (i: number) => {
    scroller.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={s.top}>
        <Wordmark size={32} motto />
        {!last ? (
          <Pressable onPress={() => finish()} accessibilityRole="button" accessibilityLabel="Skip introduction" hitSlop={10}>
            <Txt variant="headline" tone="accent" style={{ padding: space.s }}>
              Skip
            </Txt>
          </Pressable>
        ) : null}
      </View>
      <Animated.ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {PAGES.map((p, i) => (
          <View key={p.title} style={{ width, paddingHorizontal: SCREEN_PAD, justifyContent: 'center', gap: space.xxl }} accessibilityElementsHidden={i !== page}>
            {p.Art ? (
              <Page index={i} x={x} width={width}>
                <p.Art />
              </Page>
            ) : null}
            <Txt variant="serifTitle" accessibilityRole="header">
              {p.title}
            </Txt>
            <Txt variant="body" tone="muted" style={{ fontSize: 18, lineHeight: 28 }}>
              {p.body}
            </Txt>
            {i === 2 ? (
              <View style={{ gap: space.s }}>
                <Button
                  label="Allow location"
                  icon="LocateFixed"
                  kind="primary"
                  onPress={() => {
                    Location.requestForegroundPermissionsAsync()
                      .catch(() => null)
                      .finally(() => finish());
                  }}
                />
                <Button label="Choose a county instead" onPress={() => finish(true)} />
                <Pressable onPress={() => Linking.openURL('tel:911')} accessibilityRole="button" accessibilityLabel="Call 911">
                  <Txt variant="footnote" style={{ marginTop: space.m }}>
                    {APP_NAME} is not an official warning system. In an emergency, <Txt variant="footnote" color={c.levels[3].fg} style={{ fontFamily: font.bold }}>call 911</Txt>.
                  </Txt>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </Animated.ScrollView>
      <View style={s.bottom}>
        <View style={{ flexDirection: 'row', gap: space.s }} accessible accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}>
          {PAGES.map((p, i) => (
            <Dot key={p.title} active={i === page} />
          ))}
        </View>
        {!last ? (
          <Button
            label="Next"
            kind="primary"
            onPress={() => {
              haptic.press();
              goTo(page + 1);
            }}
            style={{ minWidth: 120 }}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SCREEN_PAD, minHeight: 52 },
  art: { height: 200, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  artWater: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 64 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SCREEN_PAD, paddingBottom: space.l, minHeight: 72 },
});

/**
 * Status tab — "Living Status" (REDESIGN.md section 3). The whole screen IS the condition: a living
 * scene whose sky, water line and rain reflect the level here (StatusScene), with the information on
 * top in translucent modules, like a weather app.
 *
 *   top:      the live ribbon (how fresh the data is), fixed under the status bar
 *   hero:     county (tap to change) · the giant level word · the hazard · the headline · one line
 *             of context ("Rain next 24 h: 2.1 in · 3 rivers rising")
 *   modules:  Why this status · What to do now · Rivers near you · Alerts · Rain · Actions · footer
 *   dock:     in the storm timeline scenario, a scrubber above the tab bar that drives the scene
 *
 * Scrolling condenses the hero into a compact bar ("York County · Warning · Flooding") and darkens
 * the scene; pulling down lifts the water and refreshes. Everything comes from the shared engine
 * through useStatus(), exactly as before; only the look changed.
 */
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Linking, Platform, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, interpolate, ReduceMotion, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
import { COUNTIES } from '../../../../shared/config';
import { routeAllowed } from '../../../../shared/guidance/guidance';
import { HAZARDS } from '../../../../shared/hazards/hazards';
import { LEVELS } from '../../../../shared/hazards/levels';
import { countyName, placeLabel } from '../../../../shared/places';
import { STORM_TIMELINE, timelineIndex } from '../../../../shared/scenario/scenario';
import { clockTime } from '../../../../shared/time';
import { RainBars } from '../../components/data/Charts';
import { ChecklistItem, GaugeRow } from '../../components/data/Rows';
import { Icon, type IconName } from '../../components/Icon';
import { StatusScene } from '../../components/scene/StatusScene';
import { LiveRibbon } from '../../components/status/LiveRibbon';
import { Glass, Module, moduleEntering, QuickEntrance } from '../../components/status/Module';
import { ScenarioTimeline } from '../../components/status/ScenarioTimeline';
import { AlertTimeRow, TriggerLine } from '../../components/status/StatusRows';
import { stepVisual } from '../../components/status/steps';
import { tabBarClearance } from '../../components/TabBar';
import { Pressable } from '../../components/ui/Button';
import { HazardChip } from '../../components/ui/Chips';
import { Notice, Skeleton } from '../../components/ui/Feedback';
import { ListRow } from '../../components/ui/Layout';
import { TabErrorBoundary } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Text';
import { useFocusReplay } from '../../hooks/useFocusReplay';
import { useStatus, type StatusData } from '../../hooks/useStatus';
import { TABS_ON } from '../../features';
import { useAppState } from '../../state';
import { duration, easing, font, haptic, radius, scene, sceneInk, ScenePaletteProvider, SCREEN_PAD, space, spring, type, useMotionReduced, type SceneKey } from '../../theme';

const SITE = 'https://vsakethc-gif.github.io/highwater-sc5/';
/** Height of the ribbon row under the status bar, and of the compact title that appears on scroll. */
const RIBBON = 52;
const COMPACT = 30;
/** Space between modules: generous, so the screen never feels squished (REDESIGN.md build loop). */
const MODULE_GAP = space.l;

/** True while this tab is on screen and the app is in the foreground (the scene pauses otherwise). */
function useSceneActive(): boolean {
  const [focused, setFocused] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);
  return focused && foreground;
}

/** Which scene to show: the level, or the neutral slate when we can't confirm conditions. */
function sceneKeyOf(data: StatusData | null): SceneKey {
  if (!data) return 'unknown';
  return !data.overall.complete && data.overall.level === 0 ? 'unknown' : data.overall.level;
}

export default function StatusScreen() {
  const { scenario, setScenario, setSceneKey } = useAppState();
  const { data, refreshing, refresh } = useStatus();
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const active = useSceneActive();
  const key = sceneKeyOf(data);
  // Each time you come back to this tab, the modules rise in again and the water refills.
  const visit = useFocusReplay();

  const scrollY = useSharedValue(0);
  const waterLevel = useSharedValue(0);
  const dragging = useSharedValue(false);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  // Tell the tab bar which scene it floats over, so it can pick up the tint.
  useEffect(() => setSceneKey(key), [key, setSceneKey]);

  // The water rises or falls to the level with a gentle spring (instantly with Reduce Motion), unless a
  // finger is on the storm timeline, which moves the water itself.
  useEffect(() => {
    if (dragging.get()) return;
    const target = key === 'unknown' ? 0 : key;
    waterLevel.set(reduced ? target : withSpring(target, spring.gentle));
  }, [key, reduced, waterLevel, dragging]);
  useEffect(() => {
    if (visit === 0 || reduced) return;
    // Coming back: the water drains to the floor and rises again to the current level.
    const target = key === 'unknown' ? 0 : key;
    waterLevel.set(-0.6);
    waterLevel.set(withSpring(target, spring.gentle));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new visit
  }, [visit]);

  const step = timelineIndex(scenario);
  const onStep = useCallback((i: number) => setScenario(STORM_TIMELINE.steps[i].id), [setScenario]);
  const timelineShown = step >= 0 && !!data;

  const rainIn = data && !(data.c.rain instanceof Error) ? data.c.rain.data.next24h_in : 0;
  const bottomPad = tabBarClearance(insets.bottom) + (timelineShown ? 88 : 0) + space.xxl;

  return (
    <View style={{ flex: 1, backgroundColor: scene[key].bottom }}>
      <StatusBar style="light" />
      <StatusScene sceneKey={key} waterLevel={waterLevel} rainIn={rainIn} scrollY={scrollY} active={active} onPullThreshold={Platform.OS === 'ios' ? haptic.press : undefined} />
      <ScenePaletteProvider sceneKey={key}>
        <TabErrorBoundary>
          <Animated.ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingTop: insets.top + RIBBON + space.s, paddingHorizontal: SCREEN_PAD, paddingBottom: bottomPad }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  if (Platform.OS !== 'ios') haptic.press();
                  refresh();
                }}
                // On iPhone the rising water is the pull indicator, so the system spinner is hidden.
                tintColor="transparent"
                colors={[scene[key].accent]}
                progressBackgroundColor={scene[key].top}
                progressViewOffset={insets.top + RIBBON}
              />
            }
          >
            {data ? (
              <QuickEntrance value={visit > 0}>
                <View key={visit}>
                  <Hero data={data} sceneKey={key} scrollY={scrollY} />
                  <Modules data={data} quick={visit > 0} />
                </View>
              </QuickEntrance>
            ) : (
              <Loading />
            )}
          </Animated.ScrollView>
        </TabErrorBoundary>

        <TopBar data={data} sceneKey={key} scrollY={scrollY} refreshing={refreshing} onExitSimulation={() => setScenario(null)} />

        {timelineShown ? (
          <Animated.View entering={FadeIn.duration(duration.base)} style={[s.dock, { bottom: tabBarClearance(insets.bottom) + space.s }]}>
            <ScenarioTimeline steps={STORM_TIMELINE.steps} index={step} level={data.overall.level} onStep={onStep} waterLevel={waterLevel} dragging={dragging} />
          </Animated.View>
        ) : null}
      </ScenePaletteProvider>

      {data?.c.simulated ? <SimulationEdge top={insets.top} /> : null}
    </View>
  );
}

/** Scenario Mode: a thin dashed violet line along the top of the scene (the hue of the scene stays). */
function SimulationEdge({ top }: { top: number }) {
  const { width } = useWindowDimensions();
  return (
    <Svg width={width} height={2} style={{ position: 'absolute', top, left: 0 }} pointerEvents="none" accessibilityElementsHidden>
      <Line x1={0} y1={1} x2={width} y2={1} stroke={sceneInk.sim} strokeWidth={2} strokeDasharray="6 5" />
    </Svg>
  );
}

/**
 * The fixed top: the live ribbon, plus the compact title ("York County · Warning · Flooding") that
 * fades in once the big hero has scrolled away. Its backing fills in with the scene's sky color so
 * the ribbon stays readable over the modules scrolling beneath it.
 */
function TopBar({ data, sceneKey, scrollY, refreshing, onExitSimulation }: { data: StatusData | null; sceneKey: SceneKey; scrollY: SharedValue<number>; refreshing: boolean; onExitSimulation: () => void }) {
  const insets = useSafeAreaInsets();
  const { place } = useAppState();
  const backing = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [80, 170], [0, 0.96], 'clamp') }));
  const compact = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [130, 180], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(scrollY.get(), [130, 180], [6, 0], 'clamp') }],
  }));
  const top = data?.blocks[0];
  const title = data ? [placeLabel(place), sceneKey === 'unknown' ? 'Can’t confirm' : LEVELS[data.overall.level].name, top && data.overall.level > 0 ? HAZARDS[top.hazard].label : null].filter(Boolean).join(' · ') : '';
  return (
    <View style={[s.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: scene[sceneKey].top, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sceneInk.moduleBorder }, backing]} pointerEvents="none" />
      <View style={s.ribbonRow} pointerEvents="box-none">
        <LiveRibbon data={data} refreshing={refreshing} onExitSimulation={onExitSimulation} />
      </View>
      <Animated.View style={[s.compactRow, compact]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Txt variant="headline" color={sceneInk.primary} numberOfLines={1}>
          {title}
        </Txt>
      </Animated.View>
    </View>
  );
}

/**
 * The hero (Weather pattern): county, the giant level word, the hazard, the headline, one line of context.
 * As you scroll it shrinks toward the top-left and fades, handing over to the compact title above.
 */
function Hero({ data, sceneKey, scrollY }: { data: StatusData; sceneKey: SceneKey; scrollY: SharedValue<number> }) {
  const { place } = useAppState();
  const { width } = useWindowDimensions();
  const reduced = useMotionReduced();
  const accent = scene[sceneKey].accent;
  const level = data.overall.level;
  const unconfirmed = sceneKey === 'unknown';
  const top = data.blocks[0];
  const hazard = HAZARDS[top.hazard];
  const word = unconfirmed ? 'Can’t confirm' : LEVELS[level].name;

  // Level changed: vibrate (stronger for Warning and Danger) and tell screen readers.
  const previous = useRef<SceneKey | null>(null);
  useEffect(() => {
    if (previous.current !== null && previous.current !== sceneKey && sceneKey !== 'unknown') {
      haptic.level(sceneKey);
      AccessibilityInfo.announceForAccessibility(`Status changed to ${LEVELS[sceneKey].name}. ${top.whatsHappening}`);
    }
    previous.current = sceneKey;
  }, [sceneKey, top.whatsHappening]);

  const wordStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [70, 160], [1, 0], 'clamp'),
    transform: [{ scale: interpolate(scrollY.get(), [-120, 0, 160], [1.04, 1, 0.6], 'clamp') }],
  }));
  const fadeEarly = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [0, 90], [1, 0], 'clamp') }));
  const fadeMid = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [30, 130], [1, 0], 'clamp') }));

  // The new word crossfades in and slides up 8 pt (a plain fade with Reduce Motion). No delay, ever.
  const enter = useMemo(
    () => (level === 3 ? undefined : reduced ? FadeIn.duration(duration.fast) : FadeInDown.duration(duration.base).easing(easing.emphasized).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] }).reduceMotion(ReduceMotion.System)),
    [reduced, level],
  );
  const exit = FadeOut.duration(140);

  const gauges = data.c.gauges instanceof Error ? null : data.c.gauges.data.filter((g) => g.county_fips === place.fips);
  const rising = gauges ? gauges.filter((g) => g.trend === 'rising').length : 0;
  // Context as small icon chips instead of a sentence.
  const chips: { icon: IconName; text: string; label: string }[] = [];
  if (!(data.c.rain instanceof Error)) chips.push({ icon: 'CloudRain', text: `${data.c.rain.data.next24h_in.toFixed(1)} in`, label: `${data.c.rain.data.next24h_in.toFixed(1)} inches of rain forecast in the next 24 hours` });
  if (gauges && gauges.length) chips.push({ icon: rising ? 'TrendingUp' : 'Waves', text: rising ? `${rising} rising` : 'Rivers steady', label: rising ? `${rising} river${rising === 1 ? '' : 's'} rising` : 'No rivers rising' });
  const context = chips.map((x) => x.label).join('. ');
  const wordSize = width < 375 ? 56 : type.sceneWord.fontSize;

  return (
    <View style={s.hero}>
      <Pressable onPress={() => router.push('/county')} accessibilityRole="button" accessibilityLabel={`${placeLabel(place)}. Change place`} scaleTo={0.97} style={{ alignSelf: 'flex-start' }}>
        <View style={s.county}>
          {place.kind === 'point' ? <Icon name="Navigation" size={15} tint={sceneInk.primary} /> : null}
          <Txt variant="headline" color={sceneInk.primary}>
            {placeLabel(place)}
          </Txt>
          <Icon name="ChevronDown" size={16} tint={sceneInk.secondary} />
        </View>
      </Pressable>
      {place.kind === 'point' ? (
        <Txt variant="footnote" color={sceneInk.meta}>
          In {countyName(place.fips)} County
        </Txt>
      ) : null}

      <Animated.View style={[s.wordBox, { height: wordSize + 8, transformOrigin: 'left center' }, wordStyle]} accessible accessibilityRole="header" accessibilityLabel={`${word}. ${unconfirmed ? 'We can’t confirm conditions right now.' : top.whatsHappening}`}>
        <Animated.View key={word} entering={enter} exiting={exit} style={StyleSheet.absoluteFill}>
          <Txt variant="sceneWord" color={sceneInk.primary} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.25} style={{ fontSize: wordSize, lineHeight: wordSize + 6 }}>
            {word}
          </Txt>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[{ gap: space.s }, fadeMid]}>
        <Animated.View key={top.hazard} entering={FadeIn.duration(duration.base)} style={s.hazard}>
          {/* A large level icon in the level's color, then the hazard. */}
          <View style={[s.levelChip, { borderColor: accent }]}>
            <Icon name={unconfirmed ? 'CircleAlert' : LEVELS[level].icon} size={22} tint={accent} />
          </View>
          <Icon name={unconfirmed ? 'CloudOff' : level === 0 ? 'Activity' : hazard.icon} size={20} tint={accent} />
          <Txt variant="headline" color={accent}>
            {unconfirmed ? 'Data didn’t load' : level === 0 ? 'No active alerts' : hazard.label}
          </Txt>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[{ gap: space.m, marginTop: space.s }, fadeEarly]}>
        <Animated.View key={`${top.whatsHappening}|${context}`} entering={level === 3 ? undefined : FadeIn.duration(200).reduceMotion(ReduceMotion.System)} style={{ gap: space.m }} accessible accessibilityLabel={`${unconfirmed ? 'We can’t confirm conditions right now. Check weather.gov and local news.' : top.whatsHappening} ${context}`}>
        {unconfirmed ? (
          <Txt variant="headline" color={sceneInk.secondary} style={{ fontFamily: font.medium }}>
            Check weather.gov and local news.
          </Txt>
        ) : null}
        {chips.length ? (
          <View style={s.chips}>
            {chips.map((x) => (
              <View key={x.icon} style={s.infoChip}>
                <Icon name={x.icon} size={15} tint={sceneInk.secondary} />
                <Txt variant="footnote" color={sceneInk.primary} style={{ fontFamily: font.semibold, fontVariant: ['tabular-nums'] }}>
                  {x.text}
                </Txt>
              </View>
            ))}
          </View>
        ) : null}
        </Animated.View>
        {data.overall.active.length > 1 ? (
          <View style={s.chips}>
            {data.overall.active.slice(1).map((h) => (
              <HazardChip key={h.hazard} hazard={h.hazard} level={h.level} />
            ))}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

function Loading() {
  // Placeholders shaped like the real hero and modules, so nothing jumps when data arrives.
  return (
    <View accessibilityLabel="Loading the status" accessible>
      <View style={[s.hero, { gap: space.m }]}>
        <Skeleton height={20} width="40%" radius={6} />
        <Skeleton height={64} width="70%" radius={10} />
        <Skeleton height={20} width="45%" radius={6} />
        <Skeleton height={44} radius={8} />
      </View>
      <View style={{ gap: MODULE_GAP }}>
        {[180, 260, 200].map((h, i) => (
          <Glass key={i} style={{ padding: space.l, gap: space.m }}>
            <Skeleton height={12} width="35%" radius={4} />
            <Skeleton height={h - 60} radius={10} />
          </Glass>
        ))}
      </View>
    </View>
  );
}

function Modules({ data, quick }: { data: StatusData; quick: boolean }) {
  const urgent = data.overall.level === 3;
  // The route tile shows only where leaving makes sense AND the Route tab is switched on.
  const canLeave = TABS_ON.route && routeAllowed(data.blocks);
  return (
    <View style={{ gap: MODULE_GAP }}>
      <WhyModule data={data} index={0} urgent={urgent} />
      <DoModule data={data} index={1} urgent={urgent} />
      <RiversModule data={data} index={2} urgent={urgent} />
      <AlertsModule data={data} index={3} urgent={urgent} />
      <RainModule data={data} index={4} urgent={urgent} />
      <Animated.View entering={moduleEntering(5, urgent, quick)} style={{ gap: MODULE_GAP }}>
        <View style={s.tiles}>
          {canLeave ? <ActionTile icon="Signpost" title="Plan a route out" detail="Lower-exposure routes and open shelters" onPress={() => router.navigate('/route')} /> : null}
          <ActionTile icon="Megaphone" title="Report a problem" detail="Flooded road, downed tree, streetlight out" onPress={() => router.navigate('/report')} />
          {canLeave ? null : <ActionTile icon="Map" title="Open the map" detail="Rivers, alerts, and who’s most exposed" onPress={() => router.navigate('/map')} />}
        </View>
        {canLeave ? <ActionRow icon="Map" title="Open the map" detail="Rivers, alerts, and who’s most exposed" onPress={() => router.navigate('/map')} /> : null}
      </Animated.View>
      <Footer />
    </View>
  );
}

function WhyModule({ data, index, urgent }: { data: StatusData; index: number; urgent: boolean }) {
  const [open, setOpen] = useState(false);
  const triggers = data.overall.all.flatMap((h) => h.triggers).filter((t) => t.level > 0).sort((a, b) => b.level - a.level);
  const shown = open ? triggers : triggers.slice(0, 3);
  return (
    <Module
      icon="ListChecks"
      label="Why this status"
      index={index}
      urgent={urgent}
      right={
        <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={open ? 'Show less' : 'See everything we checked'} hitSlop={8}>
          <Txt variant="footnote" tone="accent" style={{ fontFamily: font.semibold }}>
            {open ? 'Show less' : 'See all'}
          </Txt>
        </Pressable>
      }
    >
      {!data.overall.complete
        ? data.overall.gaps.map((g) => (
            <View key={g} style={s.gap}>
              <Icon name="CircleAlert" size={16} tint={sceneInk.amber} />
              <Txt variant="callout" style={{ flex: 1 }}>
                {g}
              </Txt>
            </View>
          ))
        : null}
      {shown.length ? shown.map((t, i) => <TriggerLine key={`${t.text}-${i}`} t={t} last={i === shown.length - 1} />) : <Txt variant="callout">Nothing we check is above Normal right now.</Txt>}
      {open ? (
        <Animated.View entering={FadeIn.duration(duration.base).reduceMotion(ReduceMotion.System)} style={{ marginTop: space.l, gap: space.s }}>
          <Txt variant="moduleLabel" color={sceneInk.meta}>
            What we checked
          </Txt>
          {data.checks.map((ch) => (
            <Txt key={ch} variant="callout" tone="muted">
              {ch}
            </Txt>
          ))}
        </Animated.View>
      ) : null}
    </Module>
  );
}

/** A quiet "show more" row: the details stay one tap away. */
function MoreToggle({ open, onPress, more }: { open: boolean; onPress: () => void; more: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={open ? `Hide ${more}` : `Show ${more}`} hitSlop={4}>
      <View style={s.moreRow}>
        <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={16} tint={sceneInk.secondary} />
        <Txt variant="footnote" color={sceneInk.secondary} style={{ fontFamily: font.semibold }}>
          {open ? 'Show less' : more}
        </Txt>
      </View>
    </Pressable>
  );
}

function SubLabel({ children }: { children: string }) {
  return (
    <Txt variant="moduleLabel" color={sceneInk.meta} style={{ marginTop: space.xl, marginBottom: space.xs }}>
      {children}
    </Txt>
  );
}

function DoModule({ data, index, urgent }: { data: StatusData; index: number; urgent: boolean }) {
  const g = data.blocks[0];
  const shelter = g.shelterInPlace && g.level >= 1;
  const [allSteps, setAllSteps] = useState(false);
  const [more, setMore] = useState(false);
  const steps = allSteps ? g.doNow : g.doNow.slice(0, 3);
  return (
    <Module icon="CircleCheck" label="What to do now" index={index} urgent={urgent}>
      {shelter ? (
        <View style={s.shelter}>
          <Icon name="House" size={22} tint={scene[g.level].accent} />
          <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel="Stay where you are and take shelter. For this kind of danger, driving away puts you at more risk, so this app doesn’t offer a route out.">
            <Txt variant="headline">Stay where you are and take shelter.</Txt>
            <Txt variant="footnote">Driving away is riskier. No route out.</Txt>
          </View>
        </View>
      ) : null}
      {steps.map((step, i) => (
        <ChecklistItem key={step} storageKey={`sc5ready.check.${g.hazard}.${g.level}.${i}`} text={step} number={i + 1} flush last={i === steps.length - 1} short={stepVisual(step)} />
      ))}
      {g.doNow.length > 3 ? <MoreToggle open={allSteps} onPress={() => setAllSteps(!allSteps)} more={`${g.doNow.length - 3} more step${g.doNow.length - 3 === 1 ? '' : 's'}`} /> : null}
      <MoreToggle open={more} onPress={() => setMore(!more)} more="If it gets worse, and official guidance" />
      {more ? (
        <Animated.View entering={FadeIn.duration(duration.fast).reduceMotion(ReduceMotion.System)}>
          <SubLabel>If it gets worse</SubLabel>
          {g.ifWorse.map((line) => (
            <View key={line} style={s.bullet}>
              <View style={[s.bulletDot, { backgroundColor: sceneInk.meta }]} />
              <Txt style={{ flex: 1 }}>{line}</Txt>
            </View>
          ))}
          <SubLabel>Check on others</SubLabel>
          <View style={s.bullet}>
            <Icon name="Users" size={18} tint={sceneInk.secondary} />
            <Txt style={{ flex: 1 }}>{g.checkOnOthers}</Txt>
          </View>
          <SubLabel>Official guidance</SubLabel>
          {g.links.map((l, i) => (
            <ListRow key={l.url} title={l.label} icon="ExternalLink" onPress={() => Linking.openURL(l.url)} last={i === g.links.length - 1} chevron={false} hint="Opens in your browser" />
          ))}
        </Animated.View>
      ) : null}
    </Module>
  );
}

function RiversModule({ data, index, urgent }: { data: StatusData; index: number; urgent: boolean }) {
  const { place } = useAppState();
  const county = `${countyName(place.fips)} County`;
  if (data.c.gauges instanceof Error) {
    return (
      <Module icon="Waves" label="Rivers near you" index={index} urgent={urgent}>
        <Notice title="Couldn’t load river levels from USGS." detail="Alerts may still be working. You can also check waterdata.usgs.gov." />
      </Module>
    );
  }
  const list = data.c.gauges.data.filter((g) => g.county_fips === place.fips);
  const rank = { major: 4, moderate: 3, minor: 2, action: 1 } as const;
  list.sort((a, b) => (b.flood_category ? rank[b.flood_category] : 0) - (a.flood_category ? rank[a.flood_category] : 0) || Number(b.has_official_stage) - Number(a.has_official_stage) || a.name.localeCompare(b.name));
  const simulated = data.c.gauges.source.startsWith('Scenario');
  return (
    <Module icon="Waves" label="Rivers near you" index={index} urgent={urgent}>
      {list.length ? (
        <>
          {list.map((g, i) => (
            <GaugeRow key={g.site_id} g={g} index={i} last={i === list.length - 1} />
          ))}
          <Txt variant="footnote" style={{ marginTop: space.s }} accessibilityLabel={`Gage height is how high the water is, in feet. ${simulated ? 'Simulated or replayed readings.' : 'Provisional USGS data: readings may be revised.'}`}>
            {simulated ? 'Simulated readings · feet' : 'Provisional · USGS · feet'}
          </Txt>
        </>
      ) : (
        <View style={{ gap: space.m, alignItems: 'flex-start' }}>
          <View style={s.empty} accessible accessibilityLabel={`There are no river gauges in ${county}. Official alerts and the rain forecast still count.`}>
            <Icon name="Waves" size={18} tint={sceneInk.meta} />
            <Txt variant="callout">{`No river gauges in ${county}`}</Txt>
          </View>
          <Pressable onPress={() => router.navigate('/map')} accessibilityRole="button" accessibilityLabel="See gauges in nearby counties on the map" hitSlop={8}>
            <Txt variant="callout" tone="accent" style={{ fontFamily: font.semibold }}>
              See nearby gauges on the map ›
            </Txt>
          </Pressable>
        </View>
      )}
    </Module>
  );
}

function AlertsModule({ data, index, urgent }: { data: StatusData; index: number; urgent: boolean }) {
  const { place } = useAppState();
  const failed = data.c.alerts instanceof Error || data.alertsHere === null;
  const list = data.alertsHere ?? [];
  return (
    <Module icon="TriangleAlert" label="Alerts" index={index} urgent={urgent} padded={failed || !list.length}>
      {failed ? (
        <Notice title="Couldn’t load alerts from the National Weather Service." detail="Check official alerts at weather.gov/alerts." />
      ) : list.length ? (
        list.map((a, i) => <AlertTimeRow key={a.id} a={a} last={i === list.length - 1} now={Date.parse(data.updatedAt)} />)
      ) : (
        <View style={{ gap: space.xs }} accessible accessibilityLabel={`No active National Weather Service alerts for ${placeLabel(place)} right now.`}>
          <View style={s.empty}>
            <Icon name="CircleCheck" size={18} tint={sceneInk.meta} />
            <Txt variant="callout">No active alerts</Txt>
          </View>
          {data.c.alerts instanceof Error ? null : <Txt variant="footnote">{`NWS · checked ${clockTime(data.c.alerts.fetched_at)}`}</Txt>}
        </View>
      )}
    </Module>
  );
}

function RainModule({ data, index, urgent }: { data: StatusData; index: number; urgent: boolean }) {
  const { place } = useAppState();
  return (
    <Module icon="CloudRain" label="Rain" index={index} urgent={urgent}>
      {data.c.rain instanceof Error ? (
        <Notice title="Couldn’t load the rain forecast." detail="Alerts and river levels may still be working." />
      ) : (
        <>
          <RainBars next24={data.c.rain.data.next24h_in} next48={data.c.rain.data.next48h_in} />
          <Txt variant="footnote" style={{ marginTop: space.m }} accessibilityLabel={`Forecast for ${place.kind === 'point' ? 'this spot' : COUNTIES.find((x) => x.fips === place.fips)?.seat.name ?? 'the county seat'}, from the ${data.c.rain.source}. 2 inches or more in 24 hours, the dashed line, raises flooding to Watch.`}>
            {`${place.kind === 'point' ? 'This spot' : COUNTIES.find((x) => x.fips === place.fips)?.seat.name ?? 'County seat'} · NWS · dashed = 2 in (Watch)`}
          </Txt>
        </>
      )}
    </Module>
  );
}

/** A square-ish action module (the two side by side under the info modules). */
function ActionTile({ icon, title, detail, onPress }: { icon: IconName; title: string; detail: string; onPress: () => void }) {
  const { scenario } = useAppState();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={scenario && icon !== 'Map' ? `${detail}. Simulated, nothing is sent.` : detail} style={{ flex: 1 }}>
      <Glass style={s.tile}>
        <Icon name={icon} size={24} tint={sceneInk.primary} />
        <Txt variant="headline">{title}</Txt>
      </Glass>
    </Pressable>
  );
}

function ActionRow({ icon, title, detail, onPress }: { icon: IconName; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={detail}>
      <Glass style={s.actionRow}>
        <Icon name={icon} size={22} tint={sceneInk.primary} />
        <Txt variant="headline" style={{ flex: 1 }}>
          {title}
        </Txt>
        <Icon name="ChevronRight" size={18} tint={sceneInk.meta} />
      </Glass>
    </Pressable>
  );
}

/** The 911 color on the scene: the Danger accent, which reads on every scene palette. */
const CALL_911 = scene[3].accent;

function Footer() {
  return (
    <View style={s.footer}>
      <Txt variant="footnote" color={sceneInk.secondary} accessibilityLabel="Not an official warning system. Follow instructions from local officials. In an emergency, call 911.">
        Not an official warning system. Follow local officials.
      </Txt>
      <View style={{ flexDirection: 'row', gap: space.xl, flexWrap: 'wrap' }}>
        <Pressable onPress={() => Linking.openURL('tel:911')} accessibilityRole="button" accessibilityLabel="Call 911">
          <View style={s.footerLink}>
            <Icon name="Phone" size={18} tint={CALL_911} />
            <Txt variant="headline" color={CALL_911}>
              Call 911
            </Txt>
          </View>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(`${SITE}#/methodology`)} accessibilityRole="link" accessibilityLabel="How this works" accessibilityHint="Opens every rule and source in your browser">
          <View style={s.footerLink}>
            <Txt variant="headline" color={sceneInk.primary}>
              How this works ›
            </Txt>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  ribbonRow: { height: RIBBON, justifyContent: 'center', paddingHorizontal: SCREEN_PAD },
  compactRow: { height: COMPACT, justifyContent: 'flex-start', paddingHorizontal: SCREEN_PAD },
  dock: { position: 'absolute', left: space.l, right: space.l },
  hero: { paddingTop: space.l, paddingBottom: space.x4, gap: space.xs },
  county: { flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 44 },
  wordBox: { marginTop: space.s },
  hazard: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: space.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.m, minHeight: 30, borderRadius: radius.pill, backgroundColor: sceneInk.control },
  levelChip: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 44, marginTop: space.xs },
  gap: { flexDirection: 'row', gap: space.s, alignItems: 'flex-start', paddingVertical: space.s },
  shelter: { flexDirection: 'row', gap: space.m, paddingVertical: space.m, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sceneInk.moduleBorder },
  bullet: { flexDirection: 'row', gap: space.m, marginBottom: space.s },
  bulletDot: { width: 5, height: 5, borderRadius: 3, marginTop: 10 },
  tiles: { flexDirection: 'row', gap: MODULE_GAP },
  tile: { padding: space.l, gap: space.l, minHeight: 132, justifyContent: 'space-between' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, minHeight: 64 },
  footer: { paddingTop: space.l, gap: space.m },
  footerLink: { flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 44 },
});

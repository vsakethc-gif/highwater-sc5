/**
 * Route tab (brief section 10 and MOBILE_BRIEF 8.6) — a lower-exposure way out, never a "safe" one.
 * Three steps, one question per screen with big choices: 1. where you start, 2. where to go,
 * 3. the routes. A progress bar shows the step; Back links step backward without losing choices.
 *
 *   From: your location, or the place you picked on Status.
 *   To:   the nearest open shelter (FEMA's list), the nearest town center outside the active
 *         warning areas, or a ZIP code / address you type.
 *   Then the shared planner (the same code the website uses) asks our Worker for routes, goes around
 *   warning areas it can, and scores each route. The map shows up to three; swipe the cards to compare.
 *
 * For shelter-in-place hazards (tornado, severe storm, extreme cold) there is no planner at all:
 * leaving is the wrong advice, so the tab shows "stay where you are" guidance instead.
 *
 * Results (REDESIGN.md 5.4, the Citymapper pattern): when routes arrive, each line draws itself along
 * its path. The chosen route glows on the map while the others dim, and swiping the route cards moves
 * the map to that route. Each card has a "route makeup" bar: how much of the trip is inside an active
 * warning area (red), with the flood-zone crossings counted beside it.
 */
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Keyboard, Linking, Platform, ScrollView, Share, StyleSheet, Switch, TextInput, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import Animated, { FadeIn, FadeInRight, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Location from 'expo-location';
import { COUNTIES, COUNTY_EM, SCEMD_COUNTY_DIRECTORY } from '../../../../shared/config';
import { dataOrNull } from '../../../../shared/data/conditions';
import { loadStatic } from '../../../../shared/data/static';
import { HAZARDS } from '../../../../shared/hazards/hazards';
import { routeAllowed } from '../../../../shared/guidance/guidance';
import { countyName, placeFromZip } from '../../../../shared/places';
import { fetchReports, reportsAvailable, simulatedReports, type Report } from '../../../../shared/reports/client';
import { buildAvoidPlan, type LonLat, type PolygonCoords } from '../../../../shared/routing/avoid';
import { awayFromWarning, byDistance, fetchOpenShelters, type Shelter, type Town } from '../../../../shared/routing/destinations';
import { appleMapsLink, googleMapsLink } from '../../../../shared/routing/links';
import { planRoutes, searchAddress, type RoutePlan, type RouteResult } from '../../../../shared/routing/plan';
import { clockTime, relativeTime } from '../../../../shared/time';
import { Icon, type IconName } from '../../components/Icon';
import { googleDark, googleLight } from '../../components/map/mapStyle';
import { Button, Pressable } from '../../components/ui/Button';
import { Banner, Notice, Skeleton } from '../../components/ui/Feedback';
import { Card } from '../../components/ui/Layout';
import { LargeTitleScroll, Screen } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Text';
import { useStatus, type StatusData } from '../../hooks/useStatus';
import { useAppState } from '../../state';
import { duration, easing, font, haptic, listItemEntering, radius, scene, SCREEN_PAD, space, tapTarget, type, useMotionReduced, useTheme } from '../../theme';
import { withAlpha } from '../../components/map/mapStyle';

type Spot = { point: LonLat; label: string };
type Choice = 'shelter' | 'away' | 'place';

const SAFETY = 'Routes can’t see every closed or flooded road. Never drive through water. If officials give evacuation directions, follow theirs instead. Call 911 if you are in danger.';

export default function RouteScreen() {
  const { data } = useStatus();
  const allowed = data ? routeAllowed(data.blocks) : true;
  return (
    <Screen>
      <LargeTitleScroll title="Route">
        <View style={{ gap: space.l, marginTop: space.s }}>
          <SafetyCard />
          {!data ? <Skeleton height={220} /> : allowed ? <Planner data={data} /> : <StayPut hazard={HAZARDS[(data.overall.active.find((h) => !HAZARDS[h.hazard].leaveable) ?? data.overall.active[0])?.hazard ?? 'tornado'].label} />}
        </View>
      </LargeTitleScroll>
    </Screen>
  );
}

/** The safety note: always at the top, compact, never dismissible. */
function SafetyCard() {
  const { c } = useTheme();
  return (
    <View style={[s.safety, { backgroundColor: c.surface, borderColor: c.hairline }]} accessibilityRole="summary">
      <Icon name="TriangleAlert" size={18} tint={c.levels[1].fg} />
      <Txt variant="footnote" color={c.inkMuted} style={{ flex: 1 }}>
        {SAFETY}
      </Txt>
      <Pressable onPress={() => Linking.openURL('tel:911')} accessibilityRole="button" accessibilityLabel="Call 911" hitSlop={6}>
        <View style={[s.call, { backgroundColor: c.levels[3].bg, borderColor: c.levels[3].fg }]}>
          <Icon name="Phone" size={14} tint={c.levels[3].fg} />
          <Txt variant="footnote" color={c.levels[3].fg} style={{ fontFamily: font.bold }}>
            911
          </Txt>
        </View>
      </Pressable>
    </View>
  );
}

/** Shelter-in-place hazards: no route planner, on purpose. */
function StayPut({ hazard }: { hazard: string }) {
  return (
    <Card style={{ gap: space.s }}>
      <Icon name="House" size={28} />
      <Txt variant="title3" accessibilityRole="header">
        Stay where you are and take shelter.
      </Txt>
      <Txt variant="body" tone="muted">
        {`For ${hazard.toLowerCase()}, being on the road is more dangerous than staying inside a sturdy building. Go to the lowest floor, into an interior room away from windows. The route planner comes back when this alert ends.`}
      </Txt>
    </Card>
  );
}

function Planner({ data }: { data: StatusData }) {
  const { c } = useTheme();
  const { place, scenario } = useAppState();
  const alerts = useMemo(() => dataOrNull(data.c.alerts) ?? [], [data]);
  const avoidPolys = useMemo(() => buildAvoidPlan(alerts).sources.flatMap((x) => x.polygons), [alerts]);

  const placeStart = (): Spot => {
    if (place.kind === 'point') return { point: [place.lon, place.lat], label: place.label };
    const seat = COUNTIES.find((k) => k.fips === place.fips)!.seat;
    return { point: [seat.lon, seat.lat], label: `${seat.name} (${countyName(place.fips)} County seat)` };
  };
  const [start, setStart] = useState<Spot>(placeStart);
  useEffect(() => setStart(placeStart()), [place]); // eslint-disable-line react-hooks/exhaustive-deps

  const [step, setStep] = useState<'from' | 'to' | 'results'>('from');
  const [choice, setChoice] = useState<Choice>('shelter');
  const [shelters, setShelters] = useState<Shelter[] | Error | null>(null);
  const [towns, setTowns] = useState<Town[]>([]);
  const [typed, setTyped] = useState('');
  const [placeDest, setPlaceDest] = useState<Spot | null>(null);
  const [message, setMessage] = useState('');
  const [avoidFlooded, setAvoidFlooded] = useState(true);
  const [plan, setPlan] = useState<RoutePlan | Error | null>(null);
  const [planning, setPlanning] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchOpenShelters(AbortSignal.timeout(12_000)).then(setShelters, (e: Error) => setShelters(e));
    loadStatic<Town[]>('towns.json').then(setTowns, () => setTowns([]));
    return () => abort.current?.abort();
  }, []);

  // The destination follows the choice and the start point.
  const nearestShelter = Array.isArray(shelters) && shelters.length ? byDistance(shelters, start.point)[0] : null;
  const awayTown = choice === 'away' ? awayFromWarning(towns, start.point, avoidPolys) : null;
  const dest: Spot | null =
    choice === 'shelter' ? (nearestShelter ? { point: [nearestShelter.lon, nearestShelter.lat], label: `${nearestShelter.name} (open shelter)` } : null)
    : choice === 'away' ? (awayTown ? { point: [awayTown.lon, awayTown.lat], label: `${awayTown.name} (town center outside the warning area)` } : null)
    : placeDest;

  useEffect(() => setPlan(null), [start, choice, placeDest]);
  // If the shelter list comes back empty, don't leave "shelter" chosen.
  useEffect(() => {
    if (Array.isArray(shelters) && !shelters.length && choice === 'shelter') setChoice('place');
  }, [shelters, choice]);

  const useMine = async () => {
    setMessage('');
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return setMessage('Location is off. Using the place you picked on Status instead.');
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setStart({ point: [pos.coords.longitude, pos.coords.latitude], label: 'My location' });
    setStep('to');
  };

  const findPlace = async () => {
    Keyboard.dismiss();
    const q = typed.trim();
    if (!q) return;
    setMessage('');
    if (/^\d{5}$/.test(q)) {
      const r = await placeFromZip(q);
      if (typeof r === 'string') return setMessage(r);
      if (r.kind === 'point') setPlaceDest({ point: [r.lon, r.lat], label: r.label });
      return;
    }
    try {
      const matches = await searchAddress(q, AbortSignal.timeout(15_000));
      if (!matches.length) return setMessage('No match for that address. Try adding the city, or use a ZIP code.');
      setPlaceDest({ point: [matches[0].lon, matches[0].lat], label: matches[0].label });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Address search didn’t work. Try a ZIP code.');
    }
  };

  const go = async () => {
    if (!dest) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setPlanning(true);
    setPlan(null);
    try {
      const reports: Report[] = scenario ? simulatedReports() : reportsAvailable() ? await fetchReports().catch(() => []) : [];
      const result = await planRoutes(start.point, dest.point, alerts, ctl.signal, { reports, avoidFlooded });
      if (ctl.signal.aborted) return;
      haptic.success();
      setPlan(result);
      setStep('results');
    } catch (e) {
      if (ctl.signal.aborted) return;
      haptic.error();
      setPlan(e instanceof Error ? e : new Error('Routing is unavailable right now.'));
    } finally {
      if (!ctl.signal.aborted) setPlanning(false);
    }
  };

  const shelterHelp =
    shelters instanceof Error ? 'Couldn’t load FEMA’s shelter list right now.'
    : shelters === null ? 'Checking FEMA’s list…'
    : nearestShelter ? `${nearestShelter.name}, ${(nearestShelter.km / 1.609).toFixed(1)} mi away · ${shelters.length} open in or near SC-5 · checked ${clockTime(nearestShelter.checked_at)}`
    : 'No shelters are listed as open right now.';
  const awayHelp = !avoidPolys.length
    ? 'No active warning areas with a drawn boundary right now.'
    : choice === 'away' && !awayTown
      ? 'No town center found outside the warning area.'
      : 'The nearest town center outside the active warning areas.';

  const index = { from: 0, to: 1, results: 2 }[step];
  const progress = useSharedValue(1 / 3);
  useEffect(() => {
    progress.value = withTiming((index + 1) / 3, { duration: duration.base, easing: easing.standard });
  }, [index, progress]);
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  const enter = FadeInRight.duration(240).easing(easing.standard).reduceMotion(ReduceMotion.System);

  return (
    <View style={{ gap: space.l }}>
      <View style={[s.progress, { backgroundColor: c.surfaceSunken }]} accessible accessibilityLabel={`Step ${index + 1} of 3`}>
        <Animated.View style={[s.progressFill, { backgroundColor: c.accent }, bar]} />
      </View>

      {step === 'from' ? (
        <Animated.View key="from" entering={enter} style={{ gap: space.m }}>
          <Txt variant="title2" accessibilityRole="header">
            Where are you starting?
          </Txt>
          <OptionCard icon="LocateFixed" title="My location" detail="Uses your phone’s location. It’s only sent to the routing service for this trip." onPress={useMine} />
          <OptionCard
            icon="MapPin"
            title={start.label === 'My location' ? 'My location (found)' : start.label}
            detail={start.label === 'My location' ? 'Continue from where you are now.' : 'The place you picked on Status.'}
            onPress={() => setStep('to')}
          />
          {message ? <Txt variant="footnote" color={c.levels[2].fg}>{message}</Txt> : null}
        </Animated.View>
      ) : null}

      {step === 'to' ? (
        <Animated.View key="to" entering={enter} style={{ gap: space.m }}>
          <BackLink onPress={() => setStep('from')} label={`From ${start.label}`} />
          <Txt variant="title2" accessibilityRole="header">
            Where do you want to go?
          </Txt>
          <OptionCard icon="House" title="Nearest open shelter" detail={shelterHelp} selected={choice === 'shelter'} disabled={!nearestShelter} onPress={() => setChoice('shelter')} />
          {Array.isArray(shelters) && !shelters.length ? (
            <Button label={`${countyName(place.fips)} County Emergency Management`} icon="ExternalLink" compact onPress={() => Linking.openURL(COUNTY_EM[place.fips] ?? SCEMD_COUNTY_DIRECTORY)} hint="Shelters open only when officials announce them" />
          ) : null}
          <OptionCard icon="Signpost" title="Away from the warning area" detail={awayHelp} selected={choice === 'away'} disabled={!avoidPolys.length} onPress={() => setChoice('away')} />
          <OptionCard icon="Search" title="A place I choose" detail="A ZIP code or street address." selected={choice === 'place'} onPress={() => setChoice('place')} />
          {choice === 'place' ? (
            <Animated.View entering={FadeIn.duration(duration.fast)} style={[s.input, { backgroundColor: c.surfaceSunken }]}>
              <Icon name="Search" size={18} tint={c.inkMuted} />
              <TextInput
                value={typed}
                onChangeText={setTyped}
                placeholder="ZIP code or street address"
                placeholderTextColor={c.inkFaint}
                returnKeyType="search"
                onSubmitEditing={findPlace}
                accessibilityLabel="Destination ZIP code or address"
                style={[type.body, { flex: 1, color: c.ink, minHeight: tapTarget }]}
              />
              {typed.trim() ? <Button label="Find" kind="text" compact onPress={findPlace} /> : null}
            </Animated.View>
          ) : null}
          {message ? <Txt variant="footnote" color={c.levels[2].fg}>{message}</Txt> : null}
          {dest ? (
            <Animated.View entering={FadeIn.duration(duration.fast)} style={[s.destRow, { borderColor: c.accent, backgroundColor: c.accentSoft }]}>
              <Icon name="MapPin" tint={c.accent} />
              <Txt variant="headline" style={{ flex: 1 }} numberOfLines={2}>
                {dest.label}
              </Txt>
            </Animated.View>
          ) : null}
          <View style={s.toggle}>
            <View style={{ flex: 1 }}>
              <Txt variant="callout">Avoid community-reported flooded roads</Txt>
              <Txt variant="footnote">These reports are unverified.</Txt>
            </View>
            <Switch value={avoidFlooded} onValueChange={setAvoidFlooded} trackColor={{ true: c.accent, false: c.hairline }} accessibilityLabel="Avoid community-reported flooded roads" />
          </View>
          <Button label="Plan lower-exposure routes" icon="Navigation" kind="primary" loading={planning} disabled={!dest} onPress={go} />
          {plan instanceof Error ? <Notice title="Routing is unavailable right now." detail={`${plan.message} Use the official evacuation routes from your county, and follow officials’ directions.`} onRetry={go} /> : null}
        </Animated.View>
      ) : null}

      {step === 'results' && plan && !(plan instanceof Error) && dest ? (
        <Animated.View key="results" entering={enter} style={{ gap: space.m }}>
          <BackLink onPress={() => setStep('to')} label="Change destination" />
          <Txt variant="title2" accessibilityRole="header">
            Lower-exposure routes
          </Txt>
          <Txt variant="callout" tone="muted">{`${start.label} → ${dest.label}`}</Txt>
          <Results plan={plan} start={start} dest={dest} avoidPolys={avoidPolys} />
          <Button label="Plan another trip" kind="text" onPress={() => setStep('from')} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** A big tappable choice: icon, title, one line of detail; outlined in blue when chosen. */
function OptionCard({ icon, title, detail, selected, disabled, onPress }: { icon: IconName; title: string; detail: string; selected?: boolean; disabled?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={`${title}. ${detail}`}
      scaleTo={0.98}
    >
      <View style={[s.option, { backgroundColor: selected ? c.accentSoft : c.surface, borderColor: selected ? c.accent : c.hairline, opacity: disabled ? 0.55 : 1 }]}>
        <View style={[s.optionIcon, { backgroundColor: selected ? c.accent : c.surfaceSunken }]}>
          <Icon name={icon} size={22} tint={selected ? c.onAccent : c.ink} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="headline">{title}</Txt>
          <Txt variant="footnote">{detail}</Txt>
        </View>
        <Icon name={selected ? 'CircleCheck' : 'ChevronRight'} size={20} tint={selected ? c.accent : c.inkFaint} />
      </View>
    </Pressable>
  );
}

function BackLink({ onPress, label }: { onPress: () => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Back: ${label}`} style={{ alignSelf: 'flex-start' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: tapTarget }}>
        <Icon name="ChevronLeft" size={18} tint={c.accent} />
        <Txt variant="callout" tone="accent" numberOfLines={1}>
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}

const fmtMin = (sec: number) => {
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const fmtMi = (m: number) => `${(m / 1609.34).toFixed(1)} mi`;

function Results({ plan, start, dest, avoidPolys }: { plan: RoutePlan; start: Spot; dest: Spot; avoidPolys: PolygonCoords[] }) {
  const { c, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const map = useRef<ComponentRef<typeof MapView>>(null);
  const best = Math.max(0, plan.routes.findIndex((r) => r.isLowestExposure));
  const [sel, setSel] = useState(best);
  const [showSteps, setShowSteps] = useState(false);
  const route = plan.routes[sel];
  const fastest = plan.routes.find((r) => r.isFastest) ?? plan.routes[0];
  const cardW = width - SCREEN_PAD * 2 - 32;
  const reduced = useMotionReduced();

  // The lines draw themselves along their paths when the results arrive (about 0.8 s, once).
  const [drawn, setDrawn] = useState(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 800);
      setDrawn(1 - (1 - p) ** 3);
      if (p >= 1) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [reduced, plan]);
  const line = (r: RouteResult) => {
    const all = r.geometry.coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
    return drawn >= 1 ? all : all.slice(0, Math.max(2, Math.round(all.length * drawn)));
  };

  const fit = (only?: RouteResult) => {
    const coords = (only ? only.geometry.coordinates : plan.routes.flatMap((r) => r.geometry.coordinates)).filter((_, i) => i % 5 === 0).map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
    map.current?.fitToCoordinates(coords, { edgePadding: { top: 40, bottom: 40, left: 40, right: 40 }, animated: true });
  };
  const pick = (i: number) => {
    if (i === sel || i < 0 || i >= plan.routes.length) return;
    haptic.select();
    setSel(i);
    fit(plan.routes[i]);
  };
  // Swiping the cards moves the map to the card that settles in view.
  const onCardsSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => pick(Math.round((e.nativeEvent.contentOffset.x + SCREEN_PAD) / (cardW + space.m)));

  if (!plan.routes.length) return <Notice title="No route found." detail="Try a different destination, or follow officials’ evacuation routes." />;

  const share = () =>
    Share.share({
      message: `Lower-exposure route from ${start.label} to ${dest.label}: ${fmtMin(route.duration_s)}, ${fmtMi(route.distance_m)}. Open in Google Maps: ${googleMapsLink(start.point, dest.point)} (Google Maps doesn’t avoid our hazard areas.) ${SAFETY}`,
    });

  return (
    <Animated.View entering={FadeIn.duration(duration.fast)} style={{ gap: space.l }}>
      {plan.provider === 'osrm-fallback' ? <Banner kind="stale" title="This route does not avoid hazard areas." detail="Our main routing service is unavailable, so this comes from a backup that can’t see warnings." /> : null}
      {plan.notices.filter((n) => plan.provider !== 'osrm-fallback' || !n.startsWith('This route does not')).map((n) => (
        <Banner key={n} kind="info" title={n} />
      ))}
      {plan.cannotAvoid.length ? <Banner kind="stale" title="Some warning areas couldn’t be avoided." detail={plan.cannotAvoid.join(', ')} /> : null}

      <View style={[s.map, { borderColor: c.hairline }]}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          onMapReady={() => fit()}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          customMapStyle={Platform.OS === 'android' ? (isDark ? googleDark : googleLight) : undefined}
          userInterfaceStyle={isDark ? 'dark' : 'light'}
          rotateEnabled={false}
          pitchEnabled={false}
          accessibilityLabel="Map of the planned routes. The route cards and steps below describe the same routes."
        >
          {avoidPolys.map((poly, i) => (
            <Polygon key={`a${i}`} coordinates={poly[0].map(([lon, lat]) => ({ latitude: lat, longitude: lon }))} fillColor={c.levels[3].fg + '22'} strokeColor={c.levels[3].fg} strokeWidth={1.5} />
          ))}
          {plan.routes.map((r, i) =>
            i === sel ? null : <Polyline key={r.id} coordinates={line(r)} strokeColor={withAlpha(c.inkFaint, 0.55)} strokeWidth={4} tappable onPress={() => pick(i)} />,
          )}
          {/* The chosen route: a soft wide glow under a crisp line. */}
          <Polyline key={`glow-${route.id}`} coordinates={line(route)} strokeColor={withAlpha(scene[0].accent, 0.28)} strokeWidth={14} zIndex={9} />
          <Polyline key={`sel-${route.id}`} coordinates={line(route)} strokeColor={scene[0].accent} strokeWidth={5} zIndex={10} />
          <Marker coordinate={{ latitude: start.point[1], longitude: start.point[0] }} title="Start" pinColor="blue" />
          <Marker coordinate={{ latitude: dest.point[1], longitude: dest.point[0] }} title={dest.label} />
        </MapView>
      </View>

      <ScrollView horizontal snapToInterval={cardW + space.m} decelerationRate="fast" showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onCardsSettle} contentContainerStyle={{ gap: space.m, paddingRight: space.l }} style={{ marginHorizontal: -SCREEN_PAD }} contentInset={{ left: SCREEN_PAD }} contentOffset={{ x: -SCREEN_PAD, y: 0 }}>
        {Platform.OS === 'android' ? <View style={{ width: SCREEN_PAD - space.m }} /> : null}
        {plan.routes.map((r, i) => (
          <RouteCard key={r.id} r={r} index={i} width={cardW} selected={i === sel} extra={r.duration_s - fastest.duration_s} onPress={() => pick(i)} />
        ))}
      </ScrollView>

      <Txt variant="footnote">{`Planned ${relativeTime(plan.planned_at)} · alerts, shelters and reports as of then · routing by ${plan.provider === 'ors' ? 'OpenRouteService' : 'OSRM (backup)'}`}</Txt>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        <Button label="Google Maps" icon="ExternalLink" compact onPress={() => Linking.openURL(googleMapsLink(start.point, dest.point))} />
        <Button label="Apple Maps" icon="ExternalLink" compact onPress={() => Linking.openURL(appleMapsLink(start.point, dest.point))} />
        <Button label="Share" icon="Share2" compact onPress={share} />
      </View>
      <Txt variant="footnote">Google Maps and Apple Maps don’t know about our warning areas and may pick a different road.</Txt>

      <Card style={{ paddingVertical: 0 }}>
        <Pressable onPress={() => setShowSteps(!showSteps)} accessibilityRole="button" accessibilityState={{ expanded: showSteps }}>
          <View style={s.stepsHead}>
            <Txt variant="headline" style={{ flex: 1 }}>{`Turn-by-turn steps (${route.steps.length})`}</Txt>
            <Icon name={showSteps ? 'ChevronDown' : 'ChevronRight'} tint={c.inkMuted} />
          </View>
        </Pressable>
        {showSteps
          ? route.steps.map((st, i) => (
              <View key={i} style={[s.step, { borderTopColor: c.hairline }]}>
                <Txt variant="footnote" style={{ width: 24, fontVariant: ['tabular-nums'] }}>{`${i + 1}.`}</Txt>
                <Txt variant="callout" style={{ flex: 1 }}>{st.instruction}</Txt>
                {st.distance_m > 0 ? <Txt variant="footnote" style={{ fontVariant: ['tabular-nums'] }}>{fmtMi(st.distance_m)}</Txt> : null}
              </View>
            ))
          : null}
      </Card>
    </Animated.View>
  );
}

function RouteCard({ r, index, width, selected, extra, onPress }: { r: RouteResult; index: number; width: number; selected: boolean; extra: number; onPress: () => void }) {
  const { c } = useTheme();
  const tag = r.isLowestExposure ? 'Lower-exposure route' : r.isFastest ? 'Fastest route' : 'Alternative';
  const rows: [string, string, boolean][] = [
    ['Active warning areas entered', String(r.alert_area_intersections), r.alert_area_intersections > 0],
    ['Miles inside warning areas', r.miles_in_warning.toFixed(1), r.miles_in_warning > 0],
    ['FEMA flood-zone crossings', r.flood_zone_crossings === null ? 'Unknown' : String(r.flood_zone_crossings), (r.flood_zone_crossings ?? 0) > 0],
    ['Low dips (water can collect)', r.low_dips === null ? 'Unknown' : String(r.low_dips), (r.low_dips ?? 0) > 0],
    ['Unverified reports nearby', String(r.nearby_unverified_reports), r.nearby_unverified_reports > 0],
  ];
  return (
    <Animated.View entering={listItemEntering(index)}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${tag}, ${fmtMin(r.duration_s)}, ${fmtMi(r.distance_m)}`} scaleTo={0.98}>
        <View style={[s.card, { width, backgroundColor: c.surface, borderColor: selected ? c.accent : c.hairline, borderWidth: selected ? 2 : 1 }]}>
          <Txt variant="footnote" tone={selected ? 'accent' : 'muted'} style={{ fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {tag}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s }}>
            <Txt variant="numberXL" style={{ fontSize: 40, lineHeight: 44 }}>{fmtMin(r.duration_s)}</Txt>
            <Txt variant="callout" tone="muted">{fmtMi(r.distance_m)}</Txt>
          </View>
          <Txt variant="callout" color={extra > 30 ? c.levels[1].fg : c.inkMuted} style={{ fontFamily: font.semibold }}>
            {extra > 30 ? `+${fmtMin(extra)} vs fastest` : r.isFastest ? 'Fastest of these routes' : 'About the same as the fastest'}
          </Txt>
          <MakeupBar r={r} />
          <View style={{ marginTop: space.s }}>
            {rows.map(([label, value, warn]) => (
              <View key={label} style={[s.row, { borderTopColor: c.hairline }]}>
                <Txt variant="footnote" style={{ flex: 1 }}>{label}</Txt>
                <Txt variant="callout" color={warn ? c.levels[2].fg : c.ink} style={{ fontVariant: ['tabular-nums'], fontFamily: warn ? font.bold : font.medium }}>
                  {value}
                </Txt>
              </View>
            ))}
          </View>
          {r.warnings.map((w) => (
            <View key={w} style={{ flexDirection: 'row', gap: space.xs, marginTop: space.xs }}>
              <Icon name="TriangleAlert" size={16} tint={c.levels[2].fg} />
              <Txt variant="footnote" style={{ flex: 1 }}>{w}</Txt>
            </View>
          ))}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Route makeup: the whole trip as one bar. The red part is the share of miles inside active warning
 * areas (for a lower-exposure route it should be none); amber ticks count FEMA flood-zone crossings.
 * It shows how much, not where: the map shows where.
 */
function MakeupBar({ r }: { r: RouteResult }) {
  const { c } = useTheme();
  const total = r.distance_m / 1609.34 || 1;
  const warn = Math.min(1, r.miles_in_warning / total);
  const crossings = r.flood_zone_crossings ?? 0;
  return (
    <View style={{ gap: space.xs, marginTop: space.s }} accessible accessibilityLabel={`Route makeup: ${warn > 0 ? `${Math.round(warn * 100)} percent inside warning areas` : 'no miles inside warning areas'}, ${r.flood_zone_crossings === null ? 'flood-zone crossings unknown' : `${crossings} flood-zone crossings`}.`}>
      <View style={[s.makeup, { backgroundColor: withAlpha(scene[0].accent, 0.5) }]}>
        {warn > 0 ? <View style={{ width: `${Math.max(4, warn * 100)}%`, backgroundColor: c.levels[3].fg }} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, flexWrap: 'wrap' }}>
        <View style={[s.legendDot, { backgroundColor: warn > 0 ? c.levels[3].fg : scene[0].accent }]} />
        <Txt variant="footnote">{warn > 0 ? `${r.miles_in_warning.toFixed(1)} mi in warning areas` : 'No miles in warning areas'}</Txt>
        <View style={{ flexDirection: 'row', gap: 2, marginLeft: space.xs }}>
          {Array.from({ length: Math.min(crossings, 8) }, (_, i) => (
            <View key={i} style={[s.tick, { backgroundColor: c.levels[1].fg }]} />
          ))}
        </View>
        <Txt variant="footnote">{r.flood_zone_crossings === null ? 'Flood zones unknown' : `${crossings} flood-zone crossing${crossings === 1 ? '' : 's'}`}</Txt>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  makeup: { height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  tick: { width: 3, height: 12, borderRadius: 1.5 },
  call: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.m, minHeight: 32, borderRadius: radius.pill, borderWidth: 1 },
  progress: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, width: '100%', transformOrigin: 'left' },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, borderRadius: radius.md, borderWidth: 1.5, minHeight: 76 },
  optionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  destRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, borderRadius: radius.md, borderWidth: 1 },
  safety: { flexDirection: 'row', alignItems: 'center', gap: space.m, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.l, paddingVertical: space.m },
  input: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.l, borderRadius: radius.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  map: { height: 300, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1 },
  card: { borderRadius: radius.md, padding: space.l, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.xs, borderTopWidth: StyleSheet.hairlineWidth, gap: space.s },
  stepsHead: { flexDirection: 'row', alignItems: 'center', minHeight: tapTarget + 8 },
  step: { flexDirection: 'row', gap: space.s, paddingVertical: space.s, borderTopWidth: StyleSheet.hairlineWidth },
});

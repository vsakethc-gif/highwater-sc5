/**
 * Report tab (brief section 8.7) — tell neighbors about a streetlight out, a flooded road, a downed
 * tree, and more, then get the official place to have it fixed.
 *
 *   New report: 1. what's the problem  2. where (move the map under the pin)  3. details + the
 *   "I'm human" check, then a success check with the official links.
 *   The step's main button ("Use this spot", "Send report") is pinned above the tab bar, so it's always
 *   under your thumb (the Uber pattern), however far the step scrolls.
 *   Downed power line: a full-screen safety notice appears instantly first (30 feet; call 911).
 *   Near me: active reports sorted by distance, with "Still there", "Fixed", and "Flag".
 *
 * Privacy: no name, email, phone, or account. Reports are public, unverified, and NOT sent to any
 * agency. In Scenario Mode, reports stay on this phone and are never sent.
 */
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Linking, Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import Animated, { FadeIn, FadeInRight, ReduceMotion, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import WebView from 'react-native-webview';
import * as Location from 'expo-location';
import { COUNTIES } from '../../../../shared/config';
import { CATEGORIES, categoryInfo, COUNTY_SITES, looksPersonal, MAX_DESCRIPTION, POWER_LINE_DISTANCE_FT, type CategoryInfo, type ReportCategory } from '../../../../shared/reports/categories';
import { addSimulatedReport, fetchReports, reportsAvailable, simulatedReports, submitReport, voteOnReport, type Report } from '../../../../shared/reports/client';
import { byDistance } from '../../../../shared/routing/destinations';
import { countyName, placeFromPoint } from '../../../../shared/places';
import { relativeTime } from '../../../../shared/time';
import { Icon } from '../../components/Icon';
import { googleDark, googleLight } from '../../components/map/mapStyle';
import { Button, Pressable } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/Chips';
import { EmptyState, Notice, Skeleton } from '../../components/ui/Feedback';
import { Card, SectionHeader } from '../../components/ui/Layout';
import { LargeTitleScroll, Screen } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Text';
import { tabBarClearance } from '../../components/TabBar';
import { useAppState } from '../../state';
import { duration, easing, emergencyFade, font, haptic, listItemEntering, radius, sceneInk, SCREEN_PAD, space, spring, tapTarget, type, useTheme } from '../../theme';
import { Platform } from 'react-native';

const TURNSTILE_PAGE = 'https://vsakethc-gif.github.io/highwater-sc5/turnstile.html';
type Step = 'category' | 'where' | 'details' | 'done';
/** The step's main action, shown in the pinned bar. */
type PinnedAction = { label: string; icon?: 'Megaphone' | 'MapPin'; disabled: boolean; loading?: boolean; onPress: () => void };

export default function ReportScreen() {
  const [mode, setMode] = useState<'new' | 'near'>('new');
  const [pin, setPin] = useState<PinnedAction | null>(null);
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  return (
    <Screen>
      <LargeTitleScroll
        title="Report"
        header={
          <View style={{ marginTop: space.s, gap: space.m }}>
            <SegmentedControl label="Report mode" value={mode} onChange={setMode} options={[{ value: 'new', label: 'New report' }, { value: 'near', label: 'Near me' }]} />
          </View>
        }
      >
        {mode === 'new' ? <NewReport onPin={setPin} /> : <NearMe />}
      </LargeTitleScroll>
      {mode === 'new' && pin ? (
        <Animated.View key={pin.label} entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)} style={[s.pinned, { bottom: tabBarClearance(insets.bottom) + space.s, backgroundColor: c.bg }]}>
          <Button label={pin.label} icon={pin.icon} kind="primary" disabled={pin.disabled} loading={pin.loading} onPress={pin.onPress} />
        </Animated.View>
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------- new report

function NewReport({ onPin }: { onPin: (p: PinnedAction | null) => void }) {
  const { c } = useTheme();
  const { place, scenario } = useAppState();
  const [step, setStep] = useState<Step>('category');
  const [category, setCategory] = useState<CategoryInfo | null>(null);
  const [emergency, setEmergency] = useState(false);
  const [spot, setSpot] = useState<{ lat: number; lon: number; fips: string } | null>(null);
  const [note, setNote] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState('');

  const index = { category: 0, where: 1, details: 2, done: 3 }[step];
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming((index + 1) / 4, { duration: duration.base, easing: easing.standard });
  }, [index, progress]);
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  const restart = () => {
    setStep('category');
    setCategory(null);
    setSpot(null);
    setNote('');
    setToken(null);
    setProblem('');
  };

  async function send() {
    if (!category || !spot) return;
    if (note && looksPersonal(note)) return setProblem('Please remove phone numbers and email addresses from the note.');
    setProblem('');
    const report = { category: category.id, lat: Math.round(spot.lat * 1e5) / 1e5, lon: Math.round(spot.lon * 1e5) / 1e5, county_fips: spot.fips, description: note.trim() || null };
    if (scenario) {
      addSimulatedReport(report); // Scenario Mode: kept on this phone only, never sent
      haptic.success();
      setStep('done');
      return;
    }
    if (!token) return setProblem('Please finish the “I’m human” check first.');
    setSending(true);
    try {
      await submitReport(report, token);
      haptic.success();
      setStep('done');
    } catch (e) {
      haptic.error();
      setToken(null);
      setProblem(e instanceof Error ? e.message : 'The report didn’t send. Try again in a moment.');
    } finally {
      setSending(false);
    }
  }

  // The step's main button lives in the pinned bar (see ReportScreen).
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  useEffect(() => {
    if (step === 'where') onPin({ label: 'Use this spot', icon: 'MapPin', disabled: !spot, onPress: () => setStep('details') });
    else if (step === 'details') onPin({ label: 'Send report', icon: 'Megaphone', disabled: !scenario && !token, loading: sending, onPress: () => sendRef.current() });
    else onPin(null);
  }, [step, spot, scenario, token, sending, onPin]);
  useEffect(() => () => onPin(null), [onPin]);

  return (
    <View style={{ marginTop: space.l, paddingBottom: step === 'where' || step === 'details' ? 72 : 0 }}>
      <View style={[s.progress, { backgroundColor: c.surfaceSunken }]} accessible accessibilityLabel={`Step ${Math.min(index + 1, 3)} of 3`}>
        <Animated.View style={[s.progressFill, { backgroundColor: c.accent }, bar]} />
      </View>
      <Pressable onPress={() => Linking.openURL('tel:911')} accessibilityRole="button" accessibilityLabel="Call 911" style={{ alignSelf: 'flex-start' }}>
        <View style={s.call911}>
          <Icon name="Phone" size={16} tint={c.levels[3].fg} />
          <Txt variant="footnote" color={c.levels[3].fg} style={{ fontFamily: font.bold }}>
            If anyone is in danger, call 911 first
          </Txt>
        </View>
      </Pressable>

      {step === 'category' ? (
        <Animated.View key="category" entering={FadeInRight.duration(240).easing(easing.standard).reduceMotion(ReduceMotion.System)}>
          <Txt variant="title3" style={{ marginBottom: space.m }} accessibilityRole="header">
            What’s the problem?
          </Txt>
          <View style={s.grid}>
            {CATEGORIES.map((cat, i) => (
              <CategoryTile
                key={cat.id}
                cat={cat}
                index={i}
                selected={category?.id === cat.id}
                onPress={() => {
                  setCategory(cat);
                  if (cat.emergency) setEmergency(true);
                  else setTimeout(() => setStep('where'), 160);
                }}
              />
            ))}
          </View>
          <Txt variant="footnote" style={{ marginTop: space.l }}>
            Public · unverified · not sent to the county
          </Txt>
        </Animated.View>
      ) : null}

      {step === 'where' && category ? (
        <Animated.View key="where" entering={FadeInRight.duration(240).easing(easing.standard).reduceMotion(ReduceMotion.System)} style={{ gap: space.m }}>
          <StepHeader title="Where is it?" detail="Move the map under the pin." onBack={() => setStep('category')} />
          <PinMap
            start={place.kind === 'point' ? { lat: place.lat, lon: place.lon } : (() => { const seat = COUNTIES.find((k) => k.fips === place.fips)!.seat; return { lat: seat.lat, lon: seat.lon }; })()}
            onSpot={setSpot}
          />
          {!spot ? <Txt variant="footnote">The spot must be inside one of the 8 SC-5 counties.</Txt> : null}
        </Animated.View>
      ) : null}

      {step === 'details' && category && spot ? (
        <Animated.View key="details" entering={FadeInRight.duration(240).easing(easing.standard).reduceMotion(ReduceMotion.System)} style={{ gap: space.m }}>
          <StepHeader title="Anything to add?" detail={`${category.label} · ${countyName(spot.fips)} County`} onBack={() => setStep('where')} />
          <View style={[s.noteBox, { backgroundColor: c.surface, borderColor: c.hairline }]}>
            <TextInput
              value={note}
              onChangeText={(t) => setNote(t.slice(0, MAX_DESCRIPTION))}
              placeholder="Optional short note, like “water over the road near the bridge”"
              placeholderTextColor={c.inkFaint}
              multiline
              maxLength={MAX_DESCRIPTION}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
              accessibilityLabel="Optional note"
              style={[type.body, { color: c.ink, minHeight: 88, textAlignVertical: 'top' }]}
            />
            <Txt variant="footnote" style={{ textAlign: 'right' }}>{`${note.length}/${MAX_DESCRIPTION}`}</Txt>
          </View>
          <Txt variant="footnote" accessibilityLabel="Don’t include names, phone numbers, or other personal info.">No names or phone numbers, please.</Txt>
          {scenario ? (
            <Notice tone="info" icon="FlaskConical" title="Scenario Mode is on." detail="This report stays on your phone and isn’t sent anywhere." />
          ) : reportsAvailable() ? (
            <HumanCheck onToken={setToken} />
          ) : (
            <Notice title="Reports can’t be sent right now." detail="If something is dangerous, call 911." />
          )}
          {problem ? (
            <Animated.View entering={FadeIn.duration(duration.fast)}>
              <Notice title="Not sent yet" detail={problem} />
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}

      {step === 'done' && category && spot ? <Success category={category} fips={spot.fips} simulated={!!scenario} onAnother={restart} /> : null}

      <PowerLineNotice
        open={emergency}
        onAddToMap={() => {
          setEmergency(false);
          setStep('where');
        }}
        onClose={() => {
          setEmergency(false);
          setCategory(null);
        }}
      />
    </View>
  );
}

function StepHeader({ title, detail, onBack }: { title: string; detail?: string; onBack: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={{ alignSelf: 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: tapTarget }}>
          <Icon name="ChevronLeft" size={18} tint={c.accent} />
          <Txt variant="callout" tone="accent">
            Back
          </Txt>
        </View>
      </Pressable>
      <Txt variant="title3" accessibilityRole="header">
        {title}
      </Txt>
      {detail ? <Txt variant="callout" tone="muted">{detail}</Txt> : null}
    </View>
  );
}

function CategoryTile({ cat, index, selected, onPress }: { cat: CategoryInfo; index: number; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const bounce = useSharedValue(1);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: bounce.value }] }));
  const danger = cat.emergency;
  return (
    <Animated.View entering={listItemEntering(index)} style={s.tileWrap}>
      <Pressable
        onPress={() => {
          haptic.select();
          bounce.value = withSpring(1.15, spring.snappy, () => {
            bounce.value = withSpring(1, spring.snappy);
          });
          onPress();
        }}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={cat.label}
        scaleTo={0.96}
      >
        <View style={[s.tile, { backgroundColor: selected ? c.accentSoft : c.surface, borderColor: selected ? c.accent : danger ? c.levels[3].fg : c.hairline }]}>
          <Animated.View style={[s.tileIcon, { backgroundColor: danger ? c.levels[3].bg : selected ? c.accent : c.surfaceRaised }, iconStyle]}>
            <Icon name={cat.icon} size={22} tint={danger ? c.levels[3].fg : selected ? c.onAccent : c.ink} />
          </Animated.View>
          <Txt variant="headline" tone="ink" numberOfLines={2}>
            {cat.label}
          </Txt>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** The map moves under a fixed pin; the pin lifts while you drag and drops when you let go. */
function PinMap({ start, onSpot }: { start: { lat: number; lon: number }; onSpot: (s: { lat: number; lon: number; fips: string } | null) => void }) {
  const { c, isDark } = useTheme();
  const map = useRef<ComponentRef<typeof MapView>>(null);
  const lift = useSharedValue(0);
  const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -10 * lift.value }] }));
  const shadowStyle = useAnimatedStyle(() => ({ opacity: 0.25 + 0.2 * (1 - lift.value), transform: [{ scale: 1 - 0.3 * lift.value }] }));
  const [label, setLabel] = useState('');

  const settle = async (r: Region) => {
    lift.value = withSpring(0, spring.pop);
    const result = await placeFromPoint(r.latitude, r.longitude, 'Report spot');
    if (typeof result === 'string') {
      onSpot(null);
      setLabel('Outside the 8 SC-5 counties');
    } else {
      onSpot({ lat: r.latitude, lon: r.longitude, fips: result.fips });
      setLabel(`${countyName(result.fips)} County · ${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`);
    }
  };

  useEffect(() => {
    settle({ latitude: start.lat, longitude: start.lon, latitudeDelta: 0.02, longitudeDelta: 0.02 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMine = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return setLabel('Location is off. Move the map to the spot instead.');
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    map.current?.animateToRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }, duration.slow);
  };

  return (
    <View style={{ gap: space.s }}>
      <View style={[s.pinMap, { borderColor: c.hairline }]}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={{ latitude: start.lat, longitude: start.lon, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          customMapStyle={Platform.OS === 'android' ? (isDark ? googleDark : googleLight) : undefined}
          userInterfaceStyle={isDark ? 'dark' : 'light'}
          showsUserLocation
          rotateEnabled={false}
          pitchEnabled={false}
          onRegionChange={() => {
            lift.value = withSpring(1, spring.snappy);
          }}
          onRegionChangeComplete={settle}
        />
        {label ? (
          <Animated.View key={label} entering={FadeIn.duration(duration.fast)} style={[s.placePill, { backgroundColor: c.surface, borderColor: c.hairline }]} pointerEvents="none">
            <Icon name="MapPin" size={14} tint={c.accent} />
            <Txt variant="footnote" color={c.ink} numberOfLines={1} style={{ fontFamily: font.semibold }}>
              {label}
            </Txt>
          </Animated.View>
        ) : null}
        <View style={s.pinCenter} pointerEvents="none">
          <Animated.View style={[s.pinShadow, shadowStyle]} />
          <Animated.View style={[{ position: 'absolute', bottom: 22 }, pinStyle]}>
            <Svg width={30} height={40} viewBox="0 0 30 40">
              <Path d="M15 1C7.3 1 1 7.2 1 14.9 1 25 15 39 15 39s14-14 14-24.1C29 7.2 22.7 1 15 1z" fill={c.accent} />
              <Circle cx={15} cy={15} r={5} fill={c.onAccent} />
            </Svg>
          </Animated.View>
        </View>
      </View>
      <Txt variant="footnote" accessibilityLiveRegion="polite" style={{ position: 'absolute', opacity: 0 }}>{label}</Txt>
      <Button label="Use my location" icon="LocateFixed" onPress={useMine} compact style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}

/** The Cloudflare "I'm human" check, from a tiny page on our website (Turnstile has no native version). */
function HumanCheck({ onToken }: { onToken: (t: string | null) => void }) {
  const { c, isDark } = useTheme();
  const [state, setState] = useState<'loading' | 'ready' | 'passed' | 'error'>('loading');
  return (
    <View style={[s.check, { borderColor: c.hairline, backgroundColor: c.surface }]}>
      <Txt variant="footnote">{state === 'passed' ? 'Check passed. You can send the report.' : 'A quick check that you’re a person, not a spam bot.'}</Txt>
      <View style={{ height: 72, marginTop: space.s }}>
        {state === 'loading' ? <Skeleton height={64} /> : null}
        <WebView
          source={{ uri: `${TURNSTILE_PAGE}?theme=${isDark ? 'dark' : 'light'}` }}
          style={{ backgroundColor: 'transparent', opacity: state === 'loading' ? 0 : 1 }}
          scrollEnabled={false}
          onLoadEnd={() => setState((x) => (x === 'loading' ? 'ready' : x))}
          onError={() => setState('error')}
          onMessage={(e) => {
            try {
              const msg = JSON.parse(e.nativeEvent.data) as { type: string; token?: string };
              if (msg.type === 'token' && msg.token) {
                setState('passed');
                onToken(msg.token);
              } else {
                setState(msg.type === 'error' ? 'error' : 'ready');
                onToken(null);
              }
            } catch {
              /* ignore anything that isn't our message */
            }
          }}
        />
      </View>
      {state === 'error' ? <Txt variant="footnote" color={c.levels[2].fg}>The check didn’t load. Check your connection. VPNs and some privacy settings can block it.</Txt> : null}
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The success check: a circle draws itself, then the check mark; followed by the official links. */
function Success({ category, fips, simulated, onAnother }: { category: CategoryInfo; fips: string; simulated: boolean; onAnother: () => void }) {
  const { c } = useTheme();
  const ring = useSharedValue(0);
  const tick = useSharedValue(0);
  useEffect(() => {
    ring.value = withTiming(1, { duration: duration.slow, easing: easing.emphasized });
    tick.value = withTiming(1, { duration: duration.base + 120, easing: easing.emphasized });
  }, [ring, tick]);
  const CIRC = 2 * Math.PI * 30;
  const TICK = 40;
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - ring.value) }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: TICK * (1 - Math.max(0, tick.value * 1.4 - 0.4)) }));
  return (
    <Animated.View entering={FadeIn.duration(duration.base)} style={{ gap: space.l }}>
      <View style={{ alignItems: 'center', marginTop: space.l }}>
        <Svg width={120} height={120} viewBox="0 0 72 72">
          <AnimatedCircle cx={36} cy={36} r={30} stroke={c.levels[0].fg} strokeWidth={3} fill="none" strokeDasharray={[CIRC, CIRC]} animatedProps={ringProps} strokeLinecap="round" rotation={-90} origin="36, 36" />
          <AnimatedPath d="M23 37 l9 9 l17 -19" stroke={c.levels[0].fg} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[TICK, TICK]} animatedProps={tickProps} />
        </Svg>
      </View>
      <Txt variant="title2" style={{ textAlign: 'center' }} accessibilityRole="header">
        {simulated ? 'Saved on this phone (simulation)' : 'Sent. Shown as unverified.'}
      </Txt>
      <Txt variant="callout" tone="muted" style={{ textAlign: 'center' }}>
        {simulated ? 'Nothing was sent.' : 'Not sent to the county. To get it fixed:'}
      </Txt>
      <Card style={{ paddingVertical: space.xs }}>
        {category.channels.map((ch, i) => {
          const url = ch.url ?? (ch.label.startsWith('Your county') ? COUNTY_SITES[fips] : undefined);
          return (
            <View key={ch.label} style={[s.channel, i < category.channels.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairline }]}>
              <Txt variant="headline">{ch.label.startsWith('Your county') ? `${countyName(fips)} County website` : ch.label}</Txt>
              {ch.note ? <Txt variant="footnote">{ch.note}</Txt> : null}
              <View style={{ flexDirection: 'row', gap: space.s, marginTop: space.xs }}>
                {url ? <Button label="Open" icon="ExternalLink" compact onPress={() => Linking.openURL(url)} /> : null}
                {ch.phone ? <Button label={ch.phone} icon="Phone" compact onPress={() => Linking.openURL(`tel:${ch.phone!.replace(/\D/g, '')}`)} /> : null}
              </View>
            </View>
          );
        })}
      </Card>
      <Button label="Report something else" onPress={onAnother} />
    </Animated.View>
  );
}

/** Downed power line: full-screen safety notice, shown instantly (no entrance delay). */
function PowerLineNotice({ open, onAddToMap, onClose }: { open: boolean; onAddToMap: () => void; onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={emergencyFade} style={[s.emergency, { backgroundColor: c.levels[3].bg, paddingTop: insets.top + space.x3, paddingBottom: insets.bottom + space.l }]} accessibilityViewIsModal>
        <Icon name="Zap" size={44} tint={c.levels[3].fg} />
        <Txt variant="serifTitle" color={c.levels[3].fg} accessibilityRole="alert">
          {`Stay at least ${POWER_LINE_DISTANCE_FT} feet away.`}
        </Txt>
        <Txt variant="body" color={c.ink}>
          Treat every downed line as live. Don’t touch it or anything it’s touching, including water. If a line falls on your car, stay inside and call 911.
        </Txt>
        <Button label="Call 911" icon="Phone" kind="danger" onPress={() => Linking.openURL('tel:911')} />
        <Button label="Duke Energy 800-769-3766" icon="Phone" onPress={() => Linking.openURL('tel:8007693766')} />
        <Button label="Dominion Energy 888-333-4465" icon="Phone" onPress={() => Linking.openURL('tel:8883334465')} />
        <Txt variant="footnote" color={c.ink}>
          Power from a cooperative or your city? Call the number on your power bill. Sources: Duke Energy and Dominion Energy SC safety guidance.
        </Txt>
        <View style={{ flex: 1 }} />
        <Button label="Also add it to the map" kind="text" onPress={onAddToMap} />
        <Button label="Close" kind="text" onPress={onClose} />
      </Animated.View>
    </Modal>
  );
}

// ---------------------------------------------------------------- near me

function NearMe() {
  const { c } = useTheme();
  const { place, scenario } = useAppState();
  const [reports, setReports] = useState<Report[] | Error | null>(null);
  const [voted, setVoted] = useState<Record<string, string>>({});
  const from = useMemo(() => {
    if (place.kind === 'point') return [place.lon, place.lat] as [number, number];
    const seat = COUNTIES.find((k) => k.fips === place.fips)!.seat;
    return [seat.lon, seat.lat] as [number, number];
  }, [place]);

  useEffect(() => {
    setReports(null);
    (scenario ? Promise.resolve(simulatedReports()) : reportsAvailable() ? fetchReports() : Promise.resolve([]))
      .then(setReports)
      .catch((e: Error) => setReports(e));
  }, [scenario]);

  const vote = async (r: Report, kind: 'confirm' | 'fixed' | 'flag') => {
    if (scenario) return setVoted({ ...voted, [r.id]: 'Simulation: votes aren’t sent.' });
    try {
      const result = await voteOnReport(r.id, kind);
      haptic.success();
      setVoted({ ...voted, [r.id]: result === 'already_voted' ? 'You already did that for this report.' : kind === 'confirm' ? 'Thanks. Marked as still there.' : kind === 'fixed' ? 'Thanks. Marked as fixed.' : 'Thanks. It will be reviewed.' });
    } catch {
      haptic.error();
      setVoted({ ...voted, [r.id]: 'That didn’t go through. Try again.' });
    }
  };

  if (reports === null) {
    return (
      <View style={{ gap: space.m, marginTop: space.l }}>
        <Skeleton height={96} />
        <Skeleton height={96} />
      </View>
    );
  }
  if (reports instanceof Error) {
    return (
      <View style={{ marginTop: space.l }}>
        <Notice title="Reports can’t load right now." detail="If something is dangerous, call 911." />
      </View>
    );
  }
  const sorted = byDistance(reports, from);
  if (!sorted.length) {
    return <EmptyState title="No active community reports nearby." detail="Flooded-road reports disappear after 48 hours, others after 30 days, unless someone taps “Still there.”" />;
  }
  return (
    <View style={{ marginTop: space.l, gap: space.m }}>
      <SectionHeader title={`${sorted.length} active report${sorted.length > 1 ? 's' : ''} · nearest first`} />
      {sorted.map((r, i) => {
        const cat = categoryInfo(r.category);
        return (
          <Animated.View key={r.id} entering={listItemEntering(i)}>
            <Card style={{ gap: space.s }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                <View style={[s.reportIcon, { backgroundColor: c.levels[1].bg }]}>
                  <Icon name={cat.icon} tint={c.levels[1].fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="headline">{cat.label}</Txt>
                  <Txt variant="footnote">{`${r.km < 1 ? `${Math.round(r.km * 1000)} m` : `${(r.km / 1.609).toFixed(1)} mi`} away · ${relativeTime(r.created_at)} · unverified${r.confirm_count ? ` · ${r.confirm_count} said still there` : ''}`}</Txt>
                </View>
              </View>
              {r.description ? <Txt variant="callout" tone="muted">{r.description}</Txt> : null}
              {voted[r.id] ? (
                <Txt variant="footnote" tone="accent">{voted[r.id]}</Txt>
              ) : (
                <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
                  <Button label="Still there" compact onPress={() => vote(r, 'confirm')} />
                  <Button label="Fixed" compact onPress={() => vote(r, 'fixed')} />
                  <Button label="Flag" kind="text" compact onPress={() => vote(r, 'flag')} hint="Flag as inappropriate" />
                </View>
              )}
            </Card>
          </Animated.View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  pinned: { position: 'absolute', left: SCREEN_PAD, right: SCREEN_PAD, paddingTop: space.s, borderRadius: radius.md },
  progress: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: space.s },
  progressFill: { height: 4, width: '100%', transformOrigin: 'left' },
  call911: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: tapTarget },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xs },
  tileWrap: { width: '50%', padding: space.xs },
  tile: { minHeight: 96, borderRadius: radius.lg, borderWidth: 1, justifyContent: 'space-between', gap: space.m, padding: space.l, borderCurve: 'continuous' },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pinMap: { height: 340, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1 },
  placePill: { position: 'absolute', top: space.m, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: space.xs, maxWidth: '88%', paddingHorizontal: space.m, paddingVertical: space.s, borderRadius: radius.pill, borderWidth: 1 },
  pinCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pinShadow: { width: 16, height: 6, borderRadius: 3, backgroundColor: sceneInk.shade, marginTop: 2 },
  noteBox: { borderWidth: 1, borderRadius: radius.md, padding: space.m },
  check: { borderWidth: 1, borderRadius: radius.md, padding: space.m },
  channel: { paddingVertical: space.m, gap: 2 },
  emergency: { flex: 1, paddingHorizontal: SCREEN_PAD, gap: space.l },
  reportIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});

export type { ReportCategory };

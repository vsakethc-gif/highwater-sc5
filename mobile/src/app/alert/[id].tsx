/**
 * alert/[id].tsx — one official alert, laid out like the phone's own severe weather alerts
 * (REDESIGN.md 5.3): urgent but calm.
 *
 *   - A bold header band in the alert level's colors (the same atmosphere as the Status scene), with
 *     the hazard icon and the event name ("Flood Warning"), and a time bar showing how far through
 *     the alert we are (started → now → ends).
 *   - "In plain words" first (from our rules), then "What to do" (the same steps as Status), then the
 *     official National Weather Service text, folded away until you open it, then the official link.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { classifyAlert } from '../../../../shared/hazards/alertMap';
import { HAZARDS } from '../../../../shared/hazards/hazards';
import { LEVELS } from '../../../../shared/hazards/levels';
import { countyName } from '../../../../shared/places';
import { clockTime, dateTime, relativeTime } from '../../../../shared/time';
import { Icon } from '../../components/Icon';
import { Glass, moduleEntering } from '../../components/status/Module';
import { Pressable } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Chips';
import { EmptyState } from '../../components/ui/Feedback';
import { Txt } from '../../components/ui/Text';
import { stepVisual } from '../../components/status/steps';
import { latestStatus } from '../../hooks/useStatus';
import { duration, easing, font, radius, scene, sceneInk, ScenePaletteProvider, SCREEN_PAD, space, tapTarget } from '../../theme';

const OFFICIAL = 'https://www.weather.gov/alerts';

/** A time both ways, relative then exact: "in 2 hours · Thu, Oct 22, 8:00 PM". */
function both(iso: string): string {
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (minutes <= 0) return `${relativeTime(iso)} · ${dateTime(iso)}`;
  const rel = minutes < 60 ? `in ${minutes} min` : minutes < 48 * 60 ? `in ${Math.round(minutes / 60)} hours` : `in ${Math.round(minutes / 1440)} days`;
  return `${rel} · ${dateTime(iso)}`;
}

/** "2:10 PM" today, "Sat, Oct 17, 2:10 PM" on another day. */
const when = (iso: string) => (new Date(iso).toDateString() === new Date().toDateString() ? clockTime(iso) : dateTime(iso));

export default function AlertDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const data = latestStatus();
  const a = data && !(data.c.alerts instanceof Error) ? data.c.alerts.data.find((x) => x.id === id) : undefined;
  const rule = a ? classifyAlert(a) : null;
  const key = rule ? rule.level : 'unknown';
  const block = rule && data ? data.blocks.find((b) => b.hazard === rule.hazard) : undefined;
  const [showText, setShowText] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  return (
    <ScenePaletteProvider sceneKey={key}>
      <View style={{ flex: 1, backgroundColor: scene[key].bottom }}>
        <StatusBar style="light" />
        <LinearGradient colors={[scene[key].top, scene[key].bottom]} locations={[0, 0.55]} style={StyleSheet.absoluteFill} />
        <View style={[s.top, { paddingTop: insets.top + space.xs }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" scaleTo={0.95}>
            <Glass floating rounded={tapTarget / 2} style={s.back}>
              <Icon name="ChevronLeft" size={22} tint={sceneInk.primary} />
            </Glass>
          </Pressable>
        </View>
        {!a || !rule ? (
          <View style={{ padding: SCREEN_PAD }}>
            <EmptyState title="This alert isn’t loaded right now." detail="It may have ended. Go back and pull down to refresh." action="Back" onAction={() => router.back()} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN_PAD, paddingBottom: insets.bottom + space.x5, gap: space.l }}>
            {/* Header band: icon, level, event name, time bar. Appears at once: emergency info never waits. */}
            <Animated.View entering={rule.level === 3 ? undefined : FadeIn.duration(duration.fast)} style={s.band}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                <View style={[s.icon, { borderColor: scene[rule.level].accent }]}>
                  <Icon name={HAZARDS[rule.hazard].icon} size={28} tint={scene[rule.level].accent} />
                </View>
                <StatusBadge level={rule.level} />
                {data?.c.simulated ? (
                  <View style={s.sim}>
                    <Icon name="FlaskConical" size={12} tint={sceneInk.sim} />
                    <Txt variant="caption" color={sceneInk.sim}>
                      Simulated
                    </Txt>
                  </View>
                ) : null}
              </View>
              <Txt variant="sceneWord" color={sceneInk.primary} style={{ fontSize: 40, lineHeight: 44, letterSpacing: -0.6 }} accessibilityRole="header">
                {a.event}
              </Txt>
              <TimeBar start={a.onset ?? a.sent} end={a.ends} color={scene[rule.level].accent} />
            </Animated.View>

            <Animated.View entering={moduleEntering(1, rule.level === 3)}>
              <Glass style={s.module}>
                <Txt variant="moduleLabel" color={sceneInk.meta}>
                  In plain words
                </Txt>
                <Txt variant="headline" accessibilityLabel={`This is a ${LEVELS[rule.level].name}-level ${HAZARDS[rule.hazard].label.toLowerCase()} alert from the National Weather Service. ${LEVELS[rule.level].meaning}${a.onset ? ` Starts ${both(a.onset)}.` : ''}${a.ends ? ` Ends ${both(a.ends)}.` : ''}`}>
                  {LEVELS[rule.level].meaning}
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessible accessibilityLabel={`Counties: ${a.county_fips.map((f) => countyName(f)).filter((n) => n !== 'Unknown').join(', ') || 'see the official alert'}`}>
                  {a.county_fips.map((f) => countyName(f)).filter((n) => n !== 'Unknown').map((n) => (
                    <View key={n} style={s.county}>
                      <Icon name="MapPin" size={13} tint={sceneInk.secondary} />
                      <Txt variant="footnote" color={sceneInk.primary}>{n}</Txt>
                    </View>
                  ))}
                </View>
              </Glass>
            </Animated.View>

            {block && block.doNow.length ? (
              <Animated.View entering={moduleEntering(2, rule.level === 3)}>
                <Glass style={s.module}>
                  <Txt variant="moduleLabel" color={sceneInk.meta}>
                    What to do
                  </Txt>
                  {block.doNow.slice(0, 3).map((step) => {
                    const v = stepVisual(step);
                    return (
                      <View key={step} style={s.step} accessible accessibilityLabel={step}>
                        <View style={[s.stepNum, { borderColor: scene[rule.level].accent }]}>
                          <Icon name={v.icon} size={15} tint={scene[rule.level].accent} />
                        </View>
                        <Txt variant="headline" style={{ flex: 1 }}>{v.label}</Txt>
                      </View>
                    );
                  })}
                </Glass>
              </Animated.View>
            ) : null}

            <Animated.View entering={moduleEntering(3, rule.level === 3)}>
              <Glass style={s.module}>
                <Txt variant="moduleLabel" color={sceneInk.meta}>
                  Official text
                </Txt>
                <Txt variant="callout">{a.headline}</Txt>
                <Expander label={showText ? 'Hide the full description' : 'Read the full description'} open={showText} onToggle={() => setShowText(!showText)} />
                {showText ? (
                  <Animated.View entering={FadeIn.duration(duration.base).reduceMotion(ReduceMotion.System)}>
                    <Txt variant="callout" tone="muted">{a.description}</Txt>
                  </Animated.View>
                ) : null}
                {a.instruction ? (
                  <>
                    <Expander label={showSteps ? 'Hide what NWS says to do' : 'What NWS says to do'} open={showSteps} onToggle={() => setShowSteps(!showSteps)} />
                    {showSteps ? (
                      <Animated.View entering={FadeIn.duration(duration.base).reduceMotion(ReduceMotion.System)}>
                        <Txt variant="callout" tone="muted">{a.instruction}</Txt>
                      </Animated.View>
                    ) : null}
                  </>
                ) : null}
              </Glass>
            </Animated.View>

            <Pressable onPress={() => Linking.openURL(OFFICIAL)} accessibilityRole="link" accessibilityLabel="View the official alert at weather.gov" accessibilityHint="Opens in your browser">
              <View style={[s.official, { backgroundColor: sceneInk.primary }]}>
                <Txt variant="headline" color={scene[key].bottom}>
                  View official alert
                </Txt>
                <Icon name="ExternalLink" size={18} tint={scene[key].bottom} />
              </View>
            </Pressable>
            <Txt variant="footnote">Not an official warning system. Follow instructions from local officials. In an emergency, call 911.</Txt>
          </ScrollView>
        )}
      </View>
    </ScenePaletteProvider>
  );
}

/** Flighty-style progress through the alert: a bar from start to end, filled to now, with a dot at now. */
function TimeBar({ start, end, color }: { start: string; end: string | null; color: string }) {
  const s0 = Date.parse(start);
  const e0 = end ? Date.parse(end) : null;
  const share = e0 && e0 > s0 ? Math.max(0, Math.min(1, (Date.now() - s0) / (e0 - s0))) : null;
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.set(withTiming(1, { duration: 450, easing: easing.emphasized }));
  }, [grow]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.get() * (share ?? 0) }] }));
  const begun = Date.now() >= s0;
  return (
    <View style={{ gap: space.s }}>
      {share !== null ? (
        <View style={s.track} accessibilityElementsHidden>
          <Animated.View style={[s.fill, { backgroundColor: color }, fill]} />
          <View style={[s.nowDot, { left: `${share * 100}%`, backgroundColor: color }]} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Txt variant="footnote" color={sceneInk.secondary}>{`${begun ? 'Started' : 'Starts'} ${when(start)}`}</Txt>
        <Txt variant="footnote" color={sceneInk.secondary}>{end ? `Ends ${when(end)}` : 'No end time given'}</Txt>
      </View>
    </View>
  );
}

function Expander({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.set(withTiming(open ? 1 : 0, { duration: 200, easing: easing.standard }));
  }, [open, turn]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 180}deg` }] }));
  return (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={label} scaleTo={0.99}>
      <View style={s.expander}>
        <Txt variant="headline" tone="accent">
          {label}
        </Txt>
        <Animated.View style={chevron}>
          <Icon name="ChevronDown" size={18} tint={sceneInk.secondary} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: space.l, flexDirection: 'row' },
  back: { width: tapTarget, height: tapTarget, alignItems: 'center', justifyContent: 'center' },
  band: { gap: space.l, paddingTop: space.xl, paddingBottom: space.s },
  icon: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  module: { padding: space.l, gap: space.s },
  step: { flexDirection: 'row', gap: space.m, alignItems: 'flex-start', paddingVertical: space.xs },
  county: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.s, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: sceneInk.control },
  stepNum: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  track: { height: 4, borderRadius: radius.pill, backgroundColor: sceneInk.track },
  fill: { height: 4, borderRadius: radius.pill, transformOrigin: 'left center' },
  nowDot: { position: 'absolute', top: -5, width: 14, height: 14, marginLeft: -7, borderRadius: 7, borderWidth: 2, borderColor: sceneInk.primary },
  expander: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  sim: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.s, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: sceneInk.sim },
  official: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s, minHeight: 52, borderRadius: radius.md },
});

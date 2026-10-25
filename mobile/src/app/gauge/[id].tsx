/**
 * gauge/[id].tsx — one river gauge up close, laid out like a stock app (REDESIGN.md 5.1):
 *
 *   - The top is tinted in the gauge's flood color (calm blue, amber, orange, or red), the same
 *     atmosphere as the Status scene, so you feel how serious it is before reading.
 *   - A big number: the water height, counting up to its value when the page opens. Under it, how much
 *     it changed and a pill with its flood category.
 *   - A full-width chart of recent readings. The line is colored by height (teal, then amber at action
 *     stage, orange at flood stage, red at moderate) and draws itself in. Press and drag on it: the big
 *     number and time follow your finger, with a light tick when you cross flood stage. Let go and it
 *     springs back to the latest reading.
 *   - Then three quick facts and what it all means, in plain words.
 * The page plays its entrance again each time you open it.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Gauge, Reading } from '../../../../shared/data/types';
import { feet, gaugeName } from '../../../../shared/format';
import type { Level } from '../../../../shared/hazards/levels';
import { countyName } from '../../../../shared/places';
import { clockTime, dateTime, relativeTime } from '../../../../shared/time';
import { AnimatedNumber } from '../../components/data/Charts';
import { CATEGORY, stageSentence, TREND } from '../../components/data/Rows';
import { ScrubChart } from '../../components/data/ScrubChart';
import { Icon } from '../../components/Icon';
import { Glass, moduleEntering } from '../../components/status/Module';
import { Pressable } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Chips';
import { EmptyState } from '../../components/ui/Feedback';
import { Txt } from '../../components/ui/Text';
import { latestStatus } from '../../hooks/useStatus';
import { duration, easing, font, radius, scene, sceneInk, ScenePaletteProvider, SCREEN_PAD, space, tapTarget, type SceneKey } from '../../theme';

function stats(g: Gauge) {
  const series = g.recent_series;
  if (series.length < 2 || !g.latest) return null;
  const first = series[0];
  const change = g.latest.value - first.value;
  const high = Math.max(...series.map((r) => r.value));
  const hours = Math.max(1, Math.round((Date.parse(g.latest.time) - Date.parse(first.time)) / 3600_000));
  const next = g.stages ? ([['action', 'action stage'], ['minor', 'flood stage'], ['moderate', 'moderate flood'], ['major', 'major flood']] as const).find(([k]) => g.stages![k] !== null && g.latest!.value < (g.stages![k] as number)) : undefined;
  return { change, high, hours, next: next ? { label: next[1], ft: (g.stages![next[0]] as number) - g.latest.value } : null };
}

/** The atmosphere for this gauge: its flood category's level, or the calm scene. */
function gaugeScene(g: Gauge): SceneKey {
  if (!g.latest) return 'unknown';
  return g.flood_category ? (CATEGORY[g.flood_category].level as Level) : 0;
}

export default function GaugeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = latestStatus();
  const g = data && !(data.c.gauges instanceof Error) ? data.c.gauges.data.find((x) => x.site_id === id) : undefined;
  const key: SceneKey = g ? gaugeScene(g) : 'unknown';
  const insets = useSafeAreaInsets();

  return (
    <ScenePaletteProvider sceneKey={key}>
      <View style={{ flex: 1, backgroundColor: scene[key].bottom }}>
        <StatusBar style="light" />
        <LinearGradient colors={[scene[key].top, scene[key].bottom]} locations={[0, 0.6]} style={StyleSheet.absoluteFill} />
        <View style={[s.top, { paddingTop: insets.top + space.xs }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" scaleTo={0.95}>
            <Glass floating rounded={tapTarget / 2} style={s.back}>
              <Icon name="ChevronLeft" size={22} tint={sceneInk.primary} />
            </Glass>
          </Pressable>
        </View>
        {!g ? (
          <View style={{ padding: SCREEN_PAD }}>
            <EmptyState title="This gauge isn’t loaded right now." detail="Go back to Status and pull down to refresh." action="Back to Status" onAction={() => router.back()} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN_PAD, paddingBottom: insets.bottom + space.x5 }}>
            <Detail g={g} source={data && !(data.c.gauges instanceof Error) ? data.c.gauges.source : 'USGS'} sceneKey={key} />
          </ScrollView>
        )}
      </View>
    </ScenePaletteProvider>
  );
}

function Detail({ g, source, sceneKey }: { g: Gauge; source: string; sceneKey: SceneKey }) {
  const trend = TREND[g.trend];
  const st = stats(g);
  const sentence = stageSentence(g);
  const cat = g.flood_category ? CATEGORY[g.flood_category] : null;
  const [scrub, setScrub] = useState<Reading | null>(null);
  const [explain, setExplain] = useState(false);
  const shown = scrub ?? g.latest;
  const simulated = source.startsWith('Scenario');
  const rise = useMemo(() => FadeInDown.duration(duration.base).easing(easing.emphasized).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] }).reduceMotion(ReduceMotion.System), []);

  return (
    <View>
      <Animated.View entering={FadeIn.duration(duration.base)}>
        <Txt variant="moduleLabel" color={simulated ? sceneInk.sim : sceneInk.meta} style={{ marginTop: space.l }}>
          {`${simulated ? 'Simulated' : 'Provisional · USGS'}${g.latest ? ` · ${relativeTime(g.latest.time)}` : ''}`}
        </Txt>
        <Txt variant="title2" color={sceneInk.primary} style={{ marginTop: space.xs }} accessibilityRole="header">
          {gaugeName(g.name)}
        </Txt>
        <Txt variant="footnote" color={sceneInk.secondary}>{`${countyName(g.county_fips)} County · USGS ${g.site_id}`}</Txt>
      </Animated.View>

      {/* The big number: the latest height, or the reading under your finger while you drag the chart. */}
      <Animated.View entering={rise} style={s.hero} accessible accessibilityLabel={shown ? `${feet(shown.value)}${scrub ? ` at ${clockTime(scrub.time)}` : `, latest, ${trend.label}`}` : 'No recent reading'}>
        {shown ? <AnimatedNumber value={shown.value} decimals={2} suffix=" ft" variant="numberXL" color={sceneInk.primary} /> : <Txt variant="numberXL">—</Txt>}
        <View style={s.heroMeta}>
          {scrub ? (
            <Txt variant="callout" color={sceneInk.secondary} style={{ fontVariant: ['tabular-nums'] }}>
              {dateTime(scrub.time)}
            </Txt>
          ) : (
            <>
              {g.latest && trend.icon ? <Icon name={trend.icon} size={18} tint={scene[sceneKey].accent} /> : null}
              <Txt variant="callout" color={scene[sceneKey].accent} style={{ fontFamily: font.semibold, fontVariant: ['tabular-nums'] }}>
                {st ? (Math.abs(st.change) < 0.005 ? `No change in ${st.hours} h` : `${st.change >= 0 ? '+' : '−'}${Math.abs(st.change).toFixed(2)} ft in ${st.hours} h`) : trend.label}
              </Txt>
              {cat ? <StatusBadge level={cat.level} size="s" /> : g.has_official_stage ? null : (
                <View style={[s.noStage, { borderColor: sceneInk.moduleBorder }]}>
                  <Txt variant="footnote" color={sceneInk.secondary}>No official flood stage</Txt>
                </View>
              )}
            </>
          )}
        </View>
      </Animated.View>

      <Animated.View entering={moduleEntering(1, false)} style={{ marginTop: space.xl }}>
        {g.recent_series.length > 1 ? (
          <ScrubChart series={g.recent_series} stages={g.stages} height={220} onScrub={setScrub} bare />
        ) : (
          <Txt variant="callout">No readings in the last 6 hours. This gauge may be offline.</Txt>
        )}
        <Txt variant="footnote" style={{ marginTop: space.s }}>
          {st ? `Last ${st.hours} hours. Press and drag on the chart to see each reading.` : ''}
        </Txt>
      </Animated.View>

      {st ? (
        <Animated.View entering={moduleEntering(2, false)} style={s.stats}>
          <Stat label={`High, ${st.hours} h`} value={feet(st.high)} />
          <Stat label="Change" value={Math.abs(st.change) < 0.005 ? 'None' : `${st.change >= 0 ? '+' : '−'}${Math.abs(st.change).toFixed(2)} ft`} />
          <Stat label={st.next ? `To ${st.next.label}` : 'Stage'} value={st.next ? `${st.next.ft.toFixed(1)} ft` : g.has_official_stage ? 'Above major' : 'None'} />
        </Animated.View>
      ) : null}

      <Animated.View entering={moduleEntering(3, false)}>
        <Glass style={{ marginTop: space.l, padding: space.l, gap: space.s }}>
          <Txt variant="moduleLabel" color={sceneInk.meta}>
            Flood stages
          </Txt>
          {sentence ? <Txt variant="headline">{sentence}</Txt> : null}
          <PressRow open={explain} onPress={() => setExplain(!explain)} label="What do the stages mean?" />
          {explain ? (
            <Txt variant="callout" tone="muted">
              {g.has_official_stage
                ? 'Flood stage is the height where the National Weather Service says flooding begins at this spot. Action stage means it’s time to get ready.'
                : 'This gauge has no official flood stage, so it never changes the status by itself. It’s shown so you can see whether the water is rising or falling here.'}
            </Txt>
          ) : null}
          {g.stages ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.xs }}>
              {([['action', 'Action', 1], ['minor', 'Flood', 2], ['moderate', 'Moderate', 3], ['major', 'Major', 3]] as const).map(([k, label, lvl]) =>
                g.stages![k] != null ? (
                  <View key={k} style={[s.stagePill, { borderColor: scene[lvl].accent }]}>
                    <View style={[s.stageDot, { backgroundColor: scene[lvl].accent }]} />
                    <Txt variant="footnote" color={sceneInk.primary} style={{ fontVariant: ['tabular-nums'] }}>{`${label} ${g.stages![k]} ft`}</Txt>
                  </View>
                ) : null,
              )}
            </View>
          ) : null}
          <Txt variant="footnote" style={{ marginTop: space.xs }}>
            {`${g.latest ? `Read ${dateTime(g.latest.time)}. ` : ''}${simulated ? 'Simulated readings for Scenario Mode.' : 'Provisional data may be revised.'}`}
          </Txt>
        </Glass>
      </Animated.View>
    </View>
  );
}

function PressRow({ open, onPress, label }: { open: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={label} scaleTo={0.98}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 44 }}>
        <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={16} tint={sceneInk.secondary} />
        <Txt variant="footnote" color={sceneInk.secondary} style={{ fontFamily: font.semibold }}>
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Glass style={s.stat}>
      <Txt variant="footnote">{label}</Txt>
      <Txt variant="headline" color={sceneInk.primary} style={{ fontVariant: ['tabular-nums'], marginTop: 2 }}>
        {value}
      </Txt>
    </Glass>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: space.l, flexDirection: 'row' },
  back: { width: tapTarget, height: tapTarget, alignItems: 'center', justifyContent: 'center' },
  hero: { marginTop: space.xl, gap: space.s },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: space.s, flexWrap: 'wrap', minHeight: 28 },
  noStage: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill, paddingHorizontal: space.s, paddingVertical: 2 },
  stats: { flexDirection: 'row', gap: space.s, marginTop: space.l },
  stat: { flex: 1, padding: space.m },
  stagePill: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.s, paddingVertical: 3 },
  stageDot: { width: 6, height: 6, borderRadius: 3 },
});

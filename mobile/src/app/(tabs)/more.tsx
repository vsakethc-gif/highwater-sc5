/**
 * More tab (brief section 8.8; look from REDESIGN.md 5.7): a dark grouped list like the phone's
 * Settings app, with colored icon tiles. At the top, a prominent "Replay a storm" card shows a small
 * living scene (water moving under a stormy sky); tap it to start the storm timeline on Status.
 * Then: other scenarios, Learn, Settings, About. The sections rise in each time you open the tab.
 * Long-press the version number to open the hidden Design Gallery (for checking the look).
 */
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { APP_NAME } from '../../../../shared/config';
import { platform } from '../../../../shared/platform';
import { findScenario, STORM_TIMELINE, timelineIndex } from '../../../../shared/scenario/scenario';
import { Icon } from '../../components/Icon';
import { Wordmark } from '../../components/Logo';
import { moduleEntering } from '../../components/status/Module';
import { Pressable as PressScale } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/Chips';
import { Card, ListRow, SectionHeader } from '../../components/ui/Layout';
import { LargeTitleScroll, Screen } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Text';
import { WaterLine } from '../../components/ui/WaterLine';
import { useFocusReplay } from '../../hooks/useFocusReplay';
import { useAppState, type Appearance } from '../../state';
import { haptic, radius, scene, sceneInk, space, tiles, useTheme } from '../../theme';
import { ONBOARDED_KEY } from '../onboarding';

const SITE = 'https://vsakethc-gif.github.io/highwater-sc5/';

export const LIMITS = [
  'It is not an official warning system. It can be late, wrong, or missing alerts. Official alerts, local officials, and 911 come first.',
  'River gauge readings are provisional, some gauges go offline, and many small creeks have no gauge at all.',
  'FEMA flood zones show long-term risk, not where it is flooding today, and some maps are years old.',
  'Census figures are estimates with margins of error, especially for small neighborhoods.',
  'Routes can’t see every closed or flooded road, and the free routing service can be busy or unavailable.',
  'Shelter information is only as current as the FEMA and Red Cross data. Always confirm with your county.',
  'Community reports are unverified, can be wrong, and are not sent to any government agency.',
];

export default function MoreScreen() {
  const { c } = useTheme();
  const { scenario, setScenario, appearance, setAppearance, haptics, setHaptics } = useAppState();
  const active = findScenario(scenario);
  const visit = useFocusReplay();
  const replaying = timelineIndex(scenario) >= 0;
  const [limitsOpen, setLimitsOpen] = useState(false);
  return (
    <Screen>
      <LargeTitleScroll title="More">
        <View key={visit}>
          <Animated.View entering={moduleEntering(0, false, visit > 0)} style={{ marginTop: space.l }}>
            <StormCard
              on={replaying}
              onPress={() => {
                haptic.press();
                setScenario(STORM_TIMELINE.steps[0].id, '45091');
                router.navigate('/');
              }}
            />
          </Animated.View>

          <Animated.View entering={moduleEntering(1, false, visit > 0)} style={s.section}>
            <SectionHeader title="Demo & simulation" />
            <Card style={{ paddingVertical: 0 }}>
              <ListRow icon="FlaskConical" tile={tiles.violet} title="More scenarios" subtitle={active ? `On: ${active.title}` : 'Helene, tornado, heat, and more'} onPress={() => router.push('/scenario')} last={!active} />
              {active ? <ListRow icon="X" tile={tiles.slate} title="Exit Scenario Mode" subtitle="Back to live data" onPress={() => setScenario(null)} chevron={false} last /> : null}
            </Card>
          </Animated.View>

          <Animated.View entering={moduleEntering(2, false, visit > 0)} style={s.section}>
            <SectionHeader title="Learn" />
            <Card style={{ paddingVertical: 0 }}>
              <ListRow icon="BookOpen" tile={tiles.blue} title="How it works" subtitle="Every rule, threshold, and source" onPress={() => Linking.openURL(`${SITE}#/methodology`)} />
              <ListRow icon="Database" tile={tiles.teal} title="Data sources and credits" subtitle="NWS, USGS, NOAA, FEMA, Census, Iowa State" onPress={() => Linking.openURL(`${SITE}#/about`)} last />
            </Card>
            <PressScale onPress={() => setLimitsOpen(!limitsOpen)} accessibilityRole="button" accessibilityState={{ expanded: limitsOpen }} accessibilityLabel={`What it can’t do, ${LIMITS.length} limits`} scaleTo={0.98} style={{ marginTop: space.l }}>
              <View style={s.limitsRow}>
                <Icon name="Info" size={18} tint={c.inkMuted} />
                <Txt variant="headline" style={{ flex: 1 }}>
                  What it can’t do
                </Txt>
                <Icon name={limitsOpen ? 'ChevronDown' : 'ChevronRight'} size={18} tint={c.inkFaint} />
              </View>
            </PressScale>
            {limitsOpen
              ? LIMITS.map((l) => (
                  <View key={l} style={s.bullet}>
                    <View style={[s.dot, { backgroundColor: c.inkFaint }]} />
                    <Txt variant="callout" tone="muted" style={{ flex: 1 }}>
                      {l}
                    </Txt>
                  </View>
                ))
              : null}
          </Animated.View>

          <Animated.View entering={moduleEntering(3, false, visit > 0)} style={s.section}>
            <SectionHeader title="Settings" />
            <Card style={{ gap: space.l }}>
              <View style={{ gap: space.s }}>
                <Txt variant="headline">Appearance</Txt>
                <SegmentedControl<Appearance>
                  label="Appearance"
                  value={appearance}
                  onChange={setAppearance}
                  options={[
                    { value: 'dark', label: 'Dark' },
                    { value: 'system', label: 'System' },
                    { value: 'light', label: 'Light' },
                  ]}
                />
                <Txt variant="footnote">The Status screen always uses its own living colors.</Txt>
              </View>
              <View style={[s.switchRow, { borderTopColor: c.hairline }]}>
                <View style={{ flex: 1 }}>
                  <Txt variant="headline">Haptics</Txt>
                  <Txt variant="footnote">Light vibrations when you tap and when the status changes</Txt>
                </View>
                <Switch
                  value={haptics}
                  onValueChange={(on) => {
                    setHaptics(on);
                    if (on) haptic.select();
                  }}
                  trackColor={{ true: c.accent, false: c.surfaceSunken }}
                  accessibilityLabel="Haptics"
                />
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={moduleEntering(4, false, visit > 0)} style={s.section}>
            <SectionHeader title="About" />
            <Card style={{ gap: space.m }}>
              <Wordmark size={44} motto />
              <Txt variant="callout">
                {`${APP_NAME} turns official public data into a clear status for the 8 counties of South Carolina’s 5th District, using fixed, written rules. There’s no AI in the app.`}
              </Txt>
              <Txt variant="callout" tone="muted">
                Built by a high school student in York County for the 2026 Congressional App Challenge.
              </Txt>
              <Txt variant="callout" tone="muted">
                Privacy: no accounts, no ads, no tracking. Your location stays on your phone and is never stored. Only your chosen county and settings are remembered here.
              </Txt>
              <ListRow
                icon="RotateCcw"
                tile={tiles.slate}
                title="Show the introduction again"
                onPress={() => {
                  platform().storage.setItem(ONBOARDED_KEY, '0');
                  router.replace('/onboarding');
                }}
                last
              />
            </Card>
            <Pressable onLongPress={() => router.push('/gallery')} delayLongPress={600} accessibilityRole="text" accessibilityLabel={`Version ${Constants.expoConfig?.version ?? '1.0.0'}`}>
              <Txt variant="footnote" style={{ textAlign: 'center', marginTop: space.xxl }}>
                {`${APP_NAME} ${Constants.expoConfig?.version ?? '1.0.0'} · Not an official warning system`}
              </Txt>
            </Pressable>
          </Animated.View>
        </View>
      </LargeTitleScroll>
    </Screen>
  );
}

/**
 * The "Replay a storm" card: a small living scene (stormy sky, moving water) so the best demo in the
 * app is one tap away.
 */
function StormCard({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Replay a storm" accessibilityHint="Starts a made-up storm on the Status screen, from calm to Danger. Simulated, nothing is sent." scaleTo={0.98}>
      <View style={s.storm}>
        <LinearGradient colors={[scene[2].top, scene[3].bottom]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <WaterLine fill={0.08} top={scene[3].water} bottom={scene[3].bottom} amplitude={8} periodMs={7000} style={StyleSheet.absoluteFill} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <View style={s.simTag}>
            <Icon name="FlaskConical" size={12} tint={sceneInk.sim} />
            <Txt variant="caption" color={sceneInk.sim}>
              Simulation
            </Txt>
          </View>
          {on ? (
            <Txt variant="footnote" color={sceneInk.secondary}>
              Playing now
            </Txt>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.m }}>
          <View style={{ flex: 1, gap: space.xs }}>
            <Txt variant="sceneWord" color={sceneInk.primary} style={{ fontSize: 32, lineHeight: 36, letterSpacing: -0.5 }}>
              Replay a storm
            </Txt>
            <Txt variant="callout" color={sceneInk.secondary}>
              Calm to Danger, with one finger.
            </Txt>
          </View>
          <View style={s.play}>
            <Icon name="Play" size={22} tint={scene[3].bottom} filled />
          </View>
        </View>
      </View>
    </PressScale>
  );
}

const s = StyleSheet.create({
  section: { marginTop: space.x3 },
  bullet: { flexDirection: 'row', gap: space.m, marginBottom: space.s },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 9 },
  limitsRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 48 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, borderTopWidth: StyleSheet.hairlineWidth },
  storm: { height: 200, borderRadius: radius.lg, padding: space.l, justifyContent: 'space-between', overflow: 'hidden', borderCurve: 'continuous' },
  simTag: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.s, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: sceneInk.sim },
  play: { width: 52, height: 52, borderRadius: 26, backgroundColor: sceneInk.primary, alignItems: 'center', justifyContent: 'center' },
});

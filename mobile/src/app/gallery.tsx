/**
 * gallery.tsx — the hidden Design Gallery (brief sections 6 and 17). Long-press the version number in
 * More to open it. It shows every component in its states, lets you replay the key animations, and
 * runs a "Demo ready" check before recording. The sample gauge here is clearly labeled: it is not data.
 */
import * as Font from 'expo-font';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { Gauge } from '../../../shared/data/types';
import type { GuidanceBlock } from '../../../shared/guidance/types';
import type { Level } from '../../../shared/hazards/levels';
import type { OverallStatus } from '../../../shared/hazards/types';
import { SCENARIOS } from '../../../shared/scenario/scenario';
import { AnimatedNumber, RainBars, Sparkline, WaterFill } from '../components/data/Charts';
import { ChecklistItem } from '../components/data/Rows';
import { StatusHero } from '../components/data/StatusHero';
import { Icon } from '../components/Icon';
import { Button, IconButton } from '../components/ui/Button';
import { HazardChip, LayerChip, SegmentedControl, StatusBadge } from '../components/ui/Chips';
import { Banner, EmptyState, Notice, Skeleton } from '../components/ui/Feedback';
import { Card, ListRow, SectionHeader } from '../components/ui/Layout';
import { Screen } from '../components/ui/Screen';
import { Sheet } from '../components/ui/Sheet';
import { Txt } from '../components/ui/Text';
import { latestStatus } from '../hooks/useStatus';
import { useAppState } from '../state';
import { font, SCREEN_PAD, space, useTheme } from '../theme';

const now = Date.now();
/** A made-up gauge for showing the water fill. Labeled as a sample everywhere it appears. */
const SAMPLE: Gauge = {
  site_id: 'sample',
  name: 'Sample River (not real data)',
  lon: 0,
  lat: 0,
  county_fips: '45091',
  nws_id: null,
  stages: { action: 13, minor: 15, moderate: 25, major: 30 },
  latest: { time: new Date(now).toISOString(), value: 14.2 },
  unit: 'ft',
  recent_series: Array.from({ length: 25 }, (_, i) => ({ time: new Date(now - (24 - i) * 15 * 60_000).toISOString(), value: 10 + i * 0.18 + Math.sin(i / 3) * 0.3 })),
  trend: 'rising',
  flood_category: 'action',
  has_official_stage: true,
  provisional: true,
};

function sampleOverall(level: Level): OverallStatus {
  return { level, complete: true, gaps: [], active: [], all: [] } as unknown as OverallStatus;
}
const sampleTop = (level: Level) => ({ hazard: 'flood', level, whatsHappening: ['Sample: no flood alerts here right now.', 'Sample: a Flood Watch is in effect.', 'Sample: a Flood Warning is in effect.', 'Sample: a Flash Flood Emergency is in effect.'][level] }) as unknown as GuidanceBlock;

export default function Gallery() {
  const { c } = useTheme();
  const { appearance, setAppearance } = useAppState();
  const [level, setLevel] = useState<Level>(0);
  const [num, setNum] = useState(12.4);
  const [layer, setLayer] = useState(true);
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [sheet, setSheet] = useState(false);
  const [loading, setLoading] = useState(false);

  const live = latestStatus();
  const checks: [string, boolean][] = [
    ['Fonts loaded (Atkinson Hyperlegible Next + Newsreader)', Font.isLoaded('AtkinsonHyperlegibleNext_400Regular') && Font.isLoaded('Newsreader_600SemiBold')],
    ['Live data loaded on Status', !!live && !live.c.simulated && !(live.c.alerts instanceof Error)],
    ['Scenario Mode available (incl. Helene replays)', SCENARIOS.length >= 8],
    ['Production-style build (no debug overlays)', !__DEV__],
  ];

  return (
    <Screen>
      <View style={s.top}>
        <IconButton icon="ChevronLeft" label="Back" onPress={() => router.back()} />
        <Txt variant="headline">Design Gallery</Txt>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN_PAD, paddingBottom: 140, gap: space.x3 }}>
        <View>
          <SectionHeader title="Demo ready" />
          <Card style={{ gap: space.s }}>
            {checks.map(([label, ok]) => (
              <View key={label} style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
                <Icon name={ok ? 'CircleCheck' : 'CircleAlert'} tint={ok ? c.levels[0].fg : c.levels[1].fg} />
                <Txt variant="callout" style={{ flex: 1 }}>
                  {label}
                </Txt>
              </View>
            ))}
            <Txt variant="footnote">The last item is expected to be off in Expo Go during development. Before recording, shake the phone and turn off the performance monitor and element inspector.</Txt>
          </Card>
        </View>

        <View>
          <SectionHeader title="Theme" />
          <SegmentedControl label="Appearance" value={appearance} onChange={setAppearance} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </View>

        <View style={{ gap: space.m }}>
          <SectionHeader title="Status hero (tap a level to morph)" />
          <StatusHero overall={sampleOverall(level)} top={sampleTop(level)} placeName="Sample County" onPress={() => {}} />
          <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
            {([0, 1, 2, 3] as Level[]).map((l) => (
              <Button key={l} label={['Normal', 'Watch', 'Warning', 'Danger'][l]} onPress={() => setLevel(l)} compact kind={l === level ? 'primary' : 'secondary'} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
            {([0, 1, 2, 3] as Level[]).map((l) => (
              <StatusBadge key={l} level={l} />
            ))}
          </View>
        </View>

        <View style={{ gap: space.s }}>
          <SectionHeader title="Buttons" />
          <Button label="Primary" kind="primary" onPress={() => {}} />
          <Button label="Secondary" icon="Map" onPress={() => {}} />
          <Button label="Text button" kind="text" onPress={() => {}} />
          <Button label="Call 911" icon="Phone" kind="danger" onPress={() => {}} />
          <Button label="Disabled" onPress={() => {}} disabled />
          <Button
            label="Tap to load"
            kind="primary"
            loading={loading}
            onPress={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1800);
            }}
          />
        </View>

        <View style={{ gap: space.s }}>
          <SectionHeader title="Chips and controls" />
          <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
            <HazardChip hazard="flood" level={2} />
            <HazardChip hazard="tornado" level={1} />
            <LayerChip label="Rivers" on={layer} onToggle={() => setLayer(!layer)} />
          </View>
          <SegmentedControl label="Sample" value={seg} onChange={setSeg} options={[{ value: 'a', label: '48 hours' }, { value: 'b', label: '7 days' }, { value: 'c', label: 'Month' }]} />
        </View>

        <View>
          <SectionHeader title="Rows" />
          <Card style={{ paddingVertical: 0 }}>
            <ListRow icon="BookOpen" title="List row" subtitle="With a subtitle" onPress={() => {}} />
            <ListRow icon="Settings" title="Trailing value" trailing={<Txt variant="headline" style={{ fontVariant: ['tabular-nums'] }}>12.4 ft</Txt>} last />
          </Card>
        </View>

        <View style={{ gap: space.m }}>
          <SectionHeader title="Water fill, sparkline, numbers (sample data)" />
          <Card style={{ flexDirection: 'row', gap: space.xl, alignItems: 'center' }}>
            <WaterFill gauge={{ ...SAMPLE, latest: { ...SAMPLE.latest!, value: num } }} width={64} height={168} labels moving />
            <View style={{ flex: 1, gap: space.s }}>
              <AnimatedNumber value={num} decimals={1} suffix=" ft" variant="numberXL" />
              <Sparkline series={SAMPLE.recent_series} width={150} height={40} reference={15} />
              <Button label="Change level" onPress={() => setNum(Math.round((6 + Math.random() * 24) * 10) / 10)} compact />
            </View>
          </Card>
          <Card>
            <RainBars next24={0.8} next48={2.3} />
          </Card>
          <ChecklistItem storageKey="sc5ready.gallery.check" text="Sample checklist item: tap to check it off" number={1} />
        </View>

        <View style={{ gap: space.s }}>
          <SectionHeader title="Banners and notices" />
          <Banner kind="info" title="Info banner" detail="Something you should know" />
          <Banner kind="stale" title="This information may be out of date." detail="Pull to refresh or check weather.gov." />
          <Banner kind="offline" title="Offline · showing info from 2:14 PM" />
          <Banner kind="simulation" title="SIMULATION — not live data" detail="Sample scenario" action="Exit" onAction={() => {}} />
          <Banner kind="emergency" title="Stay at least 30 feet away" detail="Call 911 and your power company." />
          <Notice title="Couldn’t load river levels from USGS." detail="Alerts may still be working." onRetry={() => {}} />
          <Skeleton height={60} />
          <EmptyState title="There are no river gauges in Lee County." detail="Official alerts and the rain forecast still count." action="Open the map" onAction={() => {}} />
        </View>

        <View>
          <SectionHeader title="Bottom sheet" />
          <Button label="Open sheet" onPress={() => setSheet(true)} />
        </View>
        <Txt variant="footnote" style={{ fontFamily: font.medium }}>
          Turn on Reduce Motion in the phone’s accessibility settings: movement becomes simple fades, and the Danger pulse and waves stop.
        </Txt>
      </ScrollView>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Sample sheet" snaps={[0.4, 0.85]}>
        <Txt tone="muted">Drag the handle to resize. Flick down or tap outside to close.</Txt>
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.s, paddingTop: space.xs },
});

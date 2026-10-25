/**
 * sources.tsx — the sheet that opens when you tap the live ribbon on Status: where each piece of the
 * current picture came from and how old it is (every number traces back to its source).
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import type { Loaded } from '../../../shared/data/types';
import { dateTime, isStale, relativeTime } from '../../../shared/time';
import { Icon, type IconName } from '../components/Icon';
import { Txt } from '../components/ui/Text';
import { latestStatus } from '../hooks/useStatus';
import { radius, SCREEN_PAD, space, useTheme } from '../theme';

function SourceRow({ icon, title, loaded, last }: { icon: IconName; title: string; loaded: Loaded<unknown> | Error; last: boolean }) {
  const { c } = useTheme();
  const failed = loaded instanceof Error;
  const old = !failed && isStale(loaded.fetched_at);
  return (
    <View style={[s.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairline }]}>
      <View style={[s.icon, { backgroundColor: c.accentSoft }]}>
        <Icon name={icon} size={18} tint={c.accent} />
      </View>
      <View style={{ flex: 1, gap: space.xxs }}>
        <Txt variant="headline">{title}</Txt>
        {failed ? (
          <Txt variant="callout" color={c.levels[2].fg}>
            Didn’t load this time. The rest of the picture may still be fine.
          </Txt>
        ) : (
          <>
            <Txt variant="callout" tone="muted">
              {loaded.source}
            </Txt>
            <Txt variant="footnote" color={old || loaded.saved ? c.levels[1].fg : undefined}>
              {`${loaded.saved ? 'Saved copy from' : 'Checked'} ${relativeTime(loaded.fetched_at)} · ${dateTime(loaded.fetched_at)}${old ? ' · may be out of date' : ''}`}
            </Txt>
          </>
        )}
      </View>
    </View>
  );
}

export default function SourcesSheet() {
  const { c } = useTheme();
  const data = latestStatus();
  return (
    <ScrollView style={{ backgroundColor: c.surface }} contentContainerStyle={{ padding: SCREEN_PAD, paddingTop: space.xxl, gap: space.l, paddingBottom: space.x5 }}>
      <Txt variant="title2" accessibilityRole="header">
        Where this comes from
      </Txt>
      {data ? (
        <>
          {data.c.simulated ? (
            <Txt variant="callout" color={c.accent}>
              Scenario Mode is on. Everything below is simulated or replayed, not live data.
            </Txt>
          ) : null}
          <View style={[s.group, { borderColor: c.hairline }]}>
            <SourceRow icon="TriangleAlert" title="Official alerts" loaded={data.c.alerts} last={false} />
            <SourceRow icon="Waves" title="River levels" loaded={data.c.gauges} last={false} />
            <SourceRow icon="CloudRain" title="Rain forecast" loaded={data.c.rain} last />
          </View>
          <Txt variant="footnote">Data older than 2 hours is marked out of date, and the app never shows an all-clear based on it. Pull down on Status to refresh.</Txt>
        </>
      ) : (
        <Txt variant="callout" tone="muted">
          Still loading. Sources and times appear here once the status loads.
        </Txt>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  group: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.l },
  row: { flexDirection: 'row', gap: space.m, paddingVertical: space.m, alignItems: 'flex-start' },
  icon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});

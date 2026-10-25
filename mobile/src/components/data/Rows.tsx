/**
 * Rows.tsx — GaugeRow, AlertRow, and ChecklistItem (brief section 6, items 19–20).
 * Wording is specific and human: "2.1 ft below flood stage and falling".
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import type { Alert, FloodCategory, Gauge, Trend } from '../../../../shared/data/types';
import { feet, gaugeName } from '../../../../shared/format';
import { classifyAlert } from '../../../../shared/hazards/alertMap';
import { HAZARDS } from '../../../../shared/hazards/hazards';
import { platform } from '../../../../shared/platform';
import { dateTime, isStale, relativeTime } from '../../../../shared/time';
import { duration, easing, haptic, listItemEntering, radius, space, useTheme } from '../../theme';
import { Icon, type IconName } from '../Icon';
import { Pressable } from '../ui/Button';
import { StatusBadge } from '../ui/Chips';
import { Txt } from '../ui/Text';
import { Sparkline, WaterFill } from './Charts';

export const TREND: Record<Trend, { label: string; icon: IconName | null }> = {
  rising: { label: 'Rising', icon: 'TrendingUp' },
  falling: { label: 'Falling', icon: 'TrendingDown' },
  steady: { label: 'Steady', icon: 'ArrowRight' },
  unknown: { label: 'Trend unknown', icon: null },
};

export const CATEGORY: Record<FloodCategory, { label: string; level: 1 | 2 | 3 }> = {
  action: { label: 'Action stage', level: 1 },
  minor: { label: 'Minor flooding', level: 2 },
  moderate: { label: 'Moderate flooding', level: 3 },
  major: { label: 'Major flooding', level: 3 },
};

/** "2.1 ft below flood stage and falling", or null when there's no official flood stage. */
export function stageSentence(g: Gauge): string | null {
  if (!g.latest || !g.stages || g.stages.minor === null) return null;
  const diff = Math.abs(g.stages.minor - g.latest.value).toFixed(1);
  const where = g.latest.value >= g.stages.minor ? 'above' : 'below';
  const trend = g.trend === 'unknown' ? '' : ` and ${g.trend}`;
  return `${diff} ft ${where} flood stage${trend}`;
}

export function GaugeRow({ g, index, last }: { g: Gauge; index: number; last?: boolean }) {
  const { c } = useTheme();
  const trend = TREND[g.trend];
  const sentence = stageSentence(g);
  const cat = g.flood_category ? CATEGORY[g.flood_category] : null;
  const stale = g.latest ? isStale(g.latest.time) : false;
  return (
    <Animated.View entering={listItemEntering(index)}>
      <Pressable
        onPress={() => router.push({ pathname: '/gauge/[id]', params: { id: g.site_id } })}
        accessibilityRole="button"
        accessibilityLabel={`${gaugeName(g.name)}. ${g.latest ? `${feet(g.latest.value)}, ${trend.label}.` : 'No recent reading.'} ${sentence ?? (g.has_official_stage ? '' : 'No official flood stage.')}`}
        accessibilityHint="Opens the gauge details"
        scaleTo={0.985}
      >
        <View style={[s.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairline }]}>
          {g.stages && g.latest ? <WaterFill gauge={g} /> : <View style={[s.noVessel, { borderColor: c.hairline }]} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="headline" numberOfLines={2}>{gaugeName(g.name)}</Txt>
            {!g.latest || !g.has_official_stage ? (
              <Txt variant="footnote">{g.has_official_stage ? 'No recent reading' : 'No flood stage'}</Txt>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: 2 }}>
              <Sparkline series={g.recent_series} width={72} height={20} reference={g.stages?.minor ?? null} />
              <Txt variant="footnote" numberOfLines={1}>{g.latest ? relativeTime(g.latest.time) : `USGS ${g.site_id}`}</Txt>
            </View>
            {stale ? (
              <Txt variant="footnote" color={c.levels[1].fg}>
                Old reading. This gauge may be offline.
              </Txt>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            {g.latest ? <Txt variant="title3" style={{ fontVariant: ['tabular-nums'] }}>{feet(g.latest.value)}</Txt> : null}
            {g.latest ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                {trend.icon ? <Icon name={trend.icon} size={14} tint={c.inkMuted} /> : null}
                <Txt variant="footnote" tone="muted">
                  {trend.label}
                </Txt>
              </View>
            ) : null}
            {cat ? <StatusBadge level={cat.level} size="s" /> : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function AlertRow({ a, index, last }: { a: Alert; index: number; last?: boolean }) {
  const { c } = useTheme();
  const { hazard, level } = classifyAlert(a);
  return (
    <Animated.View entering={listItemEntering(index)}>
      <Pressable
        onPress={() => router.push({ pathname: '/alert/[id]', params: { id: a.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${a.event}. ${a.ends ? `Until ${dateTime(a.ends)}.` : ''}`}
        accessibilityHint="Opens the full official alert"
        scaleTo={0.985}
      >
        <View style={[s.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairline }]}>
          <View style={[s.alertIcon, { backgroundColor: c.levels[level].bg }]}>
            <Icon name={HAZARDS[hazard].icon} tint={c.levels[level].fg} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="headline">{a.event}</Txt>
            <Txt variant="footnote">{a.ends ? `Until ${dateTime(a.ends)}` : a.onset ? `From ${dateTime(a.onset)}` : `Issued ${dateTime(a.sent)}`}</Txt>
          </View>
          <Icon name="ChevronRight" size={18} tint={c.inkFaint} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * One step you can tick off: the check draws itself, the row quiets down, success haptic. Remembered on
 * the phone. `flush` drops the card look, for lists inside a Status module (a hairline between rows).
 */
export function ChecklistItem({ storageKey, text, number, flush, last, short }: { storageKey: string; text: string; number: number; flush?: boolean; last?: boolean; short?: { icon: IconName; label: string } }) {
  const { c } = useTheme();
  // With a short label, the full sentence sits behind the small "more" button on the right.
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(() => platform().storage.getItem(storageKey) === '1');
  const draw = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    draw.value = withTiming(done ? 1 : 0, { duration: done ? duration.base : duration.fast, easing: easing.emphasized });
  }, [done, draw]);
  // Length of the check mark path below (two straight strokes), so the dash can 'draw' it.
  const CHECK_LEN = Math.hypot(11, 11) + Math.hypot(5, 5);
  const check = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - draw.value) }));
  const rowStyle = useAnimatedStyle(() => ({ opacity: 1 - 0.35 * draw.value }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: draw.value }));
  return (
    <Pressable
      onPress={() => {
        const next = !done;
        setDone(next);
        platform().storage.setItem(storageKey, next ? '1' : '0');
        if (next) haptic.success();
        else haptic.select();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={text}
      scaleTo={0.985}
    >
      <View style={flush ? [s.checkFlush, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairline }] : [s.check, { borderColor: c.hairline, backgroundColor: c.surface }]}>
        <View style={[s.box, { borderColor: done ? c.accent : c.inkFaint }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.accent, borderRadius: 14 }, fillStyle]} />
          {done ? null : <Txt variant="footnote" tone="accent">{number}</Txt>}
          <Svg width={16} height={16} viewBox="0 0 24 24" style={{ position: 'absolute' }}>
            <AnimatedPath d="M20 6 9 17l-5-5" stroke={c.onAccent} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[CHECK_LEN, CHECK_LEN]} animatedProps={check} />
          </Svg>
        </View>
        <Animated.View style={[{ flex: 1 }, rowStyle]}>
          {short ? (
            <View style={{ gap: space.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                <Icon name={short.icon} size={18} tint={c.accent} />
                <Txt variant="headline" style={{ flex: 1 }}>
                  {short.label}
                </Txt>
              </View>
              {open ? (
                <Txt variant="callout" tone="muted">
                  {text}
                </Txt>
              ) : null}
            </View>
          ) : (
            <Txt>{text}</Txt>
          )}
        </Animated.View>
        {short ? (
          <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={open ? 'Hide details' : 'Show details'} hitSlop={8} scaleTo={0.9}>
            <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={18} tint={c.inkFaint} />
            </View>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.m, minHeight: 64 },
  noVessel: { width: 24, height: 56, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed' },
  alertIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, borderWidth: 1, borderRadius: radius.md, minHeight: 60 },
  checkFlush: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.m, minHeight: 56 },
  box: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

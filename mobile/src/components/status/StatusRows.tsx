/**
 * StatusRows.tsx — rows that live inside the Status modules:
 *   TriggerLine   one reason for the status, with its source (tap to open it) and time
 *   AlertTimeRow  an official alert with a Flighty-style time bar: a thin bar from when it started to
 *                 when it ends, filled up to "now", with a dot at now. "Started 2:10 PM · Ends 8:00 PM"
 */
import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import type { Alert } from '../../../../shared/data/types';
import { classifyAlert } from '../../../../shared/hazards/alertMap';
import { HAZARDS } from '../../../../shared/hazards/hazards';
import type { Trigger } from '../../../../shared/hazards/types';
import { clockTime, dateTime } from '../../../../shared/time';
import { radius, space, useTheme } from '../../theme';
import { Icon } from '../Icon';
import { Pressable } from '../ui/Button';
import { StatusBadge } from '../ui/Chips';
import { Txt } from '../ui/Text';

/** "2:10 PM" today, "Sat, Oct 17, 2:10 PM" on another day. */
function when(iso: string): string {
  return new Date(iso).toDateString() === new Date().toDateString() ? clockTime(iso) : dateTime(iso);
}

export function TriggerLine({ t, last }: { t: Trigger; last: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[s.trigger, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairline }]}>
      <StatusBadge level={t.level} size="s" />
      <View style={{ flex: 1, gap: space.xxs }}>
        <Txt variant="callout">{t.text}</Txt>
        <Txt variant="footnote">
          {t.url ? (
            <Txt variant="footnote" tone="accent" onPress={() => Linking.openURL(t.url!)} accessibilityRole="link">
              {t.source}
            </Txt>
          ) : (
            t.source
          )}
          {t.time ? ` · ${when(t.time)}` : ''}
        </Txt>
      </View>
    </View>
  );
}

/** `now` is when the status was loaded (ms), so the bar matches the rest of the screen. */
export function AlertTimeRow({ a, last, now }: { a: Alert; last: boolean; now: number }) {
  const { c } = useTheme();
  const { hazard, level } = classifyAlert(a);
  const color = c.levels[level].fg;
  const start = Date.parse(a.onset ?? a.sent);
  const end = a.ends ? Date.parse(a.ends) : null;
  const share = end && end > start ? Math.max(0, Math.min(1, (now - start) / (end - start))) : null;
  const begun = now >= start;
  const times = `${begun ? 'Started' : 'Starts'} ${when(a.onset ?? a.sent)}${a.ends ? ` · Ends ${when(a.ends)}` : ' · No end time given'}`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/alert/[id]', params: { id: a.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${a.event}. ${times}.`}
      accessibilityHint="Opens the full official alert"
      scaleTo={0.985}
    >
      <View style={[s.alert, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairline }]}>
        <View style={s.alertHead}>
          <Icon name={HAZARDS[hazard].icon} size={20} tint={color} />
          <Txt variant="headline" style={{ flex: 1 }}>
            {a.event}
          </Txt>
          <Icon name="ChevronRight" size={18} tint={c.inkFaint} />
        </View>
        {share !== null ? (
          <View style={[s.track, { backgroundColor: c.hairline }]} accessibilityElementsHidden>
            <View style={[s.fill, { width: `${share * 100}%`, backgroundColor: color }]} />
            <View style={[s.now, { left: `${share * 100}%`, backgroundColor: color, borderColor: c.bg }]} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Txt variant="footnote" style={{ fontVariant: ['tabular-nums'] }}>{when(a.onset ?? a.sent)}</Txt>
          <Txt variant="footnote" style={{ fontVariant: ['tabular-nums'] }}>{a.ends ? when(a.ends) : 'No end time'}</Txt>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  trigger: { flexDirection: 'row', gap: space.m, paddingVertical: space.m, alignItems: 'flex-start' },
  alert: { paddingHorizontal: space.l, paddingVertical: space.m, gap: space.s, minHeight: 64 },
  alertHead: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  track: { height: 3, borderRadius: radius.pill, marginVertical: space.xs },
  fill: { height: 3, borderRadius: radius.pill },
  now: { position: 'absolute', top: -4, width: 11, height: 11, marginLeft: -5.5, borderRadius: 6, borderWidth: 2 },
});

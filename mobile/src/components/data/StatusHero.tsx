/**
 * StatusHero.tsx — the hero status band and "Why this status?" (brief section 8.2, items 2–3).
 *
 * The band runs edge to edge and is filled with the level's strong color (green Normal, amber Watch,
 * orange Warning, red Danger), so the status reads in a second, even on a cracked screen in sunlight.
 * Color is never the only signal: the band always shows the level's icon and its name as a big word.
 * Inside the band, deeper "water" rises to a height set by the level (low at Normal, high at Danger).
 *
 * Motion: when the screen opens the water rises from empty to its level and the words slide up into
 * place. When the level changes, the band color cross-fades, the water rises or falls, the phone
 * vibrates (stronger for Warning and Danger), and screen readers hear the new status. Danger always
 * appears instantly, and Reduce Motion turns the movement off.
 */
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Linking, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, FadeIn, FadeInDown, FadeOut, interpolateColor, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { GuidanceBlock } from '../../../../shared/guidance/types';
import { HAZARDS } from '../../../../shared/hazards/hazards';
import { LEVELS, type Level } from '../../../../shared/hazards/levels';
import type { OverallStatus, Trigger } from '../../../../shared/hazards/types';
import { dateTime } from '../../../../shared/time';
import { duration, easing, haptic, radius, SCREEN_PAD, space, useMotionReduced, useTheme } from '../../theme';
import { Icon } from '../Icon';
import { withAlpha } from '../map/mapStyle';
import { Pressable } from '../ui/Button';
import { StatusBadge } from '../ui/Chips';
import { Txt } from '../ui/Text';
import { WaterLine } from '../ui/WaterLine';

/** The level's icon in a soft circle. At Danger the icon breathes slowly (unless Reduce Motion). */
function LevelIcon({ level, color }: { level: Level; color: string }) {
  const reduced = useMotionReduced();
  const beat = useSharedValue(1);
  useEffect(() => {
    if (level === 3 && !reduced) beat.value = withRepeat(withSequence(withTiming(1.08, { duration: 800 }), withTiming(1, { duration: 800 })), -1, false);
    else {
      cancelAnimation(beat);
      beat.value = 1;
    }
  }, [level, reduced, beat]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  return (
    <Animated.View style={[s.levelIcon, { backgroundColor: withAlpha(color, 0.18) }, style]}>
      <Icon name={LEVELS[level].icon} size={24} tint={color} />
    </Animated.View>
  );
}

/** How high the deeper water sits in the band, by level. */
const WATER: Record<Level, number> = { 0: 0.22, 1: 0.4, 2: 0.58, 3: 0.78 };

export function StatusHero({ overall, top, placeName, onPress }: { overall: OverallStatus; top: GuidanceBlock; placeName: string; onPress: () => void }) {
  const { c } = useTheme();
  const reduced = useMotionReduced();
  const level = overall.level;
  const unconfirmed = !overall.complete && level === 0;
  const previous = useRef<Level | null>(null);

  useEffect(() => {
    if (previous.current !== null && previous.current !== level) {
      haptic.level(level);
      AccessibilityInfo.announceForAccessibility(`Status changed to ${LEVELS[level].name}. ${top.whatsHappening}`);
    }
    previous.current = level;
  }, [level, top.whatsHappening]);

  // The band color cross-fades between levels (instantly for Danger or with Reduce Motion).
  const band = unconfirmed ? c.surfaceSunken : c.levels[level].band;
  const on = unconfirmed ? c.ink : c.levels[level].onBand;
  const mix = useSharedValue(1);
  const from = useSharedValue(band);
  const to = useSharedValue(band);
  useEffect(() => {
    if (to.value === band) return;
    from.value = to.value;
    to.value = band;
    mix.value = 0;
    mix.value = level === 3 || reduced ? 1 : withTiming(1, { duration: duration.slow, easing: easing.standard });
  }, [band, level, reduced, mix, from, to]);
  const bandStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(mix.value, [0, 1], [from.value, to.value]) }));

  const hazard = HAZARDS[top.hazard];
  const word = unconfirmed ? 'Can’t confirm' : LEVELS[level].name;
  const enter = level === 3 ? undefined : FadeInDown.duration(duration.slow).springify().damping(18).reduceMotion(ReduceMotion.System);
  const enterLater = level === 3 ? undefined : FadeInDown.delay(120).duration(duration.slow).springify().damping(18).reduceMotion(ReduceMotion.System);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${word}. ${unconfirmed ? `We can’t confirm conditions for ${placeName} right now.` : top.whatsHappening}`} accessibilityHint="Shows why" scaleTo={0.99}>
      <Animated.View style={[s.band, bandStyle, unconfirmed && { borderWidth: 1, borderStyle: 'dashed', borderColor: c.inkFaint }]}>
        {/* Deeper water rising inside the band: higher for more serious levels. */}
        <WaterLine
          fill={unconfirmed ? 0.15 : WATER[level]}
          top={unconfirmed ? c.hairline : 'rgba(0,0,0,0.13)'}
          bottom={unconfirmed ? c.hairline : 'rgba(0,0,0,0.2)'}
          amplitude={9}
          periodMs={5600}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.topRow}>
          {unconfirmed ? (
            <View style={[s.unknownBadge, { borderColor: c.inkFaint }]}>
              <Icon name="CircleAlert" size={20} />
            </View>
          ) : (
            <LevelIcon level={level} color={on} />
          )}
          <View style={s.hazard}>
            <Icon name={hazard.icon} size={18} tint={on} />
            <Txt variant="callout" color={on}>
              {hazard.label}
            </Txt>
          </View>
        </View>
        <Animated.View key={word} entering={enter} exiting={FadeOut.duration(duration.fast)}>
          <Txt variant="display" color={on} style={s.word} accessibilityRole="header">
            {word}
          </Txt>
        </Animated.View>
        <Animated.View key={top.whatsHappening} entering={enterLater}>
          <Txt variant="title3" color={on} style={{ marginTop: space.xs }}>
            {unconfirmed ? `We can’t confirm conditions for ${placeName} right now.` : top.whatsHappening}
          </Txt>
          <Txt variant="callout" color={on} style={{ marginTop: space.s }}>
            {unconfirmed ? 'Some official data didn’t load. Check weather.gov and local news.' : LEVELS[level].meaning}
          </Txt>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

function TriggerRow({ t, last }: { t: Trigger; last: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[s.trigger, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairline }]}>
      <StatusBadge level={t.level} size="s" />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="callout">{t.text}</Txt>
        <Txt variant="footnote">
          {t.url ? (
            <Txt variant="footnote" tone="accent" onPress={() => Linking.openURL(t.url!)} accessibilityRole="link">
              {t.source}
            </Txt>
          ) : (
            t.source
          )}
          {t.time ? ` · ${dateTime(t.time)}` : ''}
        </Txt>
      </View>
    </View>
  );
}

/** "Why this status?": opens smoothly to show every trigger with its source, and what we checked. */
export function WhyStatus({ overall, checks, open, onToggle }: { overall: OverallStatus; checks: string[]; open: boolean; onToggle: () => void }) {
  const { c } = useTheme();
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, { duration: duration.base, easing: easing.standard });
  }, [open, turn]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  const triggers = overall.all.flatMap((h) => h.triggers).filter((t) => t.level > 0).sort((a, b) => b.level - a.level);
  return (
    <View style={[s.why, { backgroundColor: c.surface, borderColor: c.hairline }]}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel="Why this status?" scaleTo={0.99}>
        <View style={s.whyHead}>
          <Txt variant="headline" style={{ flex: 1 }}>
            Why this status?
          </Txt>
          <Animated.View style={chevron}>
            <Icon name="ChevronDown" size={20} tint={c.inkMuted} />
          </Animated.View>
        </View>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(duration.base).reduceMotion(ReduceMotion.System)} style={{ paddingHorizontal: space.l, paddingBottom: space.l }}>
          {triggers.length ? triggers.map((t, i) => <TriggerRow key={i} t={t} last={i === triggers.length - 1} />) : <Txt variant="callout">Nothing we check is above Normal right now.</Txt>}
          <Txt variant="caption" tone="muted" style={{ marginTop: space.l, marginBottom: space.s }}>
            What we checked
          </Txt>
          {checks.map((ch) => (
            <View key={ch} style={[s.check, { borderLeftColor: c.hairline }]}>
              <Txt variant="callout" tone="muted">
                {ch}
              </Txt>
            </View>
          ))}
          <Txt variant="footnote" style={{ marginTop: space.m }}>
            Fixed, published rules (More → How it works). Transparent, rule-based analysis of official data, not an official warning.
          </Txt>
        </Animated.View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  band: { marginHorizontal: -SCREEN_PAD, paddingHorizontal: SCREEN_PAD, paddingTop: space.xxl, paddingBottom: space.xl, minHeight: 300, overflow: 'hidden' },
  word: { marginTop: space.l, fontSize: 52, lineHeight: 56, letterSpacing: -1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, flexWrap: 'wrap' },
  levelIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  unknownBadge: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  hazard: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  why: { borderWidth: 1, borderRadius: radius.md, marginTop: space.l },
  whyHead: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.l },
  trigger: { flexDirection: 'row', gap: space.m, paddingVertical: space.m, alignItems: 'flex-start' },
  check: { borderLeftWidth: 2, paddingLeft: space.m, marginBottom: space.s },
});

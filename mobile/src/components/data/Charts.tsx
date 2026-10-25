/**
 * Charts.tsx — small data visuals (brief section 6, items 15–18):
 *   Sparkline      recent water height as a line that draws itself in, left to right (once)
 *   WaterFill      the water line inside a vessel, rising to the current height, with flood-stage marks
 *   RainBars       next 24 h / 48 h rain as bars that grow in, with the 2-inch "Watch" mark
 *   AnimatedNumber a value that counts smoothly to its new number (tabular, so digits don't jump)
 */
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { THRESHOLDS } from '../../../../shared/config';
import type { FloodStages, Gauge, Reading } from '../../../../shared/data/types';
import { sparklinePoints } from '../../../../shared/sparkline';
import { duration, easing, font, radius, space, type, useMotionReduced, useTheme, type TypeStyle } from '../../theme';
import { Txt } from '../ui/Text';
import { WaterLine } from '../ui/WaterLine';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedInput = Animated.createAnimatedComponent(TextInput);

export function Sparkline({ series, width = 96, height = 28, reference }: { series: Reading[]; width?: number; height?: number; reference?: number | null }) {
  const { c } = useTheme();
  const reduced = useMotionReduced();
  const draw = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) draw.value = withTiming(1, { duration: 300, easing: easing.emphasized });
  }, [draw, reduced]);
  const points = sparklinePoints(series, width, height);
  const pts = points ? points.split(' ').map((p) => p.split(',').map(Number)) : [];
  // The phone's SVG has no pathLength, so we measure the line ourselves to 'draw' it with a dash.
  const length = pts.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0) || 1;
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }));
  if (!points) return <View style={{ width, height }} />;
  const d = `M${pts.map((p) => p.join(' ')).join(' L')}`;
  const last = pts[pts.length - 1];
  // A dashed line for the flood stage, if it falls inside the chart's range.
  const values = series.map((r) => r.value);
  const min = Math.min(...values);
  const span = Math.max(Math.max(...values) - min, 0.2);
  const refY = reference != null && reference >= min && reference <= min + span ? height - 2 - ((reference - min) / span) * (height - 4) : null;
  return (
    <Svg width={width + 4} height={height} accessibilityElementsHidden>
      {refY !== null ? <Line x1={0} x2={width} y1={refY} y2={refY} stroke={c.levels[2].fg} strokeWidth={1} strokeDasharray="3 3" /> : null}
      <AnimatedPath d={d} fill="none" stroke={c.accent} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[length, length]} animatedProps={props} />
      <Circle cx={last[0]} cy={last[1]} r={2.75} fill={c.accent} />
    </Svg>
  );
}

/** Top of the vessel: the major flood stage, or a little above flood stage when there's no major stage. */
export function vesselTop(stages: FloodStages | null): number {
  if (!stages) return 1;
  return stages.major ?? stages.moderate ?? (stages.minor ?? 1) * 1.4;
}

const STAGE_LABELS: [keyof FloodStages, string][] = [
  ['action', 'Action'],
  ['minor', 'Minor'],
  ['moderate', 'Moderate'],
  ['major', 'Major'],
];

/**
 * The water line inside a rounded vessel. Water rises to the current reading (deliberate, once);
 * marks show the official stages. `labels` adds stage names beside the vessel (detail screen).
 */
export function WaterFill({ gauge, value, width = 24, height = 56, labels, moving = false }: { gauge: Gauge; value?: number; width?: number; height?: number; labels?: boolean; moving?: boolean }) {
  const { c } = useTheme();
  const stages = gauge.stages;
  const reading = value ?? gauge.latest?.value;
  if (!stages || reading === undefined) return null;
  const top = vesselTop(stages);
  const fill = Math.max(0.04, Math.min(1, reading / top));
  const lvl = gauge.flood_category === 'major' || gauge.flood_category === 'moderate' ? 3 : gauge.flood_category === 'minor' ? 2 : gauge.flood_category === 'action' ? 1 : null;
  const waterTop = lvl ? c.levels[lvl].fg : c.waterTop;
  const waterBottom = lvl ? c.levels[lvl].bg : c.waterBottom;
  const marks = STAGE_LABELS.map(([k, label]) => ({ label, y: stages[k] == null ? null : height - Math.min(1, (stages[k] as number) / top) * height, k })).filter((m) => m.y !== null) as { label: string; y: number; k: string }[];
  return (
    <View style={{ flexDirection: 'row', gap: space.s }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[s.vessel, { width, height, borderRadius: Math.min(width / 2, radius.md), borderColor: c.hairline, backgroundColor: c.surfaceSunken }]}>
        <WaterLine fill={fill} top={waterTop} bottom={waterBottom} amplitude={labels ? 6 : 3} moving={moving} style={StyleSheet.absoluteFill} />
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          {marks.map((m) => (
            <Line key={m.k} x1={0} x2={width} y1={m.y} y2={m.y} stroke={m.k === 'action' ? c.levels[1].fg : c.levels[m.k === 'minor' ? 2 : 3].fg} strokeWidth={m.k === 'minor' ? 2 : 1.25} strokeDasharray={m.k === 'action' ? '3 2' : undefined} />
          ))}
        </Svg>
      </View>
      {labels ? (
        <View style={{ height, width: 72 }}>
          {marks.map((m) => (
            <Txt key={m.k} variant="footnote" style={{ position: 'absolute', top: Math.max(0, Math.min(height - 16, m.y - 9)) }}>
              {`${m.label} ${stages[m.k as keyof FloodStages]} ft`}
            </Txt>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Bar({ label, inches, max, index }: { label: string; inches: number; max: number; index: number }) {
  const { c } = useTheme();
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withDelay(index * 40, withTiming(1, { duration: duration.base, easing: easing.emphasized }));
  }, [grow, index]);
  const H = 72;
  const h = Math.max(3, (inches / max) * H);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - grow.value) * h }] }));
  return (
    <View style={{ flex: 1, gap: space.xs }} accessible accessibilityLabel={`${label}: ${inches.toFixed(2)} inches of rain forecast`}>
      <Txt variant="footnote">{label}</Txt>
      <AnimatedNumber value={inches} decimals={2} suffix=" in" variant="numberL" />
      <View style={{ height: H, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: radius.sm, backgroundColor: c.surfaceSunken }}>
        <Animated.View style={[{ height: h, backgroundColor: c.waterTop, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm }, style]} />
      </View>
    </View>
  );
}

export function RainBars({ next24, next48 }: { next24: number; next48: number }) {
  const { c } = useTheme();
  const watch = THRESHOLDS.rainWatchInches24h;
  const max = Math.max(watch * 1.25, next24, next48);
  const lineY = 72 - (watch / max) * 72;
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: space.l }}>
        <Bar label="Next 24 hours" inches={next24} max={max} index={0} />
        <Bar label="Next 48 hours" inches={next48} max={max} index={1} />
      </View>
      {/* The 2-inch line (Watch threshold) across both bars. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 72 - lineY, height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: c.levels[1].fg }} />
    </View>
  );
}

/** Counts smoothly from the old value to the new one (base duration), drawn with tabular figures. */
export function AnimatedNumber({ value, decimals = 1, suffix = '', variant = 'numberL', color }: { value: number; decimals?: number; suffix?: string; variant?: TypeStyle; color?: string }) {
  const { c } = useTheme();
  const reduced = useMotionReduced();
  const v = useSharedValue(value);
  const [first] = useState(value);
  useEffect(() => {
    v.value = reduced ? value : withTiming(value, { duration: duration.base, easing: easing.standard });
  }, [value, reduced, v]);
  const props = useAnimatedProps(() => {
    const text = `${v.value.toFixed(decimals)}${suffix}`;
    return { text, defaultValue: text } as never;
  });
  return (
    <AnimatedInput
      editable={false}
      underlineColorAndroid="transparent"
      defaultValue={`${first.toFixed(decimals)}${suffix}`}
      animatedProps={props}
      style={[type[variant], { color: color ?? c.ink, padding: 0, margin: 0, fontFamily: type[variant].fontFamily ?? font.semibold }]}
      accessibilityLabel={`${value.toFixed(decimals)}${suffix}`}
    />
  );
}

const s = StyleSheet.create({
  vessel: { overflow: 'hidden', borderWidth: 1 },
});

/**
 * ScrubChart.tsx — the gauge page's water-height chart that you can drag through.
 *
 *   The line shows every recent reading, with a soft fill under it. Official action stage (dashed)
 *   and flood stage (solid) are drawn when they fall near the readings.
 *   Put a finger on the chart and slide: a guide line follows your finger and the label at the top
 *   shows the exact height and time of the nearest reading. The phone gives a light tick when you
 *   cross a flood-stage line. Let go and it goes back to the latest reading.
 *
 * The line is colored by how high the water is: calm teal below action stage, amber at action stage,
 * orange at flood stage, red at moderate flood and above (one vertical gradient with hard steps at the
 * official stage heights). When the chart appears, the line draws itself in from left to right.
 * `onScrub` lets the page's big number follow the finger.
 *
 * Screen readers get the same information as a sentence (lowest, highest, latest), since dragging
 * isn't practical with one.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import type { FloodStages, Reading } from '../../../../shared/data/types';
import { feet } from '../../../../shared/format';
import { clockTime } from '../../../../shared/time';
import { duration, easing, font, haptic, scene, space, useMotionReduced, useTheme } from '../../theme';
import { Txt } from '../ui/Text';

const PAD_X = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function ScrubChart({ series, stages, height = 200, onScrub, bare }: { series: Reading[]; stages: FloodStages | null; height?: number; onScrub?: (r: Reading | null) => void; bare?: boolean }) {
  const { c } = useTheme();
  const reduced = useMotionReduced();
  const draw = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) draw.set(withTiming(1, { duration: 500, easing: easing.emphasized }));
  }, [draw, reduced]);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState<number | null>(null);
  const lastSide = useRef<boolean | null>(null);

  const geo = useMemo(() => {
    if (series.length < 2 || width === 0) return null;
    const times = series.map((r) => Date.parse(r.time));
    const values = series.map((r) => r.value);
    // Include the stage lines in the range only when they're close to the readings (within 3 ft),
    // so a far-away flood stage doesn't squash the line flat.
    const lo0 = Math.min(...values);
    const hi0 = Math.max(...values);
    const near = [stages?.action, stages?.minor].filter((v): v is number => v != null && v >= lo0 - 3 && v <= hi0 + 3);
    const lo = Math.min(lo0, ...near) - 0.15;
    const hi = Math.max(hi0, ...near) + 0.15;
    const t0 = times[0];
    const tSpan = times[times.length - 1] - t0 || 1;
    const x = (t: number) => PAD_X + ((t - t0) / tSpan) * (width - PAD_X * 2);
    const y = (v: number) => PAD_TOP + (1 - (v - lo) / (hi - lo)) * (height - PAD_TOP - PAD_BOTTOM);
    const pts = series.map((r, i) => [x(times[i]), y(r.value)] as const);
    const line = `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')}`;
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${height - PAD_BOTTOM} L${pts[0][0].toFixed(1)} ${height - PAD_BOTTOM} Z`;
    const stageY = (v: number | null | undefined) => (v != null && v >= lo && v <= hi ? y(v) : null);
    const length = pts.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0) || 1;
    // Where the line's color changes, as a share of the chart's height (0 = top). Stage heights that are
    // above the chart clamp to the top, below it to the bottom, so the right color always shows.
    const at = (v: number | null | undefined) => (v == null ? null : Math.max(0, Math.min(1, y(v) / height)));
    const bands = { action: at(stages?.action), minor: at(stages?.minor), moderate: at(stages?.moderate) };
    return { pts, line, area, length, bands, actionY: stageY(stages?.action), floodY: stageY(stages?.minor), lo: lo0, hi: hi0 };
  }, [series, stages, width, height]);

  const pick = (px: number) => {
    if (!geo) return;
    let best = 0;
    for (let i = 1; i < geo.pts.length; i++) if (Math.abs(geo.pts[i][0] - px) < Math.abs(geo.pts[best][0] - px)) best = i;
    if (best !== index) {
      // A light tick when the reading crosses flood stage.
      const above = stages?.minor != null ? series[best].value >= stages.minor : null;
      if (above !== null && lastSide.current !== null && above !== lastSide.current) haptic.select();
      lastSide.current = above;
      setIndex(best);
      onScrub?.(series[best]);
    }
  };
  const release = () => {
    setIndex(null);
    onScrub?.(null);
  };
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: (geo?.length ?? 1) * (1 - draw.get()) }));
  // Hard color steps: the color of the band, from the top (highest water) down.
  const stops = geo
    ? ([
        [0, scene[3].accent],
        [geo.bands.moderate ?? 0, scene[3].accent],
        [geo.bands.moderate ?? 0, scene[2].accent],
        [geo.bands.minor ?? 0, scene[2].accent],
        [geo.bands.minor ?? 0, scene[1].accent],
        [geo.bands.action ?? 0, scene[1].accent],
        [geo.bands.action ?? 0, stages?.action != null || stages?.minor != null ? scene[0].accent : c.accent],
        [1, stages?.action != null || stages?.minor != null ? scene[0].accent : c.accent],
      ] as const)
    : [];

  const shown = index ?? series.length - 1;
  const reading = series[shown];
  const latest = series[series.length - 1];

  return (
    <View
      accessible
      accessibilityLabel={geo ? `Water height chart. Lowest ${feet(geo.lo)}, highest ${feet(geo.hi)}, latest ${feet(latest.value)} at ${clockTime(latest.time)}.` : 'Not enough readings for a chart.'}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s, minHeight: 28, display: bare ? 'none' : 'flex' }}>
        <Txt variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
          {reading ? feet(reading.value) : '—'}
        </Txt>
        <Txt variant="footnote">{reading ? `${index === null ? 'Latest · ' : ''}${clockTime(reading.time)}` : ''}</Txt>
      </View>
      <View
        style={{ height }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          lastSide.current = null;
          pick(e.nativeEvent.locationX);
        }}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}
        onResponderRelease={release}
        onResponderTerminate={release}
      >
        {geo ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="under" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.accent} stopOpacity={0.22} />
                <Stop offset="1" stopColor={c.accent} stopOpacity={0.02} />
              </LinearGradient>
              <LinearGradient id="stage" x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
                {stops.map(([o, col], i) => (
                  <Stop key={i} offset={o} stopColor={col} />
                ))}
              </LinearGradient>
            </Defs>
            <Line x1={0} x2={width} y1={height - PAD_BOTTOM} y2={height - PAD_BOTTOM} stroke={c.hairline} strokeWidth={1} />
            {geo.actionY !== null ? <StageLine y={geo.actionY} width={width} color={c.levels[1].fg} label="Action stage" dashed /> : null}
            {geo.floodY !== null ? <StageLine y={geo.floodY} width={width} color={c.levels[2].fg} label="Flood stage" /> : null}
            <Path d={geo.area} fill="url(#under)" />
            <AnimatedPath d={geo.line} fill="none" stroke="url(#stage)" strokeWidth={2.75} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={[geo.length, geo.length]} animatedProps={lineProps} />
            {index !== null ? <Line x1={geo.pts[shown][0]} x2={geo.pts[shown][0]} y1={PAD_TOP - 6} y2={height - PAD_BOTTOM} stroke={c.ink} strokeWidth={1} /> : null}
            <Circle cx={geo.pts[shown][0]} cy={geo.pts[shown][1]} r={index !== null ? 6 : 4.5} fill={c.surface} stroke={c.accent} strokeWidth={2.5} />
            <SvgText x={PAD_X} y={height - 6} fill={c.inkFaint} fontSize={11} fontFamily={font.medium}>
              {clockTime(series[0].time)}
            </SvgText>
            <SvgText x={width - PAD_X} y={height - 6} fill={c.inkFaint} fontSize={11} fontFamily={font.medium} textAnchor="end">
              {clockTime(latest.time)}
            </SvgText>
          </Svg>
        ) : null}
      </View>
      {bare ? null : (
        <Txt variant="footnote" style={{ marginTop: space.xs }}>
          Touch and drag along the chart to see each reading.
        </Txt>
      )}
    </View>
  );
}

function StageLine({ y, width, color, label, dashed }: { y: number; width: number; color: string; label: string; dashed?: boolean }) {
  return (
    <>
      <Line x1={0} x2={width} y1={y} y2={y} stroke={color} strokeWidth={1.25} strokeDasharray={dashed ? '4 4' : undefined} />
      <SvgText x={width - PAD_X} y={y - 4} fill={color} fontSize={11} fontFamily={font.semibold} textAnchor="end">
        {label}
      </SvgText>
    </>
  );
}

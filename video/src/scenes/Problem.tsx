/**
 * Problem.tsx — scenes 2 and 3 (0:14–0:30).
 * Scene 2: three cards stand for the three agencies (Weather Service, USGS, FEMA), each in a different
 * style and tiny expert type, scattered: "the information was out there, just scattered."
 * Scene 3: the cards slide together and fade, SC-5's 8 counties draw in from our own county outlines,
 * York County lights up, and a water line rises and wipes into the app.
 * (These are plain cards with words, not copies of agency websites or logos.)
 */
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import map from '../data/sc5-map.json';
import { clamp, color, ease, font } from '../theme';

const CARDS = [
  { title: 'National Weather Service', body: 'FLOOD WARNING ... UNTIL 800 PM EDT ... * WHAT...Flooding caused by excessive rainfall continues ... * WHERE...Portions of north central South Carolina ...', x: 180, y: 170, rot: -4, mono: true },
  { title: 'U.S. Geological Survey', body: 'Site 02146000 · 00065 Gage height, ft · 2024-09-27 07:30 EDT · 15.6 P · 00060 Discharge, ft³/s ...', x: 1080, y: 230, rot: 3, mono: true },
  { title: 'FEMA', body: 'Flood Hazard Zones · Zone AE: Special Flood Hazard Area subject to inundation by the 1% annual chance flood ...', x: 600, y: 600, rot: -2, mono: false },
];

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // The cards hold still for an extra 2.3 s (from 6 s) so the voiceover can finish before they gather.
  const raw = frame / fps;
  const t = raw < 6 ? raw : raw < 8.3 ? 6 : raw - 2.3;
  // 0–8 s: scattered cards. 8–10.5 s: they slide to the center and fade. 9.5–14 s: map draws in.
  const gather = interpolate(t, [8, 10.5], [0, 1], { ...clamp, easing: ease.inOut });
  const cardsOut = interpolate(t, [9.8, 10.6], [1, 0], clamp);
  const draw = interpolate(t, [9.6, 12.4], [0, 1], { ...clamp, easing: ease.out });
  const york = interpolate(t, [12.4, 13.2], [0, 1], clamp);
  const zoom = interpolate(t, [12.6, 15.6], [1, 2.4], { ...clamp, easing: ease.inOut });
  const yorkC = map.counties.find((c) => c.name === 'York')!;
  // The water line rises over the last second and becomes the app's own water (the match cut).
  const water = interpolate(t, [14.6, 16], [0, 1], { ...clamp, easing: ease.inOut });

  return (
    <AbsoluteFill style={{ background: color.bg }}>
      {CARDS.map((c, i) => (
        <div
          key={c.title}
          style={{
            position: 'absolute',
            left: interpolate(gather, [0, 1], [c.x, 760]),
            top: interpolate(gather, [0, 1], [c.y, 420]),
            width: 520,
            rotate: `${interpolate(gather, [0, 1], [c.rot, 0])}deg`,
            opacity: interpolate(t, [i * 0.5, i * 0.5 + 0.7], [0, 1], clamp) * cardsOut,
            background: i === 0 ? '#F4F4F2' : i === 1 ? '#EEF3F7' : '#FFFFFF',
            color: '#1B1F24',
            borderRadius: 10,
            padding: 28,
            boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontFamily: font.ui, fontWeight: 700, fontSize: 30 }}>{c.title}</div>
          <div style={{ fontFamily: c.mono ? 'Consolas, monospace' : font.ui, fontSize: 19, lineHeight: 1.45, marginTop: 12, color: '#4A5058' }}>{c.body}</div>
        </div>
      ))}

      {/* SC-5: the 8 counties draw in from HighWater's own outlines, then the camera moves to York County */}
      <svg viewBox={`0 0 ${map.width} ${map.height}`} style={{ position: 'absolute', left: 360, top: 90, width: 1200, height: 840, opacity: draw > 0 ? 1 : 0, scale: zoom, transformOrigin: `${(yorkC.cx / map.width) * 100}% ${(yorkC.cy / map.height) * 100}%` }}>
        {map.counties.map((c) => (
          <g key={c.fips}>
            <path d={c.d} fill={c.name === 'York' ? `rgba(94,200,229,${0.28 * york})` : 'rgba(94,200,229,0.04)'} stroke={color.accent} strokeWidth={2} strokeDasharray={c.length} strokeDashoffset={c.length * (1 - draw)} />
            <text x={c.cx} y={c.cy} textAnchor="middle" fontFamily={font.ui} fontWeight={700} fontSize={c.name === 'York' ? 24 : 18} fill={c.name === 'York' ? color.ink : color.muted} opacity={interpolate(t, [11.6, 12.4], [0, 1], clamp)}>
              {c.name}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ position: 'absolute', left: 140, top: 40, fontFamily: font.display, fontWeight: 600, fontSize: 56, color: color.ink, opacity: interpolate(t, [10.4, 11.2, 12.6, 13.2], [0, 1, 1, 0], clamp) }}>South Carolina's 5th District</div>

      {/* Rising water: the signature transition into the app */}
      <AbsoluteFill style={{ background: color.water, translate: `0 ${(1 - water) * 100}%` }} />
      <AbsoluteFill style={{ background: color.skyNormal[1], opacity: interpolate(t, [15.4, 16], [0, 1], clamp) }} />
    </AbsoluteFill>
  );
};

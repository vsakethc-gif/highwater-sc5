/**
 * Stage.tsx — the moving backdrop behind the phone in every app scene.
 *
 *   glow    the background light, which changes color with the danger level ({ t, color } keys)
 *   word    a giant word behind the phone ("LIVE", "WATCH" … "DANGER"), swapped at each key
 *   rain    how hard it rains in the background (0 to 1, keyed over time)
 *   pulses  moments (seconds) when the level jumps: a shockwave ring and a quick lightning flash
 *
 * Everything here is decoration around the real footage; nothing touches the app's own pixels.
 */
import { AbsoluteFill, interpolate, interpolateColors, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, ease, font } from '../theme';

export type Key<T> = { t: number; v: T };

/** The value of keyed steps at time t (holds each key until the next). */
const stepAt = <T,>(keys: Key<T>[], t: number) => keys.reduce((a, k) => (t >= k.t ? k : a), keys[0]);

const DROPS = Array.from({ length: 90 }, (_, i) => ({ x: random(`x${i}`) * 2200 - 140, speed: 0.75 + random(`s${i}`) * 0.6, len: 40 + random(`l${i}`) * 70, phase: random(`p${i}`), thresh: random(`t${i}`) }));

export const Stage: React.FC<{ glow: Key<string>[]; word?: Key<string>[]; wordColor?: Key<string>[]; rain?: Key<number>[]; pulses?: number[]; flashAt?: number[] }> = ({ glow, word, wordColor, rain, pulses = [], flashAt = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Glow: fade smoothly between keyed colors over 0.5 s.
  const glowColor = (() => {
    const i = glow.reduce((a, k, idx) => (t >= k.t ? idx : a), 0);
    const prev = glow[Math.max(0, i - 1)];
    const cur = glow[i];
    return i === 0 ? cur.v : interpolateColors(t, [cur.t, cur.t + 0.5], [prev.v, cur.v]);
  })();

  // Giant word: each new word slides up and in from a mask; the old one is replaced at once.
  const w = word ? stepAt(word, t) : null;
  const wIn = w ? interpolate(t, [w.t, w.t + 0.45], [0, 1], { ...clamp, easing: ease.out }) : 0;
  const wColor = wordColor ? stepAt(wordColor, t).v : '#FFFFFF';

  const rainAmt = rain ? (rain.length === 1 ? rain[0].v : interpolate(t, rain.map((k) => k.t), rain.map((k) => k.v), clamp)) : 0;

  const flash = flashAt.reduce((a, f) => Math.max(a, interpolate(t, [f, f + 0.04, f + 0.12, f + 0.18, f + 0.45], [0, 0.55, 0.1, 0.35, 0], clamp)), 0);

  return (
    <AbsoluteFill style={{ background: '#05080C', overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(1100px 820px at 50% 52%, ${glowColor} 0%, rgba(5,8,12,0) 72%)` }} />
      {w ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 300, height: 420, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
          <div
            key={w.v}
            style={{
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 380,
              lineHeight: 1.1,
              letterSpacing: -6,
              color: wColor,
              opacity: 0.16 * wIn,
              translate: `0 ${(1 - wIn) * 160}px`,
              scale: interpolate(t, [w.t, w.t + 6], [1, 1.06], clamp),
              whiteSpace: 'nowrap',
            }}
          >
            {w.v}
          </div>
        </div>
      ) : null}
      {rainAmt > 0 ? (
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
          {DROPS.filter((d) => d.thresh < rainAmt).map((d, i) => {
            const y = (((t * d.speed * 1.6 + d.phase) % 1) * 1400) - 200;
            return <line key={i} x1={d.x + y * 0.18} y1={y} x2={d.x + (y + d.len) * 0.18} y2={y + d.len} stroke="rgba(200,225,255,0.55)" strokeWidth={2} strokeLinecap="round" />;
          })}
        </svg>
      ) : null}
      {pulses.map((p) => {
        const k = interpolate(t, [p, p + 1.1], [0, 1], { ...clamp, easing: ease.out });
        if (t < p || k >= 1) return null;
        return <div key={p} style={{ position: 'absolute', left: 960 - 300, top: 540 - 300, width: 600, height: 600, borderRadius: '50%', border: `6px solid ${glowColor}`, scale: 0.6 + k * 2.6, opacity: (1 - k) * 0.9, filter: 'brightness(1.8)' }} />;
      })}
      {/* Vignette keeps the eye on the phone. */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)' }} />
      {flash > 0 ? <AbsoluteFill style={{ background: '#EAF2FF', opacity: flash, mixBlendMode: 'screen' }} /> : null}
    </AbsoluteFill>
  );
};

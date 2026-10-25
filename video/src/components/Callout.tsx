/**
 * Callout.tsx — a thin line and a label pointing at real UI in the footage ("Why this status",
 * "SIMULATION", "No route button"). It fades and slides in at `at` seconds, and out at `until`.
 */
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, color, ease, font } from '../theme';

export const Callout: React.FC<{
  label: string;
  /** Where the label sits on the 1920 x 1080 frame. */
  x: number;
  y: number;
  /** Where the line points to (on the phone). */
  toX: number;
  toY: number;
  at: number;
  until?: number;
  tint?: string;
}> = ({ label, x, y, toX, toY, at, until, tint = color.accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const appear = interpolate(t, [at, at + 0.5], [0, 1], { ...clamp, easing: ease.out });
  const leave = until ? interpolate(t, [until - 0.3, until], [1, 0], clamp) : 1;
  const opacity = appear * leave;
  return (
    <>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity }}>
        <line x1={x} y1={y} x2={x + (toX - x) * appear} y2={y + (toY - y) * appear} stroke={tint} strokeWidth={3} />
        <circle cx={toX} cy={toY} r={9 * appear} fill="none" stroke={tint} strokeWidth={3} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          translate: `${x > toX ? '0' : '-100%'} -50%`,
          opacity,
          fontFamily: font.ui,
          fontWeight: 700,
          fontSize: 36,
          color: color.ink,
          background: color.surface,
          border: `2px solid ${tint}`,
          borderRadius: 16,
          padding: '12px 22px',
          maxWidth: 420,
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
    </>
  );
};

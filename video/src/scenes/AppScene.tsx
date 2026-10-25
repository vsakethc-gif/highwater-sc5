/**
 * AppScene.tsx — the app scenes: REAL HighWater footage in a floating phone at the center of the
 * frame, on a moving Stage (color, giant word, rain, pulses), with short callouts pointing at the
 * real UI. Very little to read: the voice and the app do the talking.
 *
 * A scene can cut between a few moments of the footage ("shots"). Each shot plays (optionally faster
 * or slower) or holds still, with an optional slow camera move inside the screen.
 */
import type { ReactNode } from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { Callout } from '../components/Callout';
import { type CameraKey, cameraAt, PHONE_H, PHONE_W, Phone } from '../components/Phone';
import { type Key, Stage } from '../components/Stage';
import { clamp, ease } from '../theme';

export const PHONE_LEFT = Math.round(960 - (PHONE_W + 24) / 2);
export const PHONE_TOP = 50;
const K = PHONE_H / 1688;

/** One moment of the footage: starts `at` seconds into the scene, from `from` seconds of `clip`. */
export type PhoneShot = { at: number; clip: string; from: number; rate?: number; freeze?: boolean; camera?: CameraKey[]; devButtons?: boolean };
/** A callout: `point` is a spot in the 780 x 1688 footage. */
export type CalloutSpec = { label: string; at: number; until?: number; point: [number, number]; y?: number; tint?: string };

const FADE = 0.25;

const onScreen = (p: [number, number], cam: { s: number; x: number; y: number }): [number, number] => {
  const half = { w: 390 / cam.s, h: 844 / cam.s };
  const cx = Math.min(780 - half.w, Math.max(half.w, cam.x));
  const cy = Math.min(1688 - half.h, Math.max(half.h, cam.y));
  return [PHONE_LEFT + 12 + PHONE_W / 2 + (p[0] - cx) * cam.s * K, PHONE_TOP + 12 + PHONE_H / 2 + (p[1] - cy) * cam.s * K];
};

export const AppScene: React.FC<{
  shots: PhoneShot[];
  glow: Key<string>[];
  word?: Key<string>[];
  wordColor?: Key<string>[];
  rain?: Key<number>[];
  pulses?: number[];
  flashAt?: number[];
  callouts?: CalloutSpec[];
  extra?: ReactNode;
}> = ({ shots, glow, word, wordColor, rain, pulses = [], flashAt, callouts = [], extra }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const active = shots.reduce((a, s, i) => (t >= s.at ? i : a), 0);
  const cam = cameraAt(shots[active].camera, t - shots[active].at);

  // The phone rises in, tilted back, then floats and sways a little the whole time.
  const enter = interpolate(t, [0, 0.8], [0, 1], { ...clamp, easing: ease.out });
  const punch = pulses.reduce((a, p) => a + interpolate(t, [p, p + 0.08, p + 0.45], [0, 0.045, 0], clamp), 0);
  const shake = pulses.reduce((a, p) => a + interpolate(t, [p, p + 0.4], [1, 0], clamp) * (t >= p ? 1 : 0), 0);
  const sx = Math.sin(t * 60) * 6 * shake;
  const sy = Math.cos(t * 53) * 5 * shake;
  const floatY = Math.sin(t * 1.1) * 7;
  const rotY = Math.sin(t * 0.55) * 4 * (1 - 0.4 * shake);
  const exit = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <Stage glow={glow} word={word} wordColor={wordColor} rain={rain} pulses={pulses} flashAt={flashAt} />
      <AbsoluteFill style={{ perspective: 1800 }}>
        <div
          style={{
            position: 'absolute',
            left: PHONE_LEFT,
            top: PHONE_TOP,
            width: PHONE_W + 24,
            height: PHONE_H + 24,
            opacity: enter,
            transform: `translate(${sx}px, ${(1 - enter) * 140 + floatY + sy}px) rotateX(${(1 - enter) * 28}deg) rotateY(${rotY}deg) scale(${(0.9 + 0.1 * enter) * (1 + punch)})`,
          }}
        >
          {shots.map((s, i) => {
            const startF = Math.round(s.at * fps);
            const endF = i + 1 < shots.length ? Math.round((shots[i + 1].at + FADE) * fps) : durationInFrames;
            const o = i === 0 ? 1 : interpolate(t, [s.at, s.at + FADE], [0, 1], clamp);
            return (
              <Sequence key={i} from={startF} durationInFrames={endF - startF} layout="none">
                <div style={{ position: 'absolute', inset: 0, opacity: o }}>
                  <Phone src={s.clip} from={s.from} freeze={s.freeze} camera={s.camera} playbackRate={s.rate} devButtons={s.devButtons} />
                </div>
              </Sequence>
            );
          })}
        </div>
      </AbsoluteFill>
      {callouts.map((c) => {
        const [toX, toY] = onScreen(c.point, cam);
        return <Callout key={c.label} label={c.label} x={PHONE_LEFT + PHONE_W + 110} y={c.y ?? toY} toX={toX} toY={toY} at={c.at} until={c.until} tint={c.tint} />;
      })}
      {extra}
    </AbsoluteFill>
  );
};

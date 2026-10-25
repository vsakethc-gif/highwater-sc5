/**
 * Phone.tsx — a plain rounded phone frame around REAL app footage (no device artwork or logos).
 * The footage itself is never changed: it's only placed and framed (zoomed/panned like a camera). In my
 * phone recording, the two floating developer buttons from the test build are softly blurred out (devButtons).
 *
 *   src       a phone screen recording in public/footage/ (converted by scripts/ingest-phone.mjs)
 *   from      seconds into the recording to start
 *   camera    optional camera moves inside the screen: keyframes { t (s into the scene), s (zoom),
 *             x, y (the point of the recording, in 780 x 1688 pixels, that sits at the center) }
 *   freeze    true = hold the frame at `from` (for screens that just sit still in the recording)
 */
import { Video } from '@remotion/media';
import type { CSSProperties } from 'react';
import { Freeze, getStaticFiles, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, color, ease } from '../theme';

export const PHONE_H = 920;
export const PHONE_W = Math.round((PHONE_H * 780) / 1688);
/** Recording pixels -> phone-frame pixels. */
const K = PHONE_H / 1688;

export type CameraKey = { t: number; s: number; x: number; y: number };

/** Where the test build's floating buttons sit, in recording pixels (center x, y and radius). */
const DEV_BUTTONS = [
  { x: 70, y: 485, r: 72 },
  { x: 75, y: 710, r: 76 },
];

export const cameraAt = (camera: CameraKey[] | undefined, t: number) => {
  if (!camera?.length) return { s: 1, x: 390, y: 844 };
  const ts = camera.map((k) => k.t);
  const opts = { ...clamp, easing: ease.inOut };
  return {
    s: camera.length === 1 ? camera[0].s : interpolate(t, ts, camera.map((k) => k.s), opts),
    x: camera.length === 1 ? camera[0].x : interpolate(t, ts, camera.map((k) => k.x), opts),
    y: camera.length === 1 ? camera[0].y : interpolate(t, ts, camera.map((k) => k.y), opts),
  };
};

export const Phone: React.FC<{ src: string; from?: number; camera?: CameraKey[]; freeze?: boolean; style?: CSSProperties; playbackRate?: number; devButtons?: boolean }> = ({
  src,
  from = 0,
  camera,
  freeze,
  style,
  playbackRate = 1,
  devButtons,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = cameraAt(camera, frame / fps);
  // Keep the camera from showing past the edge of the screen.
  const half = { w: 390 / cam.s, h: 844 / cam.s };
  const cx = Math.min(780 - half.w, Math.max(half.w, cam.x));
  const cy = Math.min(1688 - half.h, Math.max(half.h, cam.y));
  const has = getStaticFiles().some((f) => f.name === src);

  const screen = (
    <div style={{ position: 'absolute', width: PHONE_W, height: PHONE_H, transformOrigin: '50% 50%', transform: `scale(${cam.s}) translate(${(390 - cx) * K}px, ${(844 - cy) * K}px)` }}>
      <Video src={staticFile(src)} trimBefore={Math.round(from * fps)} playbackRate={playbackRate} muted style={{ width: PHONE_W, height: PHONE_H, objectFit: 'cover' }} />
      {(devButtons ? DEV_BUTTONS : []).map((b) => (
        <div key={b.y} style={{ position: 'absolute', left: (b.x - b.r) * K, top: (b.y - b.r) * K, width: b.r * 2 * K, height: b.r * 2 * K, borderRadius: '50%', backdropFilter: 'blur(26px) saturate(0.5)', WebkitMaskImage: 'radial-gradient(circle, #000 45%, transparent 72%)', maskImage: 'radial-gradient(circle, #000 45%, transparent 72%)' }} />
      ))}
    </div>
  );

  return (
    <div style={{ width: PHONE_W + 24, height: PHONE_H + 24, padding: 12, borderRadius: 64, background: '#0B1016', border: `2px solid ${color.hairline}`, boxShadow: '0 40px 80px rgba(0,0,0,0.45)', ...style }}>
      <div style={{ position: 'relative', width: PHONE_W, height: PHONE_H, borderRadius: 52, overflow: 'hidden', background: '#000' }}>
        {/* Until a recording is added and converted (scripts/ingest-phone.mjs), show which clip goes here. */}
        {!has ? (
          <div style={{ width: PHONE_W, height: PHONE_H, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40, color: color.faint, fontSize: 30, fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
            Waiting for {src.replace('footage/', '')}
          </div>
        ) : freeze ? (
          <Freeze frame={0}>{screen}</Freeze>
        ) : (
          screen
        )}
      </div>
    </div>
  );
};

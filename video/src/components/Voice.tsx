/**
 * Voice.tsx — my voice and the captions.
 *
 * VoiceTrack plays each kept piece of my recorded voice at its place in the video (edit.ts decides
 * which pieces), with a very short fade at each cut so there are no clicks.
 * Captions shows the matching words at the bottom, one line at a time. Each line's timing is spread
 * across its piece by length, then checked against a fresh transcript of the finished audio.
 */
import { Audio } from '@remotion/media';
import { interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CAPTIONS, FPS, TIMELINE } from '../edit';
import { color, font } from '../theme';

const FADE = 0.06;

export const VoiceTrack: React.FC = () => (
  <>
    {TIMELINE.flatMap((s) =>
      s.pieces.map((p) => {
        const len = p.out - p.in;
        return (
          <Sequence key={`${s.id}-${p.in}`} from={Math.round((s.start + p.at) * FPS)} durationInFrames={Math.round(len * FPS)} layout="none">
            <Audio
              src={staticFile('footage/voice.wav')}
              trimBefore={Math.round(p.in * FPS)}
              volume={(f) => interpolate(f / FPS, [0, FADE, len - FADE, len], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
            />
          </Sequence>
        );
      }),
    )}
  </>
);

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const line = CAPTIONS.find((c) => t >= c.start && t < c.end);
  if (!line) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 22, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 36, lineHeight: 1.25, color: color.ink, background: 'rgba(7,11,16,0.82)', borderRadius: 12, padding: '8px 22px', maxWidth: 1500, textAlign: 'center' }}>{line.text}</div>
    </div>
  );
};

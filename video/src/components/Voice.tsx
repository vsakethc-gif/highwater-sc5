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
import { CAPTIONS, FPS, TIMELINE, VOICE_FILE } from '../edit';
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
              src={staticFile(VOICE_FILE)}
              trimBefore={Math.round(p.in * FPS)}
              volume={(f) => interpolate(f / FPS, [0, FADE, len - FADE, len], [0, p.gain ?? 1, p.gain ?? 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
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

/**
 * Background music: "Inspired" by Kevin MacLeod (incompetech.com, CC BY 4.0), kept about 18 dB under
 * my voice. It fades in, dips lower for the Danger and tornado moments so they feel serious, comes
 * back up, and fades out at the end.
 */
export const Music: React.FC = () => {
  const { fps } = useVideoConfig();
  const at = (id: (typeof TIMELINE)[number]['id']) => TIMELINE.find((s) => s.id === id)!;
  const danger = at('scenario').start + 10.5;
  const calm = at('tornado').start + at('tornado').duration;
  const end = TIMELINE[TIMELINE.length - 1].start + TIMELINE[TIMELINE.length - 1].duration;
  const BED = 0.055;
  const LOW = 0.028;
  return (
    <Audio
      src={staticFile('footage/music.wav')}
      volume={(f) => interpolate(f / fps, [0, 2.5, danger, danger + 1.2, calm, calm + 1.5, end - 3, end], [0, BED, BED, LOW, LOW, BED, BED, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
    />
  );
};

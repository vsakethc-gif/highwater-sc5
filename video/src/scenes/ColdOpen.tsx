/**
 * ColdOpen.tsx — scene 1 (0:00–0:14). Quiet, respectful: NOAA's satellite image of Helene at landfall,
 * then the USGS animation of rain and rivers along its path, both slowly pushed in under a dark veil,
 * with short fact cards in our own words (each with its source line). My voice says the opening line.
 */
import { Video } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, color, ease, font } from '../theme';

const CARDS: { text: string; source: string; at: number }[] = [
  { text: '49 people died in South Carolina.', source: 'SC Emergency Management Division', at: 5.3 },
  { text: 'In SC-5, the Wateree River rose past major flood stage.', source: 'USGS river gauge data', at: 7.7 },
];

const FactCard: React.FC<{ text: string; source: string; at: number; until: number }> = ({ text, source, at, until }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const opacity = interpolate(t, [at, at + 0.8, until - 0.6, until], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 140, bottom: 150, width: 1200, opacity, translate: `0 ${interpolate(t, [at, at + 0.8], [16, 0], { ...clamp, easing: ease.out })}px` }}>
      <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 64, lineHeight: 1.12, color: color.ink }}>{text}</div>
      <div style={{ fontFamily: font.ui, fontSize: 28, color: color.muted, marginTop: 18, letterSpacing: 0.5 }}>Source: {source}</div>
    </div>
  );
};

export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{ background: color.bg }}>
      {/* NOAA GOES-16 image at landfall, slow push-in, first 4.5 s */}
      <Sequence durationInFrames={Math.round(4.8 * fps)}>
        <AbsoluteFill style={{ opacity: interpolate(t, [0, 1, 4.2, 4.8], [0, 1, 1, 0], clamp) }}>
          <Img src={staticFile('footage/noaa-helene-landfall.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover', scale: interpolate(t, [0, 4.8], [1.05, 1.15], clamp) }} />
        </AbsoluteFill>
      </Sequence>
      {/* USGS VizLab animation: rain and river gauges along Helene's path */}
      <Sequence from={Math.round(4.2 * fps)}>
        <AbsoluteFill style={{ opacity: interpolate(t, [4.2, 5.2], [0, 1], clamp) }}>
          <Video src={staticFile('footage/usgs-helene-animation.mp4')} trimBefore={Math.round(38 * fps)} playbackRate={1} muted style={{ position: 'absolute', left: 0, top: -420, width: 1920, height: 1920, scale: interpolate(t, [4.2, 10.4], [1.0, 1.08], clamp) }} />
        </AbsoluteFill>
      </Sequence>
      {/* Dark veil so the cards read */}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(7,11,16,0.25) 0%, rgba(7,11,16,0.55) 55%, rgba(7,11,16,0.9) 100%)' }} />
      {CARDS.map((c, i) => (
        <FactCard key={c.text} {...c} until={i + 1 < CARDS.length ? CARDS[i + 1].at : durationInFrames / fps - 0.2} />
      ))}
      <div style={{ position: 'absolute', right: 60, bottom: 40, fontFamily: font.ui, fontSize: 22, color: color.faint }}>Imagery: NOAA/NESDIS, USGS</div>
    </AbsoluteFill>
  );
};

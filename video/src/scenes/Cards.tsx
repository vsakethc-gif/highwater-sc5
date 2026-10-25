/**
 * Cards.tsx — the text scenes: the name lower-third (intro overlay), "how it works", "how I built it",
 * "what I learned", and the end card. They sit on the moving Stage.
 */
import { Video } from '@remotion/media';
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { PHONE_H, PHONE_W } from '../components/Phone';
import { clamp, color, ease, font } from '../theme';

const useT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

/** Scene 4 overlay: name lower-third on the left. */
export const NameThird: React.FC<{ name: string }> = ({ name }) => {
  const t = useT();
  const o = interpolate(t, [0.4, 1.1], [0, 1], { ...clamp, easing: ease.out });
  return (
    <div style={{ position: "absolute", left: 120, bottom: 120, opacity: o, translate: `${(1 - o) * -20}px 0`, borderLeft: `4px solid ${color.accent}`, paddingLeft: 24 }}>
      <div style={{ fontFamily: font.ui, fontWeight: 700, fontSize: 44, color: color.ink }}>{name}</div>
      <div style={{ fontFamily: font.ui, fontSize: 30, lineHeight: 1.3, color: color.muted, marginTop: 6 }}>
        York County, SC
        <br />
        Congressional App Challenge 2026
      </div>
    </div>
  );
};

const Kicker: React.FC<{ children: string }> = ({ children }) => (
  <div style={{ fontFamily: font.ui, fontWeight: 700, fontSize: 28, letterSpacing: 2, color: color.accent, textTransform: 'uppercase' }}>{children}</div>
);

/** "How it works": official data → written rules → status (or "can't confirm"), lit up as I say it. */
export const HowItWorks: React.FC<{ confirmAt: number }> = ({ confirmAt }) => {
  const t = useT();
  const steps = [
    { title: 'Official data', body: 'NWS · USGS · FEMA · Census' },
    { title: 'Written rules', body: 'Not AI. Every rule is published.' },
    { title: 'Status', body: 'Normal · Watch · Warning · Danger' },
  ];
  const confirm = interpolate(t, [confirmAt, confirmAt + 0.6], [0, 1], { ...clamp, easing: ease.out });
  return (
    <AbsoluteFill style={{ background: 'transparent', padding: '190px 140px' }}>
      <Kicker>How it works</Kicker>
      <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 96, color: color.ink, marginTop: 18 }}>Written rules, not AI</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 80 }}>
        {steps.map((s, i) => {
          const o = interpolate(t, [1.2 + i * 0.9, 1.8 + i * 0.9], [0, 1], { ...clamp, easing: ease.out });
          return (
            <div key={s.title} style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: o, translate: `0 ${(1 - o) * 12}px` }}>
              <div style={{ background: color.surface, border: `2px solid ${color.hairline}`, borderRadius: 20, padding: '28px 32px', width: 400, boxSizing: 'border-box' }}>
                <div style={{ fontFamily: font.ui, fontWeight: 700, fontSize: 40, color: color.ink }}>{s.title}</div>
                <div style={{ fontFamily: font.ui, fontSize: 28, color: color.muted, marginTop: 8 }}>{s.body}</div>
              </div>
              {i < steps.length - 1 ? <div style={{ fontFamily: font.ui, fontSize: 52, color: color.accent, width: 52, textAlign: 'center' }}>→</div> : null}
            </div>
          );
        })}
      </div>
      <div style={{ marginLeft: 2 * (400 + 28 + 52 + 28), marginTop: 28, width: 400, opacity: confirm, translate: `0 ${(1 - confirm) * 12}px`, border: `2px dashed ${color.faint}`, borderRadius: 20, padding: '22px 32px', boxSizing: 'border-box' }}>
        <div style={{ fontFamily: font.ui, fontWeight: 700, fontSize: 34, color: color.ink }}>Data missing?</div>
        <div style={{ fontFamily: font.ui, fontSize: 28, color: color.muted, marginTop: 6 }}>It says "can't confirm", never "all clear".</div>
      </div>
    </AbsoluteFill>
  );
};

/** What it's built with. */
export const Built: React.FC = () => {
  const t = useT();
  const tools = ['TypeScript', 'React Native + Expo', 'Vite', 'MapLibre', 'Supabase', 'Cloudflare Workers', 'Public data: NWS, USGS, NOAA, FEMA, Census'];
  return (
    <AbsoluteFill style={{ background: 'transparent', padding: '0 140px', justifyContent: 'center' }}>
      <Kicker>How I built it</Kicker>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, marginTop: 40, maxWidth: 1640 }}>
        {tools.map((x, i) => (
          <div key={x} style={{ opacity: interpolate(t, [0.6 + i * 0.35, 0.9 + i * 0.35], [0, 1], clamp), scale: interpolate(t, [0.6 + i * 0.35, 0.85 + i * 0.35, 1.05 + i * 0.35], [0.85, 1.06, 1], clamp), fontFamily: font.ui, fontWeight: 600, fontSize: 52, color: color.ink, background: color.surface, border: `2px solid ${color.hairline}`, borderRadius: 999, padding: '18px 38px' }}>
            {x}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** What I learned, in my own words, shown on screen word by word. */
const LESSON = 'The best apps are the ones that are simple and solve important problems, not the ones that have thousands of different features.';
export const Learned: React.FC<{ quoteAt: number; step?: number }> = ({ quoteAt, step = 0.17 }) => {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: 'transparent', padding: '0 180px', justifyContent: 'center' }}>
      <div style={{ opacity: interpolate(t, [0.1, 0.6], [0, 1], clamp) }}>
        <Kicker>What I learned</Kicker>
      </div>
      <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 80, lineHeight: 1.15, color: color.ink, marginTop: 30, maxWidth: 1500 }}>
        {`“${LESSON}”`.split(' ').map((word, i) => {
          const k = interpolate(t, [quoteAt + i * step, quoteAt + i * step + 0.4], [0, 1], { ...clamp, easing: ease.out });
          return (
            <span key={i} style={{ display: 'inline-block', opacity: k, translate: `0 ${(1 - k) * 28}px`, marginRight: 22 }}>
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * The intro's first seconds: me on camera saying who I am, in a card where the phone sits, before it
 * fades to the app. `from` is where to start in public/footage/selfie.mp4 (the clip is muted; my
 * voice comes from the cleaned voice track).
 */
export const SelfieCard: React.FC<{ from: number; until: number }> = ({ from, until }) => {
  const t = useT();
  const { fps } = useVideoConfig();
  const o = interpolate(t, [0, 0.5, until - 0.4, until], [0, 1, 1, 0], clamp);
  if (t > until) return null;
  return (
    <div style={{ position: 'absolute', left: Math.round(960 - (PHONE_W + 24) / 2), top: 50, width: PHONE_W + 24, height: PHONE_H + 24, borderRadius: 48, overflow: 'hidden', opacity: o, border: `2px solid ${color.hairline}`, background: '#000', scale: interpolate(t, [0, until], [1, 1.03], clamp) }}>
      <Video src={staticFile('footage/selfie.mp4')} trimBefore={Math.round(from * fps)} muted style={{ height: PHONE_H + 24, width: ((PHONE_H + 24) * 9) / 16, marginLeft: -(((PHONE_H + 24) * 9) / 16 - (PHONE_W + 24)) / 2 }} />
    </div>
  );
};

/** The end card. */
export const EndCard: React.FC = () => {
  const t = useT();
  const o = interpolate(t, [0, 0.8], [0, 1], { ...clamp, easing: ease.out });
  return (
    <AbsoluteFill style={{ background: 'transparent', opacity: o, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 120, color: color.ink }}>HighWater</div>
      <div style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 40, color: color.accent, marginTop: 20 }}>vsakethc-gif.github.io/highwater-sc5</div>
      <div style={{ fontFamily: font.ui, fontSize: 32, color: color.muted, marginTop: 12 }}>github.com/vsakethc-gif/highwater-sc5</div>
      <div style={{ fontFamily: font.ui, fontWeight: 700, fontSize: 36, color: color.ink, marginTop: 70 }}>Not an official warning system. In an emergency, call 911.</div>
      <div style={{ fontFamily: font.ui, fontSize: 22, color: color.faint, marginTop: 50 }}>Footage: NOAA/NESDIS, USGS · App footage: real HighWater app recordings</div>
    </AbsoluteFill>
  );
};

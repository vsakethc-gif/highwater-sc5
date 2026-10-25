/**
 * HighWater.tsx — the whole demo video. Scene lengths come from my voiceover (edit.ts), so every scene
 * is exactly as long as what I say in it, plus a short breath.
 *
 * App footage: smooth recordings of the HighWater phone app's own code (capture/app.mjs) and my phone
 * screen recording (the district map). Shots give the moment of a clip to show (`from`, in seconds);
 * callout points are spots in the 780 x 1688 footage. Times inside a scene are in seconds.
 */
import { AbsoluteFill, Series } from 'remotion';
import { Stage } from './components/Stage';
import { Captions, Music, VoiceTrack } from './components/Voice';
import { FPS, pieceAt, sceneLength, type Shot } from './edit';
import { AppScene } from './scenes/AppScene';
import { Built, EndCard, HowItWorks, Learned, NameThird, SelfieCard } from './scenes/Cards';
import { ColdOpen } from './scenes/ColdOpen';
import { Problem } from './scenes/Problem';
import { color } from './theme';

const frames = (id: Shot['id']) => Math.round(sceneLength(id) * FPS);

/** Background light for each level, and the level's own color for the giant word. */
const GLOW = { normal: '#0F4A5C', watch: '#5C4A0C', warning: '#6E3410', danger: '#701430', calm: '#16384A' };
const WORD = { normal: color.normal, watch: color.watch, warning: color.warning, danger: color.danger };

// The storm replay plays 1.6x from 4 s into the scene; in the clip the level reaches Watch at
// 3.25 s, Warning at 7.5 s and Danger at 11.75 s (measured from the footage's colors).
const STORM_START = 4.0;
const STORM_RATE = 1.6;
const stormAt = (clipT: number) => STORM_START + clipT / STORM_RATE;
const [WATCH, WARNING, DANGER] = [stormAt(3.25), stormAt(7.5), stormAt(11.75)];

export const HighWater: React.FC<{ name: string }> = ({ name }) => {
  const live2 = pieceAt('live', 1);
  const helene = pieceAt('scenario', 3);
  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <Series>
        <Series.Sequence name="Cold open: Helene" durationInFrames={frames('cold')}>
          <ColdOpen />
        </Series.Sequence>
        <Series.Sequence name="Problem + map into the app" durationInFrames={frames('problem')}>
          <Problem />
        </Series.Sequence>
        <Series.Sequence name="Intro" durationInFrames={frames('intro')}>
          <AppScene
            shots={[{ at: 0, clip: 'footage/app-live.mp4', from: 0.6, freeze: true, camera: [{ t: 0, s: 1, x: 390, y: 844 }, { t: 15, s: 1.08, x: 390, y: 700 }] }]}
            glow={[{ t: 0, v: GLOW.normal }]}
            word={[{ t: 0.3, v: 'HighWater' }]}
            wordColor={[{ t: 0, v: color.accent }]}
            extra={
              <>
                <SelfieCard from={1.38} until={4.4} />
                <NameThird name={name} />
              </>
            }
          />
        </Series.Sequence>
        <Series.Sequence name="Live status" durationInFrames={frames('live')}>
          <AppScene
            shots={[
              { at: 0, clip: 'footage/app-live.mp4', from: 0.6, freeze: true, camera: [{ t: 0, s: 1, x: 390, y: 844 }, { t: 8, s: 1.12, x: 0, y: 600 }] },
              { at: live2 - 0.3, clip: 'footage/app-live.mp4', from: 2.0, rate: 1.4 },
            ]}
            glow={[{ t: 0, v: GLOW.normal }]}
            word={[{ t: 0.2, v: 'LIVE' }]}
            wordColor={[{ t: 0, v: WORD.normal }]}
            pulses={[0.4]}
            callouts={[
              { label: 'Normal · Watch · Warning · Danger', at: 2.4, until: live2 - 0.4, point: [260, 330] },
              { label: 'Every reason, with its source', at: live2 + 0.4, until: live2 + 2.8, point: [300, 1000] },
              { label: 'A real USGS river gauge', at: live2 + 6.4, until: live2 + 9.3, point: [420, 720] },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="Scenario Mode: storm + Helene" durationInFrames={frames('scenario')}>
          <AppScene
            shots={[
              { at: 0, clip: 'footage/app-storm.mp4', from: 0.2, freeze: true, camera: [{ t: 0, s: 1, x: 390, y: 844 }] },
              { at: STORM_START, clip: 'footage/app-storm.mp4', from: 0, rate: STORM_RATE },
              { at: helene - 0.2, clip: 'footage/app-helene.mp4', from: 0.4 },
            ]}
            glow={[{ t: 0, v: GLOW.normal }, { t: WATCH, v: GLOW.watch }, { t: WARNING, v: GLOW.warning }, { t: DANGER, v: GLOW.danger }]}
            word={[{ t: 0.2, v: 'NORMAL' }, { t: WATCH, v: 'WATCH' }, { t: WARNING, v: 'WARNING' }, { t: DANGER, v: 'DANGER' }]}
            wordColor={[{ t: 0, v: WORD.normal }, { t: WATCH, v: WORD.watch }, { t: WARNING, v: WORD.warning }, { t: DANGER, v: WORD.danger }]}
            rain={[{ t: 0, v: 0 }, { t: WATCH, v: 0.3 }, { t: WARNING, v: 0.6 }, { t: DANGER, v: 1 }]}
            pulses={[WATCH, WARNING, DANGER]}
            flashAt={[DANGER, helene + 0.1]}
            callouts={[
              { label: 'SIMULATION, not live data', at: 4.4, until: 7.9, point: [230, 52], tint: color.sim },
              { label: 'Drag the timeline', at: 8.3, until: DANGER - 0.2, point: [200, 1470], tint: color.sim },
              { label: 'Hurricane Helene: real archived data', at: helene + 0.5, until: helene + 4.0, point: [230, 52], tint: color.sim },
              { label: 'Every reason, with its source', at: helene + 4.6, until: helene + 8.6, point: [330, 700], tint: color.danger },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="Tornado: take shelter" durationInFrames={frames('tornado')}>
          <AppScene
            shots={[
              { at: 0, clip: 'footage/app-tornado.mp4', from: 0.2 },
              { at: 3.0, clip: 'footage/app-tornado.mp4', from: 0.6, freeze: true, camera: [{ t: 0, s: 1, x: 390, y: 844 }, { t: 1.2, s: 1.22, x: 0, y: 1230 }] },
            ]}
            glow={[{ t: 0, v: GLOW.warning }]}
            word={[{ t: 0.2, v: 'SHELTER' }]}
            wordColor={[{ t: 0, v: WORD.warning }]}
            rain={[{ t: 0, v: 0.7 }]}
            pulses={[0.3]}
            flashAt={[0.3]}
            callouts={[{ label: 'No route out: stay and take shelter', at: 4.3, until: 8.1, point: [330, 1250], tint: color.warning }]}
          />
        </Series.Sequence>
        <Series.Sequence name="District map" durationInFrames={frames('map')}>
          <AppScene
            shots={[
              { at: 0, clip: 'footage/phone-all.mp4', from: 141.2, devButtons: true, camera: [{ t: 1, s: 1, x: 390, y: 844 }, { t: 3.5, s: 1.3, x: 330, y: 740 }, { t: 5.6, s: 1.3, x: 330, y: 740 }, { t: 7, s: 1, x: 390, y: 844 }] },
              { at: 8.6, clip: 'footage/phone-all.mp4', from: 150, freeze: true, devButtons: true },
            ]}
            glow={[{ t: 0, v: GLOW.calm }]}
            word={[{ t: 0.2, v: 'SC-5' }]}
            wordColor={[{ t: 0, v: color.accent }]}
            callouts={[
              { label: 'Live river gauges', at: 3.6, until: 5.8, point: [173, 583] },
              { label: 'Map layers', at: 7.2, until: 13.4, point: [600, 1450] },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="Report a problem" durationInFrames={frames('report')}>
          <AppScene
            shots={[{ at: 0, clip: 'footage/app-report.mp4', from: 1.0, freeze: true, camera: [{ t: 0.5, s: 1, x: 390, y: 844 }, { t: 3.5, s: 1.15, x: 0, y: 650 }, { t: 7.5, s: 1.15, x: 0, y: 650 }, { t: 10.5, s: 1.15, x: 780, y: 1250 }] }]}
            glow={[{ t: 0, v: GLOW.calm }]}
            word={[{ t: 0.2, v: 'REPORT' }]}
            wordColor={[{ t: 0, v: color.accent }]}
            callouts={[
              { label: 'Call 911 first if anyone is in danger', at: 0.9, until: 3.0, point: [271, 322], tint: color.danger },
              { label: 'Streetlight out', at: 3.4, until: 7.4, point: [203, 577] },
              { label: 'No account. No personal info.', at: 7.8, until: 13.3, point: [560, 1358] },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="How it works" durationInFrames={frames('how')}>
          <Stage glow={[{ t: 0, v: GLOW.calm }]} rain={[{ t: 0, v: 0.15 }]} />
          <HowItWorks confirmAt={pieceAt('how', 0) + 0.3} />
        </Series.Sequence>
        <Series.Sequence name="Built with" durationInFrames={frames('built')}>
          <Stage glow={[{ t: 0, v: GLOW.calm }]} />
          <Built />
        </Series.Sequence>
        <Series.Sequence name="What I learned" durationInFrames={frames('learned')}>
          <Stage glow={[{ t: 0, v: GLOW.normal }]} />
          <Learned quoteAt={pieceAt('learned', 0) + 1.4} step={0.33} />
        </Series.Sequence>
        <Series.Sequence name="End card" durationInFrames={frames('end')}>
          <Stage glow={[{ t: 0, v: GLOW.calm }]} />
          <EndCard />
        </Series.Sequence>
      </Series>
      <Music />
      <VoiceTrack />
      <Captions />
    </AbsoluteFill>
  );
};

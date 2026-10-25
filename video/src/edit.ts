/**
 * edit.ts — the edit decision list: which pieces of my recorded voice play in each scene, and the
 * caption text for each piece.
 *
 * My voice comes from a video of me reading the script (VOICEOVER.md), cleaned by scripts/denoise.mjs
 * into public/footage/voice2.wav. Each piece is [start, end] in seconds of that recording; retakes
 * and pauses are left out. `gain` evens out lines that came out a little quieter or louder. Caption
 * text is what I said, with names spelled right.
 */
export const FPS = 30;
export const VOICE_FILE = 'footage/voice2.wav';

/** gapBefore: silence before this piece, when it differs from the scene's gap (0.08 joins two parts of one sentence). */
export type VoicePiece = { in: number; out: number; gain?: number; gapBefore?: number; caption: string[] };
export type Shot = {
  id: 'cold' | 'problem' | 'intro' | 'live' | 'scenario' | 'tornado' | 'map' | 'report' | 'how' | 'built' | 'learned' | 'end';
  /** Seconds of the scene before the first voice piece starts. */
  lead: number;
  /** Seconds of silence between voice pieces inside the scene. */
  gap: number;
  /** Seconds the scene holds after the last voice piece. */
  tail: number;
  voice: VoicePiece[];
};

export const SHOTS: Shot[] = [
  { id: 'cold', lead: 0.6, gap: 0, tail: 4.6, voice: [{ in: 1.56, out: 5.82, gain: 1.45, caption: ['In September of 2024,', 'Hurricane Helene hit South Carolina.'] }] },
  {
    id: 'problem',
    lead: 0.4,
    gap: 0.5,
    tail: 0.5,
    voice: [
      { in: 7.96, out: 18.18, gain: 1.2, caption: ['The warnings were out there.', 'Alerts from the National Weather Service,', 'river levels from USGS, flood maps from FEMA.', 'But they were scattered across different websites', 'and written for experts.'] },
      { in: 19.74, out: 21.5, gain: 1.1, caption: ["That's where HighWater comes in."] },
    ],
  },
  {
    id: 'intro',
    lead: 0.4,
    gap: 0,
    tail: 0.4,
    voice: [{ in: 22.78, out: 39.0, gain: 1.12, caption: ["Hi, I'm Saketh, from York County, and this is HighWater.", "It shows people in South Carolina's 5th District", 'the flood and weather dangers near them right now,', 'and what to do about them.', "It's for everyone in our 8 counties,", 'especially older adults and families without a car.'] }],
  },
  {
    id: 'live',
    lead: 0.3,
    gap: 0.4,
    tail: 0.6,
    voice: [
      { in: 54.0, out: 60.82, caption: ['This is live data for York County.', 'There are four levels:', 'Normal, Watch, Warning, and Danger.'] },
      { in: 62.36, out: 71.2, caption: ['You can see every reason, with its source.', 'The river gauges show how high the water is right now,', "and how it's been changing."] },
    ],
  },
  {
    id: 'scenario',
    lead: 0.3,
    gap: 0.45,
    tail: 1.6,
    voice: [
      // I said "To show what it's like, what it looks like…": the slip in the middle is cut out.
      { in: 73.02, out: 73.7, caption: ['To show'] },
      { in: 74.68, out: 80.7, gapBefore: 0.08, caption: ['what it looks like when things get bad,', 'Scenario Mode replays a storm.', "It's always labeled Simulation."] },
      { in: 82.38, out: 87.26, gain: 1.07, caption: ['As I drag the timeline,', 'the whole screen changes with the danger,', 'and so do the steps.'] },
      { in: 89.2, out: 93.3, gain: 1.05, caption: ['This replays the real alerts and river readings', 'from the morning Helene arrived.'] },
      { in: 95.28, out: 97.16, gain: 0.85, caption: ['Here, the flood reaches Danger.'] },
    ],
  },
  {
    id: 'tornado',
    lead: 0.3,
    gap: 0,
    tail: 0.9,
    voice: [{ in: 98.68, out: 106.9, caption: ['But in a tornado warning, driving away is the wrong advice,', "so there's no route out.", 'It tells you to stay where you are and take shelter.'] }],
  },
  {
    id: 'map',
    lead: 0.3,
    gap: 0,
    tail: 0.6,
    voice: [{ in: 108.76, out: 120.48, caption: ['The district map brings it all together:', 'warning areas, river gauges, flood zones,', 'and where older adults and families without cars live.', 'That way you can see where help matters the most.'] }],
  },
  {
    id: 'report',
    lead: 0.3,
    gap: 0,
    tail: 0.6,
    voice: [{ in: 122.2, out: 134.06, caption: ['Anyone can report a problem,', "like a streetlight that's out or a flooded road.", "There's no account and no personal information.", 'Reports are marked unverified,', 'and the app points you to the official place to report it.'] }],
  },
  {
    id: 'how',
    lead: 3.2,
    gap: 0,
    tail: 1.2,
    voice: [{ in: 135.7, out: 139.6, gain: 1.2, caption: ["If the data doesn't load,", "it says it can't confirm, instead of guessing."] }],
  },
  {
    id: 'built',
    lead: 0.3,
    gap: 0,
    tail: 0.8,
    voice: [{ in: 142.02, out: 152.88, gain: 1.22, caption: ['I built HighWater with TypeScript, React Native, and Expo,', 'using public data from the National Weather Service,', 'USGS, NOAA, FEMA, and the Census.'] }],
  },
  {
    id: 'learned',
    lead: 0.4,
    gap: 0,
    tail: 1.4,
    voice: [{ in: 154.32, out: 162.4, caption: ['What I learned is that the best apps', 'are the ones that are simple and solve important problems,', 'not the ones that have thousands of different features.'] }],
  },
  { id: 'end', lead: 0.4, gap: 0, tail: 2.6, voice: [{ in: 163.46, out: 167.42, caption: ['HighWater is not an official warning system.', 'In an emergency, call 911.'] }] },
];

/** Where each voice piece starts inside its scene, and each scene's length, in seconds. */
export const layout = (shot: Shot) => {
  let t = shot.lead;
  const pieces = shot.voice.map((v, i) => {
    if (i > 0) t += v.gapBefore ?? shot.gap;
    const at = t;
    t += v.out - v.in;
    return { ...v, at };
  });
  return { pieces, duration: t + shot.tail };
};

export const TIMELINE = (() => {
  let start = 0;
  return SHOTS.map((s) => {
    const l = layout(s);
    const item = { ...s, ...l, start };
    start += l.duration;
    return item;
  });
})();

export const TOTAL_SECONDS = TIMELINE.reduce((a, s) => a + s.duration, 0);
export const sceneLength = (id: Shot['id']) => TIMELINE.find((s) => s.id === id)!.duration;
/** When (seconds into its scene) a voice piece starts: handy for timing callouts to words. */
export const pieceAt = (id: Shot['id'], index: number) => TIMELINE.find((s) => s.id === id)!.pieces[index].at;

/** Every caption line with its start and end, in seconds of the finished video. */
const LINES = TIMELINE.flatMap((s) =>
  s.pieces.flatMap((p) => {
    const len = p.out - p.in;
    const chars = p.caption.reduce((a, l) => a + l.length, 0);
    let t = s.start + p.at;
    return p.caption.map((text) => {
      const d = (len * text.length) / chars;
      const line = { text, start: t, end: t + d };
      t += d;
      return line;
    });
  }),
);
/** Each line stays up a moment after it's said, unless the next line is already starting. */
export const CAPTIONS = LINES.map((l, i) => ({ ...l, end: Math.min(l.end + 0.4, LINES[i + 1]?.start ?? Infinity) }));

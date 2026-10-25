/**
 * edit.ts — the edit decision list: which pieces of my recorded voice play in each scene, and the
 * caption text for each piece.
 *
 * My voice comes from the screen recording itself (I read the script while recording). Each piece is
 * [start, end] in seconds of that recording. Pauses, retakes and lines with no matching footage
 * are simply left out. Caption text is what I said, with names spelled right.
 */
export const FPS = 30;

export type VoicePiece = { in: number; out: number; caption: string[] };
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
  { id: 'cold', lead: 0.6, gap: 0, tail: 4.8, voice: [{ in: 0.0, out: 4.95, caption: ['In September 2024,', 'Hurricane Helene hit South Carolina.'] }] },
  {
    id: 'problem',
    lead: 0.4,
    gap: 0.5,
    tail: 0.5,
    voice: [
      { in: 4.9, out: 19.75, caption: ['The warnings were out there.', 'Alerts from the National Weather Service,', 'river levels from USGS, flood maps from FEMA.', 'But they were scattered across different websites', 'and written for experts.'] },
      { in: 19.9, out: 21.95, caption: ["That's where HighWater comes in."] },
    ],
  },
  {
    id: 'intro',
    lead: 0.4,
    gap: 0,
    tail: 0.4,
    voice: [{ in: 32.95, out: 47.9, caption: ["I'm Saketh, from York County, and this is HighWater.", "It shows people in South Carolina's 5th District", 'the flood and weather dangers near them right now,', 'and what to do about them.', "It's for everyone in our 8 counties,", 'especially older adults and families without a car.'] }],
  },
  {
    id: 'live',
    lead: 0.3,
    gap: 0.35,
    tail: 0.5,
    voice: [
      { in: 47.95, out: 56.75, caption: ['This is live data from York County.', 'There are four levels:', 'Normal, Watch, Warning, and Danger.'] },
      { in: 60.16, out: 66.8, caption: ['And you see every reason, with its source.', 'The river gauges show how high the water is right now,'] },
      { in: 68.5, out: 72.2, caption: ["and how it's been changing."] },
    ],
  },
  {
    id: 'scenario',
    lead: 0.3,
    gap: 0.45,
    tail: 1.6,
    voice: [
      { in: 72.95, out: 80.8, caption: ['To show what it looks like when things get bad,', 'Scenario Mode replays a storm.', "It's always labeled Simulation."] },
      { in: 81.12, out: 87.68, caption: ['As I drag the timeline,', 'the whole screen changes with the danger,', 'and so do the steps.'] },
      { in: 87.95, out: 93.85, caption: ['This replays the real alerts and river readings', 'from the morning Helene arrived.'] },
      { in: 120.75, out: 123.15, caption: ['The flood can go into Danger.'] },
    ],
  },
  {
    id: 'tornado',
    lead: 0.3,
    gap: 0,
    tail: 0.9,
    voice: [{ in: 131.08, out: 138.15, caption: ["In a tornado warning, driving away is the wrong advice,", "so there's no route button.", 'It tells you to stay where you are and take shelter.'] }],
  },
  {
    id: 'map',
    lead: 0.3,
    gap: 0,
    tail: 0.6,
    voice: [{ in: 139.95, out: 153.0, caption: ['The district map brings it together:', 'warning areas, river gauges, flood zones,', 'and where older adults and families without cars live.', 'That way you can see where help matters most.'] }],
  },
  {
    id: 'report',
    lead: 0.3,
    gap: 0,
    tail: 0.6,
    voice: [{ in: 152.95, out: 165.65, caption: ['Anyone can report a problem,', "like a streetlight that's out or a flooded road.", "There's no account and no personal information.", 'Reports are marked unverified,', 'and the app points you to the official place to report it.'] }],
  },
  {
    id: 'how',
    lead: 0.3,
    gap: 0.4,
    tail: 0.7,
    voice: [
      { in: 166.98, out: 171.14, caption: ["HighWater doesn't use AI to make decisions.", 'It uses written rules.'] },
      { in: 172.95, out: 179.65, caption: ["If the data doesn't load,", "it says it can't confirm, instead of guessing."] },
    ],
  },
  {
    id: 'built',
    lead: 0.3,
    gap: 0,
    tail: 0.6,
    voice: [{ in: 179.95, out: 190.08, caption: ['I built HighWater with TypeScript, React Native, and Expo,', 'using public data from the National Weather Service,', 'USGS, NOAA, FEMA, and the Census.'] }],
  },
  {
    id: 'learned',
    // No voice here: the quote is shown on screen.
    lead: 0,
    gap: 0,
    tail: 7.5,
    voice: [],
  },
  { id: 'end', lead: 0.4, gap: 0, tail: 2.6, voice: [{ in: 229.15, out: 233.3, caption: ['HighWater is not an official warning system.', 'In an emergency, call 911.'] }] },
];

/** Where each voice piece starts inside its scene, and each scene's length, in seconds. */
export const layout = (shot: Shot) => {
  let t = shot.lead;
  const pieces = shot.voice.map((v, i) => {
    if (i > 0) t += shot.gap;
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

/**
 * guidance.ts — plain-language "what to do" for each hazard and level (brief, section 9).
 *
 * Written at about an 8th grade reading level, based on official guidance:
 *   Flood:   NWS "Turn Around Don't Drown", Ready.gov Floods, SC Emergency Management, Red Cross
 *   Tornado: NWS "During a Tornado", Ready.gov Tornadoes
 *   Storms:  NWS Thunderstorm Safety, Ready.gov Severe Weather
 * Sources for each are listed in METHODOLOGY.md. We never call a place or route "safe".
 */
import { FEATURES, THRESHOLDS } from '../config';
import { HAZARDS } from '../hazards/hazards';
import type { Level } from '../hazards/levels';
import type { HazardStatus } from '../hazards/types';
import { fill, MORE_HAZARDS } from './moreHazards';
import type { GuidanceBlock, GuidanceContext, Link } from './types';

export const TURN_AROUND =
  'Turn around, don’t drown: never walk, swim, or drive through floodwater. Just 6 inches of fast-moving water can knock over an adult, and 12 inches can carry away most cars.';

const LINKS = {
  turnAround: { label: 'NWS: Turn Around Don’t Drown', url: 'https://www.weather.gov/safety/flood-turn-around-dont-drown' },
  readyFlood: { label: 'Ready.gov: Floods', url: 'https://www.ready.gov/floods' },
  scemdFlood: { label: 'SC Emergency Management: Floods', url: 'https://www.scemd.org/prepare/types-of-disasters/floods/' },
  redCrossFlood: {
    label: 'Red Cross: Flood safety',
    url: 'https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies/flood.html',
  },
  nwsTornado: { label: 'NWS: During a tornado', url: 'https://www.weather.gov/safety/tornado-during' },
  readyTornado: { label: 'Ready.gov: Tornadoes', url: 'https://www.ready.gov/tornadoes' },
  nwsStorm: { label: 'NWS: Thunderstorm safety', url: 'https://www.weather.gov/safety/thunderstorm' },
  readySevere: { label: 'Ready.gov: Severe weather', url: 'https://www.ready.gov/severe-weather' },
  nwsSafety: { label: 'NWS: Weather safety', url: 'https://www.weather.gov/safety/' },
  readyAlerts: { label: 'Ready.gov: Emergency alerts', url: 'https://www.ready.gov/alerts' },
  scemd: { label: 'SC Emergency Management Division', url: 'https://www.scemd.org/' },
} satisfies Record<string, Link>;

const isHigh = (n: number | null, threshold: number) => n !== null && n >= threshold;

/** The "check on others" line, made stronger where many people are older or have no car. */
function checkOnOthers(ctx: GuidanceContext, level: Level): string {
  const base = 'Check on neighbors, especially older adults and people who live alone.';
  const strong =
    isHigh(ctx.vulnerability, THRESHOLDS.highVulnerabilityScore) || isHigh(ctx.pctNoVehicle, THRESHOLDS.highNoVehiclePct);
  if (!strong || level === 0) return base;
  return `${base} Many people near here are older, have a disability, or don’t have a car. Call or knock on doors to see if anyone needs help getting ready or getting a ride.`;
}

/** First trigger's text, used to build "What's happening". */
function topReason(status: HazardStatus): string | null {
  return status.triggers.find((t) => t.level === status.level)?.text ?? null;
}

// ---------- Flood ----------

function flood(status: HazardStatus, ctx: GuidanceContext): GuidanceBlock {
  const level = status.level;
  const reason = topReason(status);
  const noCar = isHigh(ctx.pctNoVehicle, THRESHOLDS.highNoVehiclePct)
    ? 'If you don’t have a car, ask a neighbor, family member, or your county emergency management office about a ride now, before roads flood.'
    : null;
  const zoneLine =
    ctx.inFloodZone && level >= 1
      ? 'This spot is in a FEMA high-risk flood zone. Be ready to leave, and know your way to higher ground.'
      : null;

  const whatsHappening: Record<Level, string> = {
    0: `No flood alerts are active for ${ctx.placeName}, and official river gauges are below flood stage.`,
    1: `Flooding is possible in ${ctx.placeName}: ${reason ?? 'conditions could develop'}.`,
    2: `Flooding is happening or about to happen in ${ctx.placeName}: ${reason ?? 'an official warning is active'}.`,
    3: `Life-threatening flooding in ${ctx.placeName}: ${reason ?? 'an emergency-level alert is active'}.`,
  };

  const doNow: Record<Level, (string | null)[]> = {
    0: [
      'Find out if your home, work, or school is in a flood zone. Use "Use my location" above to check a spot.',
      'Turn on emergency alerts on your phone, and sign up for your county’s alerts.',
      'Keep important papers in a waterproof container.',
      'Homeowner’s insurance does not cover flooding. Flood insurance can take 30 days to start.',
    ],
    1: [
      TURN_AROUND,
      zoneLine,
      'Check this page and local news often. Heavy rain can change things fast.',
      'Move important papers, medicine, and valuables to a higher place or into a waterproof bag.',
      'Charge your phone and keep a flashlight nearby.',
      noCar ?? 'Decide now where you would go, and how you would get there, if you have to leave.',
    ],
    2: [
      TURN_AROUND,
      'If officials tell you to evacuate, leave right away.',
      zoneLine ?? 'If you are in a low area or near a creek or river, move to higher ground now.',
      'Do not drive around barricades. They keep people out of flooded roads.',
      noCar,
      'Stay away from downed power lines. Water near them can carry electricity.',
    ],
    3: [
      'Get to higher ground now. Do not wait for the water to reach you.',
      'If officials tell you to evacuate, go now.',
      TURN_AROUND,
      noCar,
      'If you are trapped, call 911.',
    ],
  };

  const ifWorse: Record<Level, string[]> = {
    0: ['If a Flood Watch or Warning is issued, this page will show it. Check back during heavy rain.'],
    1: ['If a Flood Warning is issued for your area, move to higher ground. If officials tell you to evacuate, leave right away.'],
    2: [
      'If water is rising inside your home, go to the highest floor. Do not climb into a closed attic: you could get trapped. Go onto the roof only if you must, and signal for help.',
      'If your car is trapped in fast-moving water, stay inside. If water rises inside the car, get onto the roof.',
      'Call 911 if you are trapped or in danger.',
    ],
    3: [
      'If water is rising inside your home, go to the highest floor. Do not climb into a closed attic: you could get trapped. Go onto the roof only if you must, and signal for help.',
      'If your car is trapped in fast-moving water, stay inside. If water rises inside the car, get onto the roof.',
    ],
  };

  return {
    hazard: 'flood',
    level,
    whatsHappening: whatsHappening[level],
    doNow: doNow[level].filter((s): s is string => Boolean(s)).slice(0, 6),
    ifWorse: ifWorse[level],
    checkOnOthers: checkOnOthers(ctx, level),
    links: [LINKS.turnAround, LINKS.readyFlood, LINKS.scemdFlood, LINKS.redCrossFlood],
    shelterInPlace: false,
    canRoute: level >= 2,
  };
}

// ---------- Tornado (shelter in place: never suggest driving away) ----------

const TORNADO_SHELTER =
  'Go to your shelter spot now: a basement, a storm shelter, or an interior room on the lowest floor, away from windows.';

function tornado(status: HazardStatus, ctx: GuidanceContext): GuidanceBlock {
  const level = status.level;
  const reason = topReason(status);
  const watch = level <= 1;
  return {
    hazard: 'tornado',
    level,
    whatsHappening: watch
      ? `Tornadoes are possible in ${ctx.placeName}${reason ? `: ${reason}` : ''}.`
      : level === 3
        ? `An extreme, life-threatening tornado threat in ${ctx.placeName}: ${reason ?? 'emergency-level warning'}. Take cover now.`
        : `A tornado is happening or about to happen near ${ctx.placeName}: ${reason ?? 'Tornado Warning'}. Take cover now.`,
    doNow: watch
      ? [
          'Pick your shelter spot now: a basement, a storm shelter, or an interior room on the lowest floor, away from windows.',
          'Keep your phone charged and emergency alerts turned on.',
          'A mobile home is not shelter from a tornado. Plan now to go to a sturdy building if a warning is issued.',
          'Keep shoes, a flashlight, and blankets near your shelter spot.',
        ]
      : [
          TORNADO_SHELTER,
          'Protect your head and neck with your arms. Cover yourself with a blanket or mattress.',
          'A mobile home is not shelter from a tornado. Go to a sturdy building now.',
          'Do not try to outrun a tornado. If you are in a car, drive to the closest sturdy building if you can. If you can’t, stay buckled, get down below the windows, and cover your head.',
        ],
    ifWorse: watch
      ? ['If a Tornado Warning is issued, go to your shelter spot right away. Do not wait to see the tornado.']
      : ['After it passes, stay away from downed power lines and damaged buildings. Call 911 if someone is hurt.'],
    checkOnOthers: checkOnOthers(ctx, level),
    links: [LINKS.nwsTornado, LINKS.readyTornado],
    shelterInPlace: true,
    canRoute: false,
  };
}

// ---------- Severe thunderstorm (shelter in place) ----------

function severeStorm(status: HazardStatus, ctx: GuidanceContext): GuidanceBlock {
  const level = status.level;
  const reason = topReason(status);
  const watch = level <= 1;
  return {
    hazard: 'severe_storm',
    level,
    whatsHappening: watch
      ? `Severe thunderstorms with damaging wind, large hail, or lightning are possible in ${ctx.placeName}${reason ? `: ${reason}` : ''}.`
      : `A severe thunderstorm is happening or about to happen near ${ctx.placeName}: ${reason ?? 'Severe Thunderstorm Warning'}.`,
    doNow: watch
      ? [
          'Bring in or tie down outdoor items that wind could throw.',
          'Keep your phone charged and emergency alerts turned on.',
          'Plan to go inside a sturdy building if a warning is issued.',
        ]
      : [
          'Go inside a sturdy building now and stay away from windows.',
          'When thunder roars, go indoors. Stay inside until 30 minutes after the last thunder.',
          'Stay off corded phones and away from plumbing while there is lightning.',
          TURN_AROUND,
        ],
    ifWorse: ['If a Tornado Warning is issued, go to the lowest floor, in an interior room away from windows.'],
    checkOnOthers: checkOnOthers(ctx, level),
    links: [LINKS.nwsStorm, LINKS.readySevere],
    shelterInPlace: true,
    canRoute: false,
  };
}

// ---------- Tropical, winter, cold, heat, wind, fire weather, fog, air quality, evacuation (P1a) ----------

function fromTable(status: HazardStatus, ctx: GuidanceContext): GuidanceBlock | null {
  const copy = MORE_HAZARDS[status.hazard];
  if (!copy) return null;
  const level = status.level;
  const info = HAZARDS[status.hazard];
  // Watch-level alerts get the "get ready" steps; Warning and Danger get the "act now" steps.
  const base = level <= 1 ? (copy.prepare.length ? copy.prepare : copy.act) : copy.act.length ? copy.act : copy.prepare;
  const doNow = (level === 3 && copy.danger ? [copy.danger, ...base] : base).slice(0, 6);
  const template = copy.happening[level] ?? copy.happening[1] ?? copy.happening[3] ?? '{reason} in {place}.';
  const shelter = typeof copy.shelterInPlace === 'boolean' ? copy.shelterInPlace : (copy.shelterInPlace[level] ?? false);
  return {
    hazard: status.hazard,
    level,
    whatsHappening: fill(template, status, ctx, info.label),
    doNow,
    ifWorse: copy.ifWorse,
    checkOnOthers: checkOnOthers(ctx, level),
    links: copy.links,
    shelterInPlace: shelter,
    canRoute: copy.routeLevels.includes(level),
  };
}

// ---------- Anything else: follow the official alert ----------

function generic(status: HazardStatus, ctx: GuidanceContext): GuidanceBlock {
  const info = HAZARDS[status.hazard];
  const reason = topReason(status);
  return {
    hazard: status.hazard,
    level: status.level,
    whatsHappening: `The National Weather Service issued an alert for ${ctx.placeName}: ${reason ?? info.label}.`,
    doNow: [
      'Read the official alert below and follow what it says to do.',
      'Check this page and local news for updates.',
      'Keep your phone charged and emergency alerts turned on.',
    ],
    ifWorse: ['If officials give instructions, follow theirs first. Call 911 if you are in danger.'],
    checkOnOthers: checkOnOthers(ctx, status.level),
    links: [LINKS.nwsSafety, LINKS.readyAlerts, LINKS.scemd],
    shelterInPlace: !info.leaveable,
    canRoute: info.leaveable && status.level >= 2,
  };
}

/** Pick the guidance for a hazard's status. */
export function guidanceFor(status: HazardStatus, ctx: GuidanceContext): GuidanceBlock {
  switch (status.hazard) {
    case 'flood':
      return flood(status, ctx);
    case 'tornado':
      return tornado(status, ctx);
    case 'severe_storm':
      return severeStorm(status, ctx);
    default:
      return (FEATURES.multiHazard ? fromTable(status, ctx) : null) ?? generic(status, ctx);
  }
}

/**
 * The route planner is offered only if the TOP hazard allows leaving AND no active
 * hazard says to shelter in place (e.g. a Tornado Warning during a flood: don't drive).
 */
export function routeAllowed(blocks: GuidanceBlock[]): boolean {
  const active = blocks.filter((b) => b.level >= 2);
  if (active.some((b) => b.shelterInPlace)) return false;
  return active.some((b) => b.canRoute);
}

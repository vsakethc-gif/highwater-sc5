/**
 * moreHazards.ts — "what to do" for hazards other than flood, tornado, and severe storms (P1a).
 *
 * Every action below comes from an official source, listed with each hazard:
 *   Tropical:     Ready.gov Hurricanes, SC Emergency Management
 *   Winter, cold: Ready.gov Winter Weather (generators, heating, frostbite, hypothermia)
 *   Heat:         Ready.gov Extreme Heat (heat stroke vs heat exhaustion)
 *   Wind:         NWS "During high winds"
 *   Fire weather: NWS Fire Weather Watch / Red Flag Warning
 *   Fog:          NWS fog driving safety
 *   Air quality:  AirNow (EPA) AQI basics
 *   Evacuation:   Ready.gov Evacuation
 * We never call a place or route "safe".
 */
import type { Level } from '../hazards/levels';
import type { HazardId, HazardStatus } from '../hazards/types';
import type { GuidanceContext, Link } from './types';

export interface HazardCopy {
  /** "What's happening" for each level. `{place}` and `{reason}` are filled in. */
  happening: Partial<Record<Level, string>>;
  /** Steps for a Watch-level alert (get ready) and a Warning/Danger-level alert (act now). */
  prepare: string[];
  act: string[];
  /** Extra first step at Danger level, if any. */
  danger?: string;
  ifWorse: string[];
  links: Link[];
  /** Shelter where you are (true) or leaving can make sense (false). Per level when it differs. */
  shelterInPlace: boolean | Partial<Record<Level, boolean>>;
  /** Levels at which a route planner may be offered. */
  routeLevels: Level[];
}

const GENERATOR =
  'Run generators only outdoors, at least 20 feet from windows, doors, and attached garages. Never heat your home with a gas stove or oven.';
const POWER_LINES = 'Stay far away from downed power lines: they may be live. Call 911 and your power company.';
const TURN_AROUND_SHORT = 'Turn around, don’t drown: never walk or drive through floodwater.';

export const MORE_HAZARDS: Partial<Record<HazardId, HazardCopy>> = {
  tropical: {
    happening: {
      1: 'A tropical storm or hurricane could affect {place}: {reason}. Inland areas can still get flooding, strong wind, and tornadoes.',
      2: 'Tropical storm or hurricane conditions are expected in {place}: {reason}.',
      3: 'Extreme, life-threatening wind is happening or about to happen in {place}: {reason}. Take shelter now.',
    },
    prepare: [
      'Listen to local officials about evacuation. If they tell you to leave, go right away.',
      'Get several days of water, food, and medicine ready, and charge your phone and backup batteries.',
      'Bring in or tie down outdoor items, and clear gutters and storm drains near your home.',
      'If you live in a mobile home, plan now where you will go before the wind picks up.',
      'Know your route to higher ground and where you would stay.',
    ],
    act: [
      'If local officials order an evacuation, leave right away.',
      'If you are staying, go to an interior room or storm shelter during high winds, away from windows.',
      TURN_AROUND_SHORT,
      'Keep your phone charged. Send texts instead of calling, since phone lines can be busy.',
      POWER_LINES,
    ],
    danger:
      'Go to an interior room on the lowest floor now, away from windows, and stay there until the wind passes. Treat it like a tornado.',
    ifWorse: [
      'If water rises in your home, go to the highest floor. Do not climb into a closed attic.',
      GENERATOR,
      'After the storm, don’t touch wet electrical equipment, and stay out of floodwater: it can hide debris and live wires.',
    ],
    links: [
      { label: 'Ready.gov: Hurricanes', url: 'https://www.ready.gov/hurricanes' },
      { label: 'SC Emergency Management: Hurricanes', url: 'https://www.scemd.org/prepare/types-of-disasters/hurricanes/' },
      { label: 'NWS: Hurricane safety', url: 'https://www.weather.gov/safety/hurricane' },
    ],
    shelterInPlace: { 1: false, 2: false, 3: true },
    routeLevels: [2],
  },

  winter: {
    happening: {
      1: 'Snow or ice could affect {place}: {reason}.',
      2: 'A winter storm is happening or about to happen in {place}: {reason}.',
      3: 'Dangerous blizzard conditions in {place}: {reason}. Stay where you are.',
    },
    prepare: [
      'Get food, water, and medicine for a few days in case roads are closed or the power goes out.',
      'Test your smoke and carbon monoxide alarms, and keep batteries charged.',
      'Protect pipes from freezing, and seal drafts around doors and windows.',
      'Keep a kit in your car: blankets, warm clothes, a flashlight, water, and snacks. Keep the gas tank full.',
    ],
    act: [
      'Stay off the roads if at all possible.',
      'Stay inside and limit time outside. Wear layers if you go out, and don’t overdo it shoveling.',
      GENERATOR,
      'If you get stuck in your car, stay inside it.',
      'Watch for frostbite (numb, white or grayish-yellow skin) and hypothermia (shivering, confusion, slurred speech, drowsiness).',
    ],
    ifWorse: [
      'A body temperature below 95°F is an emergency. Call 911, move the person somewhere warm, and warm their chest, neck, head, and groin first.',
      'For frostbite, warm the area in warm (not hot) water. Do not rub it or use a heating pad.',
      POWER_LINES,
    ],
    links: [
      { label: 'Ready.gov: Winter weather', url: 'https://www.ready.gov/winter-weather' },
      { label: 'NWS: Winter safety', url: 'https://www.weather.gov/safety/winter' },
    ],
    shelterInPlace: true,
    routeLevels: [],
  },

  cold: {
    happening: {
      1: 'Very cold temperatures are expected in {place}: {reason}.',
      2: 'Dangerous cold is happening or about to happen in {place}: {reason}.',
    },
    prepare: [
      'Plan to limit time outside. If you go out, wear layers, a hat, and gloves.',
      'Charge your phone and backup batteries in case the power goes out.',
      'Protect pipes from freezing, and test your carbon monoxide alarms.',
      'Check that your heat works. Never heat your home with a gas stove or oven.',
    ],
    act: [
      'Stay inside as much as you can, and wear layers if you must go out.',
      GENERATOR,
      'Watch for frostbite (numb, white or grayish-yellow skin) and hypothermia (shivering, confusion, slurred speech, drowsiness).',
    ],
    ifWorse: [
      'A body temperature below 95°F is an emergency. Call 911, move the person somewhere warm, and warm their chest, neck, head, and groin first.',
      'For frostbite, warm the area in warm (not hot) water. Do not rub it or use a heating pad.',
    ],
    links: [
      { label: 'Ready.gov: Winter weather', url: 'https://www.ready.gov/winter-weather' },
      { label: 'NWS: Cold safety', url: 'https://www.weather.gov/safety/cold' },
    ],
    shelterInPlace: true,
    routeLevels: [],
  },

  heat: {
    happening: {
      1: 'Heat could make people sick in {place}: {reason}.',
      2: 'Dangerous heat is happening or about to happen in {place}: {reason}.',
    },
    prepare: [
      'Drink plenty of water, even if you don’t feel thirsty.',
      'Stay in air conditioning. If you don’t have it, find a cooling center or cool public place, and take cool showers.',
      'Never leave people or pets in a closed car.',
      'Avoid hard work or exercise outside in the middle of the day.',
    ],
    act: [
      'Stay in air conditioning. If you don’t have it, go to a cooling center or cool public place.',
      'Drink plenty of water, and wear light, loose clothing.',
      'Never leave people or pets in a closed car, even for a minute.',
      'Avoid hard work or exercise outside in the middle of the day.',
      'Give outdoor pets shade and cool water. Hot pavement can burn their feet.',
    ],
    ifWorse: [
      'Heat stroke is an emergency: a temperature above 103°F, red, hot, dry skin, a fast strong pulse, confusion, or passing out. Call 911, move the person somewhere cool, and cool them with wet cloths or ice packs.',
      'Heat exhaustion (heavy sweating, cramps, weakness, dizziness, nausea): move somewhere cool, loosen clothing, and sip water. Call a doctor if it gets worse or lasts over an hour.',
    ],
    links: [
      { label: 'Ready.gov: Extreme heat', url: 'https://www.ready.gov/heat' },
      { label: 'NWS: Heat safety', url: 'https://www.weather.gov/safety/heat' },
      { label: 'NWS: Heat illness', url: 'https://www.weather.gov/safety/heat-illness' },
    ],
    shelterInPlace: true,
    routeLevels: [],
  },

  wind: {
    happening: {
      1: 'Strong wind is expected in {place}: {reason}.',
      2: 'Damaging wind is happening or about to happen in {place}: {reason}.',
    },
    prepare: [
      'Bring in or tie down outdoor items that the wind could throw.',
      'If you live in a mobile home, plan to move to a sturdy building before the wind picks up.',
      'Charge your phone in case the power goes out.',
    ],
    act: [
      'Go inside a sturdy building and stay away from windows.',
      'If you live in a mobile home, move to a sturdy building before the wind picks up.',
      'If you are driving, hold the wheel with both hands, slow down, and stay away from trucks, buses, and trailers.',
      'Outside, stay away from trees and power lines.',
      POWER_LINES,
    ],
    ifWorse: [POWER_LINES, GENERATOR],
    links: [
      { label: 'NWS: During high winds', url: 'https://www.weather.gov/safety/wind-during' },
      { label: 'Ready.gov: Power outages', url: 'https://www.ready.gov/power-outages' },
    ],
    shelterInPlace: true,
    routeLevels: [],
  },

  fire_weather: {
    happening: {
      1: 'Weather could let fires spread quickly in {place}: {reason}.',
      2: 'Fires could start and spread very quickly in {place}: {reason}.',
    },
    prepare: [
      'Be extremely careful with open flames, grills, and anything that makes sparks.',
      'Avoid outdoor burning, and check your county’s burning rules before you burn anything.',
      'Clear dry leaves and branches away from your home.',
    ],
    act: [
      'Be extremely careful with open flames, grills, and anything that makes sparks.',
      'Do not burn yard debris or trash outside while this alert is active.',
      'Call 911 right away if you see a fire.',
      'If officials tell you to evacuate, leave right away.',
    ],
    ifWorse: ['If a wildfire is near and officials order an evacuation, leave right away and follow their routes.'],
    links: [
      { label: 'NWS: Fire weather alerts', url: 'https://www.weather.gov/safety/wildfire-ww' },
      { label: 'Ready.gov: Wildfires', url: 'https://www.ready.gov/wildfires' },
    ],
    shelterInPlace: false,
    routeLevels: [],
  },

  fog: {
    happening: { 1: 'Thick fog or smoke can make it very hard to see on roads in {place}: {reason}.' },
    prepare: [
      'If you can, wait to drive until the fog clears.',
      'If you must drive, slow down and give yourself extra time.',
      'If you can barely see, turn on your hazard lights, pull into a parking lot, and stop.',
    ],
    act: [],
    ifWorse: [
      'If there is no parking lot, pull as far off the road as you can, turn off all lights except your hazard lights, and set the parking brake.',
    ],
    links: [{ label: 'NWS: Driving in fog', url: 'https://www.weather.gov/safety/fog-driving' }],
    shelterInPlace: false,
    routeLevels: [],
  },

  air_quality: {
    happening: { 1: 'The air may be unhealthy to breathe in {place}: {reason}.' },
    prepare: [
      'If you have asthma or heart or lung disease, are an older adult, or are a child, limit time and hard activity outside.',
      'Choose easier activities, take more breaks, or move activities indoors.',
      'Keep any rescue inhaler or medicine with you, and follow your doctor’s plan.',
    ],
    act: [],
    ifWorse: ['Call 911 if someone has serious trouble breathing or chest pain.'],
    links: [{ label: 'AirNow: Air Quality Index basics', url: 'https://www.airnow.gov/aqi/aqi-basics/' }],
    shelterInPlace: false,
    routeLevels: [],
  },

  evacuation: {
    happening: { 3: 'Officials have ordered an evacuation for {place}: {reason}.' },
    prepare: [],
    act: [
      'Leave now. Follow the routes officials give. Don’t take shortcuts: they may be blocked.',
      'Take your medicine, important papers, phone charger, and emergency kit.',
      'Take your pets. Public shelters usually allow only service animals, so plan where pets will stay.',
      'Check whether neighbors need a ride.',
      TURN_AROUND_SHORT,
    ],
    ifWorse: ['If you cannot leave or are trapped, call 911.'],
    links: [{ label: 'Ready.gov: Evacuation', url: 'https://www.ready.gov/evacuation' }],
    shelterInPlace: false,
    routeLevels: [3],
  },
};

/** Fill in "{place}" and "{reason}" in a sentence. */
export function fill(template: string, status: HazardStatus, ctx: GuidanceContext, fallbackReason: string): string {
  const reason = status.triggers.find((t) => t.level === status.level)?.text ?? fallbackReason;
  return template.replace('{place}', ctx.placeName).replace('{reason}', reason);
}

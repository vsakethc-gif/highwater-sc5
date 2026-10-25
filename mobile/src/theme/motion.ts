/**
 * motion.ts — the motion system (MOBILE_BRIEF.md section 5). Every animation uses these values.
 *
 * Why it stays smooth: Reanimated runs animations on the phone's UI thread (the part that draws
 * the screen) instead of the JavaScript thread (the part running our app logic and loading data).
 * So even while river data loads, the status card's color change and the water rising stay at 60 fps.
 *
 * Rules: animate only transform and opacity; entrances play once per meaningful event; no bounce on
 * emergency content; and when the phone's Reduce Motion setting is on, movement becomes a short fade
 * (ReduceMotion.System on every entrance, plus useMotionReduced() for our own effects).
 */
import { Easing, FadeIn, FadeInDown, FadeOut, Keyframe, ReduceMotion, useReducedMotion, type WithSpringConfig } from 'react-native-reanimated';

export const duration = { instant: 0, micro: 120, fast: 200, base: 280, slow: 400, deliberate: 600 } as const;

/**
 * Curves (Oct 24 motion review, from Emil Kowalski's design-engineering rules): the built-in curves are
 * too soft, so everything uses a strong ease-out (starts fast, so it feels instant) or, for things
 * moving across the screen, a strong ease-in-out. Nothing on screen uses ease-in: it starts slowly,
 * exactly when you're watching.
 */
export const easing = {
  /** Entering, settling, state changes. */
  standard: Easing.bezier(0.23, 1, 0.32, 1),
  emphasized: Easing.bezier(0.16, 1, 0.3, 1),
  /** Leaving: still ease-out, just a little quicker to finish. */
  exit: Easing.bezier(0.23, 1, 0.32, 1),
  /** Moving from one place on screen to another (the tab pill, the timeline thumb). */
  move: Easing.bezier(0.77, 0, 0.175, 1),
};

/**
 * Something popping in (map markers, a round button): from 85% size and invisible, never from
 * nothing (scale 0 looks like it came from nowhere).
 */
export function popIn(delay = 0) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.85 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.bezier(0.23, 1, 0.32, 1) },
  })
    .duration(220)
    .delay(delay)
    .reduceMotion(ReduceMotion.System);
}

export const spring = {
  /** Press feedback, toggles, chips. */
  snappy: { damping: 18, stiffness: 260, mass: 1 } satisfies WithSpringConfig,
  /** Cards entering, layout changes. */
  gentle: { damping: 20, stiffness: 140, mass: 1 } satisfies WithSpringConfig,
  /** Bottom sheets and drawers: settles in about 300 ms, no wobble. */
  sheet: { damping: 34, stiffness: 340, mass: 1 } satisfies WithSpringConfig,
  /** Markers appearing, the success check. Use rarely. */
  pop: { damping: 12, stiffness: 300, mass: 0.8 } satisfies WithSpringConfig,
};

/** List stagger: 40 ms per item, only the first 8 items are staggered. */
export const STAGGER_MS = 40;
export const STAGGER_MAX = 8;

/** Entrance for the i-th item of a list: fade and rise, a little after the one before (once, on mount). */
export function listItemEntering(i: number) {
  return FadeInDown.duration(duration.base)
    .delay(Math.min(i, STAGGER_MAX) * STAGGER_MS)
    .easing(easing.emphasized)
    .reduceMotion(ReduceMotion.System);
}

export const fadeIn = FadeIn.duration(duration.base).reduceMotion(ReduceMotion.System);
export const fadeOut = FadeOut.duration(duration.fast).reduceMotion(ReduceMotion.System);
/** Emergency content (911, Danger, the power-line warning) appears instantly: no entrance at all. */
export const emergencyFade = undefined;

/** True when the phone's "Reduce Motion" setting is on: skip movement, loops, and wave effects. */
export const useMotionReduced = useReducedMotion;

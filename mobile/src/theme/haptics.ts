/**
 * haptics.ts — the haptics map (MOBILE_BRIEF.md section 5.3): one meaning per vibration, so a
 * tap always feels the same. Respects the Haptics switch in More → Settings.
 */
import * as Haptics from 'expo-haptics';
import type { Level } from '../../../shared/hazards/levels';
import { platform } from '../../../shared/platform';

export const HAPTICS_KEY = 'sc5ready.haptics';
const on = () => {
  try {
    return platform().storage.getItem(HAPTICS_KEY) !== 'off';
  } catch {
    return true;
  }
};
const run = (p: Promise<void>) => p.catch(() => {});

export const haptic = {
  /** Primary button press, pull-to-refresh trigger. */
  press: () => on() && run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Toggle, chip, segmented control, scrubbing across a flood-stage line. */
  select: () => on() && run(Haptics.selectionAsync()),
  /** Report sent, checklist item done. */
  success: () => on() && run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => on() && run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /**
   * Status changed. Watch: one warning buzz. Warning: the buzz plus a firm follow-up tap.
   * Danger: an error buzz and two heavy taps, so it's unmistakable even in a pocket. No sounds.
   */
  level: (level: Level) => {
    if (!on() || level === 0) return;
    run(Haptics.notificationAsync(level === 3 ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Warning));
    if (level >= 2) setTimeout(() => run(Haptics.impactAsync(level === 3 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium)), 260);
    if (level === 3) setTimeout(() => run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), 480);
  },
};

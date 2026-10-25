/**
 * steps.ts — turns a guidance step (a full sentence from the shared guidance) into a short label and
 * an icon for the phone's checklist, so a worried person can scan the steps in a second.
 *
 * The full sentence is never lost: it's one tap away under each step, and screen readers always
 * read it. The rules match on words in the sentence; anything not matched keeps its first phrase.
 * This is presentation only: the guidance itself (shared with the website) doesn't change.
 */
import type { IconName } from '../Icon';

const RULES: [RegExp, IconName, string][] = [
  [/turn around|floodwater/i, 'Ban', 'Never drive through water'],
  [/trapped, call 911|call 911/i, 'Phone', 'Trapped? Call 911'],
  [/low area|near a creek/i, 'Mountain', 'In a low area? Move higher'],
  [/higher ground now|get to higher ground/i, 'Mountain', 'Get to higher ground now'],
  [/evacuate/i, 'Car', 'Evacuate if officials say so'],
  [/barricade/i, 'Ban', 'Don’t drive around barricades'],
  [/power line/i, 'Zap', 'Stay away from power lines'],
  [/high-risk flood zone|be ready to leave/i, 'Signpost', 'Be ready to leave'],
  [/flood zone/i, 'Map', 'Check your flood zone'],
  [/emergency alerts|alerts turned on|county’s alerts/i, 'Bell', 'Turn on emergency alerts'],
  [/waterproof|papers|valuables|medicine/i, 'FileText', 'Protect papers and medicine'],
  [/insurance/i, 'ShieldAlert', 'Check your flood insurance'],
  [/local news|check this page/i, 'Radio', 'Check for updates often'],
  [/charge your phone|flashlight nearby/i, 'BatteryCharging', 'Charge phone, grab a flashlight'],
  [/ride|neighbor|no car|without a car/i, 'Users', 'No car? Line up a ride'],
  [/where you would go/i, 'Signpost', 'Plan where you’d go'],
  [/pick your shelter spot/i, 'House', 'Pick your shelter spot'],
  [/go to your shelter spot|interior room|basement/i, 'House', 'Go to your shelter spot'],
  [/head and neck/i, 'ShieldAlert', 'Cover your head and neck'],
  [/mobile home/i, 'House', 'Leave a mobile home'],
  [/outrun|in a car/i, 'Car', 'Don’t try to outrun it'],
  [/shoes|blankets/i, 'BatteryCharging', 'Keep shoes and a flashlight close'],
  [/tie down|outdoor items/i, 'Wind', 'Secure outdoor items'],
  [/thunder roars|go inside a sturdy|sturdy building/i, 'House', 'Get inside a sturdy building'],
  [/plumbing|corded phone/i, 'Zap', 'Avoid plumbing in lightning'],
  [/water|drink|hydrat/i, 'Droplets', 'Drink water often'],
];

export interface StepVisual {
  icon: IconName;
  label: string;
}

/** Short label (about 6 words) and icon for one guidance step. */
export function stepVisual(text: string): StepVisual {
  for (const [re, icon, label] of RULES) if (re.test(text)) return { icon, label };
  // Not matched: the first phrase, cut at the first period, colon, or comma, up to 6 words.
  const first = text.split(/[.:;]/)[0].trim();
  const words = first.split(/\s+/);
  return { icon: 'CircleCheck', label: words.length > 6 ? `${words.slice(0, 6).join(' ')}…` : first };
}

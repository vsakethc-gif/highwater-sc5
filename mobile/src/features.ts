/**
 * features.ts — switch whole tabs on or off in one place. A tab that isn't solid is hidden
 * completely (no placeholder), so the app never shows something half-built.
 */
export const TABS_ON = {
  map: true,
  // Off since Oct 24: on the phone the route planner wasn't useful enough to keep. The code stays,
  // so switching this back to true brings the tab (and Status's "Plan a route out") back.
  route: false,
  report: true,
};

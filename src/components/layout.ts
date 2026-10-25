/**
 * layout.ts — the header, footer, and Scenario Mode banner shared by every page.
 * The footer always shows the 911 line and links to official sources.
 */
import { APP_NAME, DISCLAIMER } from '../../shared/config';
import { h } from '../lib/dom';
import { findScenario, SCENARIOS } from '../../shared/scenario/scenario';
import { getState, setState } from '../lib/state';
import { icon } from './icon';

export type Route = 'status' | 'map' | 'report' | 'prepare' | 'methodology' | 'about' | 'none';

export function skipLink(): HTMLAnchorElement {
  return h('a', { class: 'skip-link', href: '#main' }, 'Skip to main content');
}

const NAV: { route: Route; label: string; href: string }[] = [
  { route: 'status', label: 'Status', href: '#/' },
  { route: 'map', label: 'District map', href: '#/map' },
  { route: 'report', label: 'Report a problem', href: '#/report' },
  { route: 'prepare', label: 'Get ready', href: '#/prepare' },
  { route: 'methodology', label: 'How it works', href: '#/methodology' },
  { route: 'about', label: 'About', href: '#/about' },
];

/**
 * The phone tab bar along the bottom of the screen, like a native app.
 * Short labels so five fit; the last tab covers both About and How it works.
 */
const TABS: { routes: Route[]; label: string; href: string; icon: Parameters<typeof icon>[0] }[] = [
  { routes: ['status'], label: 'Status', href: '#/', icon: 'Activity' },
  { routes: ['map'], label: 'Map', href: '#/map', icon: 'Map' },
  { routes: ['report'], label: 'Report', href: '#/report', icon: 'Megaphone' },
  { routes: ['prepare'], label: 'Get ready', href: '#/prepare', icon: 'ListChecks' },
  { routes: ['about', 'methodology'], label: 'About', href: '#/about', icon: 'Info' },
];

/** The Highwater mark: a water line rising past a level line, drawn to match the app icon. */
function logoMark(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('class', 'logo-mark');
  svg.setAttribute('aria-hidden', 'true');
  // Static markup we wrote ourselves (no user input), so innerHTML is fine here.
  svg.innerHTML =
    '<rect width="32" height="32" rx="7" fill="currentColor"/>' +
    '<path d="M5 19c3.5 0 3.5-2.5 7-2.5s3.5 2.5 7 2.5 3.5-2.5 7-2.5" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M5 24c3.5 0 3.5-2.5 7-2.5s3.5 2.5 7 2.5 3.5-2.5 7-2.5" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>' +
    '<path d="M16 6v7" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>';
  return svg;
}

/** The Scenario Mode picker: a native <dialog>, which handles focus and the Escape key for us. */
function scenarioDialog(): HTMLDialogElement {
  const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': 'scenario-title' });
  const close = () => dialog.close();
  const current = getState().scenario;

  const options = SCENARIOS.map((s) => {
    const button = h(
      'button',
      { class: `scenario-option${s.id === current ? ' is-current' : ''}`, type: 'button', 'aria-pressed': String(s.id === current) },
      h('span', { class: 'scenario-option__title' }, s.title),
      h('span', { class: 'scenario-option__summary' }, s.summary),
    );
    button.addEventListener('click', () => {
      close();
      setState({ scenario: s.id, place: { kind: 'county', fips: s.county } });
    });
    return h('li', {}, button);
  });

  const off = h('button', { class: 'button button--secondary', type: 'button' }, 'Turn off Scenario Mode');
  off.addEventListener('click', () => {
    close();
    setState({ scenario: null });
  });
  const cancel = h('button', { class: 'button button--text', type: 'button' }, 'Cancel');
  cancel.addEventListener('click', close);

  dialog.append(
    h('h2', { id: 'scenario-title', class: 'dialog__title' }, 'Scenario Mode'),
    h(
      'p',
      { class: 'dialog__intro' },
      'Replay a made-up emergency to see how the app responds. Everything shown is a simulation, clearly labeled, and nothing is saved or sent anywhere.',
    ),
    h('ul', { class: 'scenario-list' }, ...options),
    h('div', { class: 'dialog__actions' }, current ? off : null, cancel),
  );
  dialog.addEventListener('close', () => dialog.remove());
  return dialog;
}

export function openScenarioPicker(): void {
  const dialog = scenarioDialog();
  document.body.append(dialog);
  dialog.showModal();
}

export function siteHeader(active: Route): HTMLElement {
  const scenarioOn = getState().scenario !== null;
  const scenarioButton = h(
    'button',
    { class: `header-button${scenarioOn ? ' is-on' : ''}`, type: 'button', 'aria-haspopup': 'dialog' },
    icon('FlaskConical'),
    scenarioOn ? 'Scenario on' : 'Scenario mode',
  );
  scenarioButton.addEventListener('click', openScenarioPicker);

  return h(
    'header',
    { class: 'site-header' },
    h(
      'div',
      { class: 'container site-header__inner' },
      h('a', { class: 'site-header__name', href: '#/' }, logoMark(), h('span', {}, APP_NAME)),
      // Wide screens: the full menu sits in the header row. Phones use the tab bar instead.
      h(
        'nav',
        { class: 'site-nav', 'aria-label': 'Main' },
        h(
          'ul',
          {},
          ...NAV.map((item) => h('li', {}, h('a', { href: item.href, 'aria-current': item.route === active ? 'page' : null }, item.label))),
        ),
      ),
      scenarioButton,
    ),
  );
}

/** Bottom tab bar for phones (hidden on wider screens, where the header menu shows). */
export function tabBar(active: Route): HTMLElement {
  return h(
    'nav',
    { class: 'tab-bar', 'aria-label': 'Main (tabs)' },
    h(
      'ul',
      {},
      ...TABS.map((t) =>
        h(
          'li',
          {},
          h('a', { href: t.href, 'aria-current': t.routes.includes(active) ? 'page' : null }, icon(t.icon), h('span', {}, t.label)),
        ),
      ),
    ),
  );
}

/** Persistent banner on every screen while Scenario Mode is on (brief 12.8). */
export function simulationBanner(): HTMLElement | null {
  const scenario = findScenario(getState().scenario);
  if (!scenario) return null;
  const off = h('button', { class: 'banner__action', type: 'button' }, 'Turn off');
  off.addEventListener('click', () => setState({ scenario: null }));
  return h(
    'div',
    { class: 'banner banner--sim', role: 'status' },
    h(
      'div',
      { class: 'container banner__inner' },
      icon('FlaskConical'),
      h('span', {}, h('strong', {}, 'SIMULATION — not live data. '), scenario.title),
      off,
    ),
  );
}

export function siteFooter(): HTMLElement {
  return h(
    'footer',
    { class: 'site-footer' },
    h(
      'div',
      { class: 'container' },
      h(
        'div',
        { class: 'prose' },
      h('p', { class: 'emergency-line' }, icon('Phone'), h('a', { href: 'tel:911' }, 'In an emergency, call 911')),
      h('p', {}, DISCLAIMER),
      h(
        'p',
        {},
        'Official sources: ',
        h('a', { href: 'https://www.weather.gov/alerts' }, 'National Weather Service alerts'),
        ' · ',
        h('a', { href: 'https://www.scemd.org/' }, 'SC Emergency Management Division'),
      ),
      h('p', {}, h('a', { href: '#/methodology' }, 'How it works'), ' · ', h('a', { href: '#/about' }, 'About and privacy')),
      ),
    ),
  );
}

/** Shown on every page while the device has no connection (brief P1a). */
export function offlineBanner(): HTMLElement | null {
  if (navigator.onLine !== false) return null;
  return h(
    'div',
    { class: 'banner banner--offline', role: 'status' },
    h(
      'div',
      { class: 'container banner__inner' },
      icon('CloudOff'),
      h('span', {}, h('strong', {}, 'You’re offline. '), 'Guidance and the “Get ready” checklists still work. Live data will update when you reconnect.'),
    ),
  );
}

/** Wrap a page's main content with the shared header, banners, and footer. */
export function pageShell(active: Route, main: HTMLElement): HTMLElement[] {
  return [skipLink(), siteHeader(active), offlineBanner(), simulationBanner(), main, siteFooter(), tabBar(active)].filter(Boolean) as HTMLElement[];
}

/**
 * main.ts — the app's starting point, and its "router".
 *
 * The part of the address after "#" picks the screen: "#/" is Status, "#/map" is the
 * district map, and so on. Hash addresses work on GitHub Pages without any server setup.
 * The map and text pages are loaded only when opened, so the main screen stays fast on phones.
 */
import '@fontsource-variable/public-sans';
import '@fontsource-variable/source-serif-4';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/prepare.css';
import './styles/motion.css';
import { APP_NAME, FEATURES } from '../shared/config';
import { h } from './lib/dom';
import { subscribe } from './lib/state';
import { pageShell } from './components/layout';
import { renderStatus } from './pages/status';
import { useBrowserPlatform } from './platform';

type Cleanup = () => void;
type Page = (root: HTMLElement) => Cleanup | void;

// Plug the browser into the shared rules and data code before anything runs.
useBrowserPlatform();

const root = document.getElementById('app')!;
let cleanup: Cleanup | void;
const RELOAD_KEY = 'sc5ready.reloadedForUpdate';
/** sessionStorage can be blocked by browser settings; these never throw. */
const session = {
  get: (k: string): string | null => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return '1'; // can't remember a reload, so don't risk a loop
    }
  },
  set: (k: string, v: string) => {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  remove: (k: string) => {
    try {
      sessionStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

function notFound(el: HTMLElement): void {
  document.title = `Page not found · ${APP_NAME}`;
  el.replaceChildren(
    ...pageShell(
      'none',
      h(
        'main',
        { id: 'main', class: 'container text-page' },
        h('h1', { class: 'page-title' }, 'Page not found'),
        h('p', { class: 'lede' }, 'There’s no page at this address.'),
        h('p', {}, h('a', { class: 'button button--primary', href: '#/' }, 'Go to hazard status')),
      ),
    ),
  );
}

async function pageFor(path: string): Promise<Page> {
  switch (path) {
    case '':
    case '/':
      return renderStatus;
    case '/map':
      return (await import('./pages/map')).renderMap;
    case '/route':
      return FEATURES.routePlanner ? (await import('./pages/route')).renderRoute : notFound;
    case '/report':
      return FEATURES.reports ? (await import('./pages/report')).renderReport : notFound;
    case '/admin':
      return FEATURES.reports ? (await import('./pages/admin')).renderAdmin : notFound;
    case '/prepare':
      return (await import('./pages/prepare')).renderPrepare;
    case '/methodology':
      return (await import('./pages/textPages')).renderMethodology;
    case '/about':
      return (await import('./pages/textPages')).renderAbout;
    default:
      return notFound;
  }
}

async function route(): Promise<void> {
  const path = location.hash.replace(/^#/, '').split('?')[0];
  if (cleanup) cleanup();
  cleanup = undefined;
  try {
    const page = await pageFor(path);
    cleanup = page(root);
    session.remove(RELOAD_KEY);
  } catch {
    // After an update, an open tab may ask for a page file that no longer exists.
    // Reload once to get the new version (the flag stops an endless reload loop).
    if (navigator.onLine && session.get(RELOAD_KEY) === null) {
      session.set(RELOAD_KEY, '1');
      location.reload();
      return;
    }
    root.replaceChildren(
      ...pageShell(
        'none',
        h(
          'main',
          { id: 'main', class: 'container text-page' },
          h('h1', { class: 'page-title' }, 'This page didn’t load'),
          h('p', { class: 'lede' }, 'Check your connection and try again. In an emergency, call 911.'),
          h('p', {}, h('a', { class: 'button button--primary', href: location.hash || '#/' }, 'Try again')),
        ),
      ),
    );
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => void route());
// Redraw when the connection drops or comes back, so the offline banner and data stay honest.
window.addEventListener('online', () => void route());
window.addEventListener('offline', () => void route());

// Offline support: register the service worker (production builds only; see src/sw/sw-template.js).
if (FEATURES.offline && import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* the app still works without offline support */
    });
  });
}
// Pages other than Status redraw their shell (header + banner) when Scenario Mode changes.
subscribe(() => {
  if (!['', '#', '#/'].includes(location.hash)) void route();
});
void route();

/**
 * report.ts — "Report a problem" and "Reports near me" (brief, section 11).
 *
 * The flow (under 30 seconds on a phone):
 *   1. Pick a category (big buttons with icons).
 *      "Downed power line" first shows a full-screen safety notice with tap-to-call buttons.
 *   2. Confirm the location: GPS, or tap the map / drag the pin.
 *   3. Optional note (max 280 characters, no personal info).
 *   4. "I'm human" check (Cloudflare Turnstile), then send.
 *   5. Confirmation: visible to others as unverified; NOT sent to the county or city;
 *      here's the official place to report it so it gets fixed.
 */
import { APP_NAME, COUNTIES, TURNSTILE_SITE_KEY } from '../../shared/config';
import { append, h } from '../lib/dom';
import { loadCounties } from '../../shared/data/static';
import { distanceKm, featureAt } from '../../shared/geo';
import {
  CATEGORIES,
  COUNTY_SITES,
  MAX_DESCRIPTION,
  POWER_LINE_DISTANCE_FT,
  categoryInfo,
  looksPersonal,
  type CategoryInfo,
  type ReportCategory,
} from '../../shared/reports/categories';
import { addSimulatedReport, fetchReports, reportsAvailable, simulatedReports, submitReport, type Report } from '../../shared/reports/client';
import { countyName, getState } from '../lib/state';
import { icon } from '../components/icon';
import { pageShell } from '../components/layout';
import { placeSearch } from '../components/placeSearch';
import { reportCard } from '../components/reportCard';
import type { PickMap } from '../components/pickMap';
import '../styles/report.css';

function fill(el: HTMLElement, ...children: (Node | string | null)[]): void {
  el.replaceChildren();
  append(el, children);
}

// ---------- Turnstile ("I'm human" check) ----------

interface TurnstileApi {
  render(
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': (code: string) => boolean;
      theme?: string;
    },
  ): string;
  reset(id?: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Load Cloudflare's Turnstile script once, only when someone is about to send a report. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable')));
    s.onerror = () => reject(new Error('Turnstile unavailable'));
    document.head.append(s);
  });
}

// ---------- pieces ----------

function channelList(info: CategoryInfo, fips: string): HTMLElement {
  return h(
    'ul',
    { class: 'channel-list' },
    ...info.channels.map((c) => {
      const url = c.label === 'Your county’s website' ? COUNTY_SITES[fips] : c.url;
      const label = c.label === 'Your county’s website' ? `${countyName(fips)} County website` : c.label;
      return h(
        'li',
        {},
        url ? h('a', { href: url, rel: 'noopener', target: '_blank' }, label, ' ', icon('ExternalLink')) : h('strong', {}, label),
        c.phone ? h('a', { class: 'channel-list__phone', href: `tel:${c.phone.replace(/\D/g, '')}` }, icon('Phone'), c.phone) : null,
        c.note ? h('span', { class: 'meta' }, c.note) : null,
      );
    }),
  );
}

/** Full-screen safety notice for a downed power line (brief 11.1). */
function powerLineNotice(onContinue: () => void): HTMLDialogElement {
  const dialog = h('dialog', { class: 'dialog emergency-dialog', 'aria-labelledby': 'emergency-title' });
  const cont = h('button', { class: 'button button--secondary', type: 'button' }, 'I’m away from it. Continue to report it here (optional)');
  cont.addEventListener('click', () => {
    dialog.close();
    onContinue();
  });
  const done = h('button', { class: 'button button--text', type: 'button' }, 'Close');
  done.addEventListener('click', () => dialog.close());
  dialog.append(
    h('div', { class: 'emergency-dialog__icon' }, icon('Zap')),
    h('h2', { id: 'emergency-title', class: 'emergency-dialog__title' }, `Stay at least ${POWER_LINE_DISTANCE_FT} feet away.`),
    h('p', { class: 'emergency-dialog__lead' }, 'Call 911 and your power company now. Treat every downed line as live, and stay away from anything touching it, including puddles.'),
    h(
      'div',
      { class: 'emergency-dialog__calls' },
      h('a', { class: 'button button--danger', href: 'tel:911' }, icon('Phone'), 'Call 911'),
      h('a', { class: 'button button--secondary', href: 'tel:8007693766' }, icon('Phone'), 'Duke Energy 800-769-3766'),
      h('a', { class: 'button button--secondary', href: 'tel:8883334465' }, icon('Phone'), 'Dominion Energy 888-333-4465'),
    ),
    h('p', { class: 'meta' }, 'Power from a cooperative or your city? Call the number on your power bill. If a line falls on your car, stay inside and call 911. Sources: Duke Energy and Dominion Energy SC safety guidance.'),
    h('div', { class: 'dialog__actions' }, done, cont),
  );
  dialog.addEventListener('close', () => dialog.remove());
  return dialog;
}

// ---------- page ----------

export function renderReport(root: HTMLElement): () => void {
  document.title = `Report a problem · ${APP_NAME}`;
  const { place, scenario } = getState();
  const simulated = scenario !== null;
  const available = reportsAvailable() || simulated;
  let map: PickMap | null = null;
  let cancelled = false;

  let category: ReportCategory | null = null;
  let spot: { lon: number; lat: number; fips: string } | null = null;
  let token = '';
  let reports: Report[] = [];
  let loadFailed = false; // true when the report list couldn’t be fetched (never show "none nearby" then)

  const formSlot = h('div', {});
  const nearSlot = h('div', {});
  const message = h('p', { class: 'route-message', 'aria-live': 'polite' });
  /** Status text (e.g. "Finding your location…"). */
  const say = (t: string): void => {
    message.classList.remove('form-error');
    message.textContent = t;
  };
  /** Something must be fixed before sending: shown in a clear box and scrolled into view. */
  const problem = (t: string): void => {
    message.textContent = t;
    message.classList.add('form-error');
    message.setAttribute('role', 'alert');
    message.scrollIntoView({ block: 'center' });
  };
  const spotLabel = h('p', { class: 'spot-label' }, 'Location: not set yet');
  const mapEl = h('div', { class: 'pick-map', role: 'region', 'aria-label': 'Map: tap to set the location of the problem, or drag the pin.', hidden: true });
  const description = h('textarea', {
    id: 'report-desc',
    class: 'input textarea',
    maxlength: String(MAX_DESCRIPTION),
    rows: '3',
    'aria-describedby': 'desc-hint desc-count',
  });
  const counter = h('p', { id: 'desc-count', class: 'meta' }, `0 / ${MAX_DESCRIPTION}`);
  description.addEventListener('input', () => (counter.textContent = `${description.value.length} / ${MAX_DESCRIPTION}`));
  // The check runs in an embedded frame. Moving a frame makes the browser reload it, which breaks
  // the check, so every time the form is rebuilt we remove the old widget and make a fresh one.
  let turnstileEl = h('div', { class: 'turnstile-box' });
  let widgetId: string | null = null;
  const sendButton = h('button', { class: 'button button--primary', type: 'submit' }, simulated ? 'Send (simulated)' : 'Send report');

  async function setSpot(lon: number, lat: number): Promise<void> {
    const county = featureAt(await loadCounties(), lon, lat);
    if (!county) {
      spot = null;
      spotLabel.textContent = 'Location: outside the 8 SC-5 counties. Choose a spot inside SC-5.';
      return;
    }
    spot = { lon, lat, fips: county.properties.fips };
    spotLabel.textContent = `Location: ${county.properties.name} County (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    map?.setPin(lon, lat);
    renderNearby();
  }

  function categoryButtons(): HTMLElement {
    return h(
      'fieldset',
      { class: 'category-grid' },
      h('legend', { class: 'subsection-title' }, '1. What’s the problem?'),
      ...CATEGORIES.map((c) => {
        const b = h('button', { class: `category-button${c.id === category ? ' is-selected' : ''}${c.emergency ? ' is-emergency' : ''}`, type: 'button', 'aria-pressed': String(c.id === category) }, icon(c.icon), h('span', {}, c.label));
        b.addEventListener('click', () => {
          const choose = () => {
            category = c.id;
            renderForm();
          };
          if (c.emergency) {
            const d = powerLineNotice(choose);
            document.body.append(d);
            d.showModal();
          } else choose();
        });
        return b;
      }),
    );
  }

  function renderForm(): void {
    if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    widgetId = null;
    token = '';
    turnstileEl = h('div', { class: 'turnstile-box' });
    const locate = h('button', { class: 'button button--secondary', type: 'button' }, icon('LocateFixed'), 'Use my location');
    locate.addEventListener('click', () => {
      if (!('geolocation' in navigator)) return say('This browser can’t share your location. Tap the map instead.');
      say('Finding your location…');
      navigator.geolocation.getCurrentPosition(
        (p) => {
          say('');
          void setSpot(Math.round(p.coords.longitude * 1e5) / 1e5, Math.round(p.coords.latitude * 1e5) / 1e5);
        },
        () => say('Couldn’t get your location. Tap the map instead.'),
        { enableHighAccuracy: true, timeout: 15_000 },
      );
    });

    const form = h(
      'form',
      { class: 'report-form', novalidate: true },
      categoryButtons(),
      category && !available
        ? h(
            'div',
            { class: 'report-form__rest' },
            h('h2', { class: 'subsection-title' }, 'Where to report it'),
            channelList(categoryInfo(category), place.fips),
          )
        : null,
      category && available
        ? h(
            'div',
            { class: 'report-form__rest' },
            h('h2', { class: 'subsection-title' }, '2. Where is it?'),
            h('div', { class: 'start-row' }, locate),
            placeSearch('report-place', 'Or search an address or ZIP code', (f) => void setSpot(Math.round(f.lon * 1e5) / 1e5, Math.round(f.lat * 1e5) / 1e5), say),
            h('p', { class: 'meta' }, 'Or tap the map. You can drag the pin to the exact spot.'),
            spotLabel,
            h('h2', { class: 'subsection-title' }, h('label', { for: 'report-desc' }, '3. Add a short note (optional)')),
            h('p', { id: 'desc-hint', class: 'meta' }, 'Don’t include names, phone numbers, or other personal info. Your note is public.'),
            description,
            counter,
            h('h2', { class: 'subsection-title' }, '4. Send'),
            simulated ? h('p', { class: 'meta' }, 'Scenario Mode is on: this report stays in this browser tab and is not sent anywhere.') : turnstileEl,
            sendButton,
            message,
          )
        : null,
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void send();
    });
    fill(formSlot, form);
    if (category && available && !simulated) void setupTurnstile();
    if (category && available) void ensureMap();
  }

  async function setupTurnstile(): Promise<void> {
    if (!TURNSTILE_SITE_KEY) {
      turnstileEl.textContent = 'The anti-spam check isn’t set up yet, so reports can’t be sent.';
      return;
    }
    try {
      const ts = await loadTurnstile();
      if (cancelled || !turnstileEl.isConnected || turnstileEl.childElementCount) return;
      widgetId = ts.render(turnstileEl, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (t) => (token = t),
        'expired-callback': () => (token = ''),
        // The check can fail when ad blockers, VPNs, or strict privacy settings block Cloudflare.
        'error-callback': (code: string) => {
          token = '';
          problem(
            `The “I’m human” check couldn’t run (code ${code}). Ad blockers, VPNs, or strict privacy settings can block it: try turning them off for this site, or use another browser or your phone. You can still report the problem at the official links for your category.`,
          );
          return true; // we showed our own message
        },
        theme: 'light',
      });
    } catch {
      turnstileEl.textContent = 'The anti-spam check couldn’t load. Check your connection and reload the page.';
    }
  }

  async function ensureMap(): Promise<void> {
    if (map || cancelled) return;
    const { createPickMap } = await import('../components/pickMap');
    if (cancelled) return;
    const seat = COUNTIES.find((c) => c.fips === place.fips)?.seat;
    const center: [number, number] = place.kind === 'point' ? [place.lon, place.lat] : seat ? [seat.lon, seat.lat] : [-81.03, 34.92];
    mapEl.hidden = false;
    map = createPickMap(mapEl, center);
    map.onPick((lon, lat) => void setSpot(lon, lat));
    map.setReports(reports);
    if (spot) map.setPin(spot.lon, spot.lat);
  }

  async function send(): Promise<void> {
    if (!category) return problem('Choose what the problem is.');
    if (!spot) return problem('Set the location: use your location or tap the map.');
    const text = description.value.trim();
    if (text && looksPersonal(text)) return problem('Please remove phone numbers or email addresses from the note.');
    const report = { category, lat: spot.lat, lon: spot.lon, county_fips: spot.fips, description: text || null };
    sendButton.setAttribute('disabled', '');
    try {
      if (simulated) addSimulatedReport(report);
      else {
        if (!token) {
          sendButton.removeAttribute('disabled');
          return problem('Please complete the “I’m human” check first.');
        }
        await submitReport(report, token);
      }
      showConfirmation(categoryInfo(category), spot.fips);
    } catch (err) {
      problem(err instanceof Error ? err.message : 'The report couldn’t be sent. Please try again.');
      if (widgetId) window.turnstile?.reset(widgetId);
      token = '';
      sendButton.removeAttribute('disabled');
    }
  }

  function showConfirmation(info: CategoryInfo, fips: string): void {
    const again = h('button', { class: 'button button--secondary', type: 'button' }, 'Report something else');
    again.addEventListener('click', () => {
      category = null;
      description.value = '';
      token = '';
      renderForm();
      void loadReports();
    });
    fill(
      formSlot,
      h(
        'section',
        { class: 'confirmation', 'aria-labelledby': 'confirm-title', tabindex: '-1' },
        h('h2', { id: 'confirm-title', class: 'section__title' }, icon('CircleCheck'), simulated ? 'Saved in this tab (simulation)' : 'Thanks. Your report is posted.'),
        h(
          'p',
          { class: 'confirmation__lead' },
          simulated
            ? 'In Scenario Mode, reports stay in this browser tab only. Nothing was sent. '
            : 'It’s visible to others as unverified. ',
          h('strong', {}, 'This app does NOT send reports to the county or city.'),
          ' To get it fixed, also report it here:',
        ),
        channelList(info, fips),
        again,
      ),
    );
    (formSlot.querySelector('.confirmation') as HTMLElement | null)?.focus();
    void loadReports();
  }

  // ---------- reports near me ----------

  let filter: ReportCategory | 'all' = 'all';

  function renderNearby(): void {
    if (!available) {
      fill(nearSlot, h('p', { class: 'empty-state' }, icon('Info'), 'Community reports aren’t available yet. You can still use the official links below each category.'));
      return;
    }
    const seat = COUNTIES.find((c) => c.fips === (spot?.fips ?? place.fips))?.seat;
    const from = spot ? [spot.lon, spot.lat] : place.kind === 'point' ? [place.lon, place.lat] : seat ? [seat.lon, seat.lat] : null;
    const shown = reports
      .filter((r) => filter === 'all' || r.category === filter)
      .map((r) => ({ r, km: from ? distanceKm(from[1], from[0], r.lat, r.lon) : null }))
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0))
      .slice(0, 50);
    const select = h(
      'select',
      { id: 'report-filter', class: 'select' },
      h('option', { value: 'all', selected: filter === 'all' }, 'All categories'),
      ...CATEGORIES.map((c) => h('option', { value: c.id, selected: filter === c.id }, c.label)),
    );
    select.addEventListener('change', () => {
      filter = select.value as typeof filter;
      renderNearby();
    });
    fill(
      nearSlot,
      h('div', { class: 'report-filter' }, h('label', { for: 'report-filter', class: 'field-label' }, h('span', {}, icon('ListFilter')), 'Show'), select),
      shown.length
        ? h('ul', { class: 'report-list' }, ...shown.map(({ r, km }) => reportCard(r, km)))
        : loadFailed
          ? h('div', { class: 'notice notice--error' }, icon('CloudOff'), h('p', {}, 'Couldn’t load community reports right now, so we can’t show what’s nearby. You can still send one.'))
          : h('p', { class: 'empty-state' }, icon('CircleCheck'), filter === 'all' ? 'No active community reports nearby.' : 'No active reports in this category nearby.'),
      h('p', { class: 'meta' }, 'Reports are from community members and are not verified. Flooded-road reports disappear after 48 hours and others after 30 days, unless someone taps “Still there.”'),
    );
  }

  async function loadReports(): Promise<void> {
    const local = simulated ? simulatedReports() : [];
    try {
      reports = [...local, ...(reportsAvailable() ? await fetchReports() : [])];
      loadFailed = false;
    } catch {
      reports = local;
      loadFailed = true;
    }
    if (cancelled) return;
    map?.setReports(reports);
    if (reports.length || reportsAvailable() || loadFailed) renderNearby();
  }

  root.replaceChildren(
    ...pageShell(
      'report',
      h(
        'main',
        { id: 'main', class: 'container text-page report-page' },
        h('p', { class: 'eyebrow' }, 'Community reports'),
        h('h1', { class: 'page-title' }, 'Report a problem'),
        h(
          'p',
          { class: 'lede prose' },
          'Let neighbors know about a streetlight out, a downed tree, a flooded road, or other problems. Reports are public and unverified, and this app doesn’t send them to the county or city.',
        ),
        h('p', { class: 'emergency-line' }, icon('Phone'), h('a', { href: 'tel:911' }, 'If anyone is in danger, call 911 first')),
        available ? null : h('div', { class: 'notice' }, icon('Info'), h('p', {}, 'Sending reports isn’t available yet. You can still find the official place to report each problem.')),
        h('div', { class: 'report-layout' }, formSlot, h('div', { class: 'report-layout__map' }, mapEl)),
        h('section', { class: 'section', 'aria-labelledby': 'near-title' }, h('h2', { id: 'near-title', class: 'section__title' }, 'Reports near you'), nearSlot),
      ),
    ),
  );
  renderForm();
  renderNearby();
  void loadReports();

  return () => {
    cancelled = true;
    map?.destroy();
  };
}

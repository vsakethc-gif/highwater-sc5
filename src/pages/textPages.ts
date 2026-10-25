/**
 * textPages.ts — "How it works" (rendered from METHODOLOGY.md) and "About".
 *
 * METHODOLOGY.md is the single source: the same file people read on GitHub
 * is shown in the app, so the two can never disagree.
 */
import { marked } from 'marked';
import methodology from '../../METHODOLOGY.md?raw';
import { APP_NAME } from '../../shared/config';
import { h } from '../lib/dom';
import { pageShell } from '../components/layout';

export function renderMethodology(root: HTMLElement): void {
  document.title = `How it works · ${APP_NAME}`;
  const article = h('article', { class: 'prose-page' });
  // The Markdown is our own file in this repo (not user input), so rendering it as HTML is fine.
  article.innerHTML = marked.parse(methodology, { async: false });
  // Wide tables scroll sideways on small screens instead of breaking the page.
  for (const table of article.querySelectorAll('table')) {
    const wrap = h('div', { class: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': 'Scrollable table' });
    table.replaceWith(wrap);
    wrap.append(table);
  }
  // A short table of contents (built from the section headings) so people can jump
  // straight to the part they need instead of scrolling a very long page.
  const headings = [...article.querySelectorAll('h2')];
  if (headings.length > 3) {
    const list = h('ol', {});
    headings.forEach((heading, i) => {
      heading.id ||= `section-${i + 1}`;
      heading.setAttribute('tabindex', '-1');
      const link = h('a', { href: `#${heading.id}` }, heading.textContent ?? '');
      // The app uses #/page web addresses, so we scroll ourselves instead of changing the address.
      link.addEventListener('click', (e) => {
        e.preventDefault();
        heading.scrollIntoView();
        heading.focus({ preventScroll: true });
      });
      list.append(h('li', {}, link));
    });
    article
      .querySelector('h1')
      ?.after(h('nav', { class: 'toc', 'aria-label': 'On this page' }, h('p', { class: 'toc__title' }, 'On this page'), list));
  }
  root.replaceChildren(...pageShell('methodology', h('main', { id: 'main', class: 'container text-page' }, article)));
}

export function renderAbout(root: HTMLElement): void {
  document.title = `About · ${APP_NAME}`;
  const p = (text: string) => h('p', {}, text);
  const li = (text: string) => h('li', {}, text);
  root.replaceChildren(
    ...pageShell(
      'about',
      h(
        'main',
        { id: 'main', class: 'container text-page' },
        h(
          'article',
          { class: 'prose-page' },
          h('h1', {}, `About ${APP_NAME}`),
          p(
            `${APP_NAME} is a free public web app for the eight counties of South Carolina’s 5th Congressional District: Cherokee, Chester, Fairfield, Kershaw, Lancaster, Lee, Union, and York. It combines official, public data into a clear status for your location and plain-language steps to take.`,
          ),
          p(
            'It was built by a high school student in York County for the 2026 Congressional App Challenge.',
          ),
          h('h2', {}, 'What it can’t do'),
          h(
            'ul',
            {},
            li('It is not an official warning system. It can be late, wrong, or missing alerts. Official alerts, local officials, and 911 come first.'),
            li('It does not predict disasters. It shows official alerts and live readings, and applies the published rules on “How it works.”'),
            li('River gauge readings are provisional, some gauges go offline, and many small creeks have no gauge at all.'),
            li('FEMA flood zones show long-term risk, not where it is flooding today, and some maps are years old.'),
            li('Census figures are estimates with margins of error, especially for small neighborhoods.'),
            li('Routes can’t see every closed or flooded road, and the free routing service can be busy or unavailable.'),
            li('Shelter information is only as current as the FEMA and Red Cross data. Always confirm with your county emergency management office.'),
            li('Community reports are unverified, can be wrong, and are not sent to any government agency.'),
          ),
          h('h2', {}, 'Privacy'),
          p(
            'The app has no accounts, no ads, and no tracking. If you use “Use my location,” your location stays in your browser. It is sent only to the public services that answer for that spot (the National Weather Service forecast and FEMA’s flood map), and it is never saved or put in the web address.',
          ),
          p(
            'When you plan a route, the start and end points go through our small relay server to the routing service and are not stored. Addresses you search for are looked up by the U.S. Census Geocoder the same way.',
          ),
          p(
            'Community reports save only the problem type, the spot, an optional short note, and the time, plus a scrambled code for your device that is used only to limit spam and is never shown. No name, email, phone number, or account is collected, and IP addresses are not stored.',
          ),
          h('h2', {}, 'Data credits'),
          p(
            'U.S. Geological Survey (river levels), NOAA National Water Prediction Service (flood stages), National Weather Service (alerts and rain forecast), FEMA National Flood Hazard Layer (flood zones), FEMA and American Red Cross National Shelter System (open shelters), U.S. Census Bureau (population data, boundaries, and address search), openrouteservice by HeiGIT and OSRM (routes), Iowa Environmental Mesonet at Iowa State University (past alerts for the Helene replay). Map © OpenStreetMap contributors, OpenMapTiles, OpenFreeMap.',
          ),
          h('p', {}, h('a', { href: 'https://github.com/vsakethc-gif/highwater-sc5' }, 'Source code on GitHub')),
        ),
      ),
    ),
  );
}

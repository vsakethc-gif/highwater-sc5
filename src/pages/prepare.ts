/**
 * prepare.ts — "Get ready": what to do for every hazard, on one printable page (brief 12.10).
 *
 * It uses the same guidance engine as the status screen, so the advice always matches.
 * The page is part of the app's code, so once the app has been opened it works offline too.
 */
import { APP_NAME, DISCLAIMER } from '../../shared/config';
import { h } from '../lib/dom';
import { guidanceFor } from '../../shared/guidance/guidance';
import type { GuidanceContext } from '../../shared/guidance/types';
import { HAZARDS } from '../../shared/hazards/hazards';
import type { Level } from '../../shared/hazards/levels';
import type { HazardId } from '../../shared/hazards/types';
import { icon } from '../components/icon';
import { pageShell } from '../components/layout';
import { statusBadge } from '../components/statusBadge';

const ORDER: HazardId[] = ['flood', 'tornado', 'severe_storm', 'tropical', 'heat', 'winter', 'cold', 'wind', 'fire_weather', 'fog', 'air_quality', 'evacuation'];
const CTX: GuidanceContext = { placeName: 'your area', inFloodZone: null, pctNoVehicle: null, vulnerability: null };

function steps(hazard: HazardId, level: Level): string[] {
  return guidanceFor({ hazard, level, triggers: [], updated_at: '' }, CTX).doNow;
}

function hazardCard(id: HazardId): HTMLElement {
  const info = HAZARDS[id];
  const watch = id === 'evacuation' ? null : steps(id, 1);
  const warning = id === 'fog' || id === 'air_quality' ? null : steps(id, id === 'evacuation' ? 3 : 2);
  const block = guidanceFor({ hazard: id, level: 2, triggers: [], updated_at: '' }, CTX);
  const list = (items: string[]) => h('ul', { class: 'checklist' }, ...items.map((s) => h('li', {}, s)));

  return h(
    'section',
    { class: 'prepare-card', id: `prepare-${id}`, 'aria-labelledby': `prepare-${id}-title` },
    h('h2', { id: `prepare-${id}-title`, class: 'prepare-card__title' }, icon(info.icon), info.label),
    block.shelterInPlace
      ? h('p', { class: 'prepare-card__note' }, 'Stay where you are and take shelter. Don’t try to drive away from this hazard.')
      : null,
    watch ? h('div', {}, h('h3', { class: 'prepare-card__level' }, statusBadge(1), 'Get ready'), list(watch)) : null,
    warning ? h('div', {}, h('h3', { class: 'prepare-card__level' }, statusBadge(id === 'evacuation' ? 3 : 2), 'Act now'), list(warning)) : null,
    block.ifWorse.length ? h('div', {}, h('h3', { class: 'prepare-card__level' }, 'If it gets worse'), list(block.ifWorse)) : null,
    h(
      'p',
      { class: 'meta' },
      'Sources: ',
      ...block.links.flatMap((l, i) => [i ? ' · ' : '', h('a', { href: l.url, rel: 'noopener' }, l.label)]),
    ),
  );
}

export function renderPrepare(root: HTMLElement): void {
  document.title = `Get ready · ${APP_NAME}`;
  const print = h('button', { class: 'button button--secondary no-print', type: 'button' }, 'Print this page');
  print.addEventListener('click', () => window.print());

  const jump = h(
    'nav',
    { class: 'jump-links no-print', 'aria-label': 'Hazards on this page' },
    h('ul', {}, ...ORDER.map((id) => h('li', {}, h('a', { href: `#prepare-${id}`, 'data-jump': id }, HAZARDS[id].label)))),
  );
  // In-page links would change the "#/" route, so scroll instead.
  jump.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('a[data-jump]');
    if (!target) return;
    e.preventDefault();
    document.getElementById(`prepare-${target.getAttribute('data-jump')}`)?.scrollIntoView();
  });

  root.replaceChildren(
    ...pageShell(
      'prepare',
      h(
        'main',
        { id: 'main', class: 'container text-page' },
        h(
          'div',
          { class: 'prose-page' },
          h('h1', {}, 'Get ready: what to do for each hazard'),
          h(
            'p',
            { class: 'lede' },
            'The steps this app shows for each kind of alert, all on one page. Print it or keep it on your phone: it works without internet once you’ve opened the app.',
          ),
          h('p', { class: 'emergency-line' }, icon('Phone'), h('a', { href: 'tel:911' }, 'In an emergency, call 911')),
          print,
        ),
        jump,
        h('div', { class: 'prepare-grid' }, ...ORDER.map(hazardCard)),
        h('p', { class: 'disclaimer' }, icon('Phone'), h('span', {}, DISCLAIMER)),
      ),
    ),
  );
}

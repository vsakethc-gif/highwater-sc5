/**
 * guidanceBlock.ts — "What to do": plain-language steps for the top hazard.
 * Every block ends with the disclaimer (brief 9).
 */
import { DISCLAIMER } from '../../shared/config';
import { h } from '../lib/dom';
import type { GuidanceBlock } from '../../shared/guidance/types';
import { icon } from './icon';

export function guidanceBlock(g: GuidanceBlock): HTMLElement {
  const shelter =
    g.shelterInPlace && g.level >= 1
      ? h(
          'div',
          { class: 'callout callout--shelter' },
          icon('House'),
          h(
            'p',
            {},
            h('strong', {}, 'Stay where you are and take shelter. '),
            'For this kind of danger, trying to drive away puts you at more risk. That’s why this app doesn’t offer a route out.',
          ),
        )
      : null;

  return h(
    'section',
    { class: 'guidance', 'aria-labelledby': 'guidance-title' },
    h('h2', { id: 'guidance-title', class: 'section__title' }, 'What to do'),
    shelter,
    h('h3', { class: 'subsection-title' }, 'Do this now'),
    h('ol', { class: 'steps' }, ...g.doNow.map((s) => h('li', {}, s))),
    h('h3', { class: 'subsection-title' }, 'If it gets worse'),
    h('ul', { class: 'bullets' }, ...g.ifWorse.map((s) => h('li', {}, s))),
    h('h3', { class: 'subsection-title' }, 'Check on others'),
    h('p', { class: 'prose' }, g.checkOnOthers),
    h('h3', { class: 'subsection-title' }, 'Official guidance'),
    h(
      'ul',
      { class: 'link-list' },
      ...g.links.map((l) => h('li', {}, h('a', { href: l.url, rel: 'noopener' }, l.label, ' ', icon('ExternalLink')))),
    ),
    h('p', { class: 'disclaimer' }, icon('Phone'), h('span', {}, DISCLAIMER)),
  );
}

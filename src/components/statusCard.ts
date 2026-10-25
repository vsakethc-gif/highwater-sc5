/**
 * statusCard.ts — the big status at the top of the page, and "Why this status?".
 *
 * If key data is missing or stale and nothing raised the level, the card does NOT
 * say "Normal": it says we can't confirm conditions (brief 5.6, no false all-clear).
 */
import { h } from '../lib/dom';
import { HAZARDS } from '../../shared/hazards/hazards';
import { LEVELS, type Level } from '../../shared/hazards/levels';
import type { HazardStatus, OverallStatus, Trigger } from '../../shared/hazards/types';
import type { GuidanceBlock } from '../../shared/guidance/types';
import { clockTime, dateTime, relativeTime } from '../../shared/time';
import { icon } from './icon';
import { statusBadge } from './statusBadge';

export interface StatusCardProps {
  overall: OverallStatus;
  top: GuidanceBlock;
  placeName: string;
  updatedAt: string;
  simulated: boolean;
  /** True only for fresh, complete live data (not simulated, not a saved offline copy). */
  live: boolean;
}

/**
 * The four-step level scale (Normal, Watch, Warning, Danger) with the current level marked,
 * so people see where they are on the scale at a glance. The badge above already says the
 * level in words, so screen readers skip this picture to avoid repeating it.
 */
function levelMeter(level: Level): HTMLElement {
  return h(
    'div',
    { class: 'level-meter', 'aria-hidden': 'true' },
    ...([0, 1, 2, 3] as Level[]).map((l) =>
      h(
        'div',
        { class: `level-meter__step level-meter__step--${LEVELS[l].key}${l <= level ? ' is-on' : ''}${l === level ? ' is-current' : ''}` },
        h('span', { class: 'level-meter__bar' }),
        h('span', { class: 'level-meter__label' }, LEVELS[l].name),
      ),
    ),
  );
}

export function statusCard(p: StatusCardProps): HTMLElement {
  const unconfirmed = !p.overall.complete && p.overall.level === 0;
  const simTag = p.simulated ? h('span', { class: 'sim-tag' }, icon('FlaskConical'), 'Simulated') : null;
  // A softly pulsing dot marks live data; simulated or saved data never gets it.
  const updated = h(
    'p',
    { class: 'meta status-card__updated' },
    p.live ? h('span', { class: 'live-dot' }) : null,
    p.live ? h('strong', {}, 'Live · ') : null,
    `Updated ${relativeTime(p.updatedAt)}, at ${clockTime(p.updatedAt)}`,
  );

  if (unconfirmed) {
    return h(
      'section',
      { class: 'status-card status-card--unknown', 'aria-labelledby': 'status-heading' },
      h('div', { class: 'status-card__top' }, h('span', { class: 'status-badge status-badge--unknown' }, icon('CircleAlert'), 'Can’t confirm'), simTag),
      h('h2', { id: 'status-heading', class: 'status-card__headline' }, `We can’t confirm conditions for ${p.placeName} right now`),
      h('ul', { class: 'status-card__gaps' }, ...p.overall.gaps.map((g) => h('li', {}, g))),
      h(
        'p',
        {},
        'Until this is fixed, check ',
        h('a', { href: 'https://www.weather.gov/alerts' }, 'official alerts on weather.gov'),
        ' and local news.',
      ),
      updated,
    );
  }

  const info = LEVELS[p.overall.level];
  const hazard = HAZARDS[p.top.hazard];
  return h(
    'section',
    { class: `status-card status-card--${info.key}`, 'aria-labelledby': 'status-heading' },
    h(
      'div',
      { class: 'status-card__top' },
      statusBadge(p.overall.level),
      h('span', { class: 'status-card__hazard' }, icon(hazard.icon), hazard.label),
      simTag,
    ),
    h('h2', { id: 'status-heading', class: 'status-card__headline' }, p.top.whatsHappening),
    h('p', { class: 'status-card__meaning' }, info.meaning),
    levelMeter(p.overall.level),
    p.overall.gaps.length
      ? h(
          'div',
          { class: 'status-card__note' },
          icon('Info'),
          h('div', {}, h('p', {}, 'Some data is missing, so this status may be incomplete:'), h('ul', {}, ...p.overall.gaps.map((g) => h('li', {}, g)))),
        )
      : null,
    updated,
  );
}

/** Other active hazards, below the top one. */
export function otherHazards(active: HazardStatus[]): HTMLElement | null {
  if (active.length < 2) return null;
  return h(
    'section',
    { class: 'other-hazards', 'aria-labelledby': 'other-hazards-title' },
    h('h2', { id: 'other-hazards-title', class: 'subsection-title' }, 'Also active here'),
    h(
      'ul',
      { class: 'hazard-list' },
      ...active.slice(1).map((s) =>
        h('li', { class: 'hazard-chip' }, icon(HAZARDS[s.hazard].icon), h('span', {}, HAZARDS[s.hazard].label), statusBadge(s.level)),
      ),
    ),
  );
}

function triggerRow(t: Trigger): HTMLLIElement {
  return h(
    'li',
    { class: 'trigger' },
    statusBadge(t.level),
    h(
      'div',
      {},
      h('p', {}, t.text),
      h(
        'p',
        { class: 'meta' },
        t.url ? h('a', { href: t.url, rel: 'noopener' }, t.source) : t.source,
        t.time ? ` · ${dateTime(t.time)}` : '',
      ),
    ),
  );
}

/**
 * "Why this status?" — every trigger behind the status, with its source.
 * `checks` explains what was looked at when nothing was found (the Normal case).
 */
export function whyStatus(overall: OverallStatus, checks: string[]): HTMLElement {
  const triggers = overall.all.flatMap((s) => s.triggers).filter((t) => t.level > 0);
  triggers.sort((a, b) => b.level - a.level);
  return h(
    'details',
    { class: 'why' },
    h('summary', {}, icon('ChevronDown'), 'Why this status?'),
    h(
      'div',
      { class: 'why__body' },
      triggers.length
        ? h('ul', { class: 'trigger-list' }, ...triggers.map(triggerRow))
        : h('p', {}, 'Nothing we check is above Normal right now.'),
      h('p', { class: 'why__checks-title' }, 'What we checked'),
      h('ul', { class: 'why__checks' }, ...checks.map((c) => h('li', {}, c))),
      h(
        'p',
        { class: 'meta' },
        'The rules are listed on ',
        h('a', { href: '#/methodology' }, 'How it works'),
        '. This is transparent, rule-based analysis of official data, not an official warning.',
      ),
    ),
  );
}

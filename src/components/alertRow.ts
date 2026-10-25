/**
 * alertRow.ts — one active National Weather Service alert.
 *
 * Shows the official event name, headline, and timing, with a link to the
 * full official text. Phase 2 adds our status level and guidance next to it.
 */
import { h } from '../lib/dom';
import type { Alert } from '../../shared/data/types';
import { dateTime } from '../../shared/time';
import { icon } from './icon';

/** NWS alert links point to JSON data, so we send people to the readable official alerts page. */
const OFFICIAL_ALERTS_PAGE = 'https://www.weather.gov/alerts';

export function alertRow(a: Alert): HTMLLIElement {
  const threat = Object.values(a.damage_threat)[0];
  return h(
    'li',
    { class: 'alert-row' },
    h(
      'div',
      { class: 'alert-row__head' },
      icon('CircleAlert'),
      h('h3', { class: 'alert-row__event' }, a.event),
      threat && h('span', { class: 'chip chip--danger' }, `Damage threat: ${threat.toLowerCase()}`),
    ),
    h('p', { class: 'alert-row__headline' }, a.headline),
    h(
      'p',
      { class: 'meta' },
      a.onset ? `From ${dateTime(a.onset)}` : `Issued ${dateTime(a.sent)}`,
      a.ends && ` until ${dateTime(a.ends)}`,
    ),
    h(
      'details',
      { class: 'alert-row__details' },
      h('summary', {}, 'Read the official alert text'),
      h('p', { class: 'alert-row__text' }, a.description),
      a.instruction && h('p', { class: 'alert-row__text' }, h('strong', {}, 'What NWS says to do: '), a.instruction),
      h('p', {}, h('a', { href: OFFICIAL_ALERTS_PAGE, rel: 'noopener' }, 'All official alerts on weather.gov ', icon('ExternalLink'))),
    ),
  );
}

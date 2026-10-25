/**
 * rainCard.ts — forecast rainfall for the next 24 and 48 hours.
 */
import { THRESHOLDS } from '../../shared/config';
import { h } from '../lib/dom';
import type { Loaded } from '../../shared/data/types';
import type { RainForecast } from '../../shared/hazards/types';
import { dateTime } from '../../shared/time';

function stat(label: string, inches: number): HTMLElement {
  return h(
    'div',
    { class: 'stat' },
    h('p', { class: 'stat__label' }, label),
    h('p', { class: 'stat__value num' }, inches.toFixed(2), h('span', { class: 'stat__unit' }, ' in')),
  );
}

export function rainCard(rain: Loaded<RainForecast> | Error, where: string): HTMLElement {
  if (rain instanceof Error) {
    return h(
      'div',
      { class: 'notice notice--error' },
      h('div', {}, h('p', { class: 'notice__title' }, 'Couldn’t load the rain forecast.'), h('p', {}, 'Alerts and river levels may still be working.')),
    );
  }
  return h(
    'div',
    { class: 'rain-card' },
    h('div', { class: 'stat-row' }, stat('Next 24 hours', rain.data.next24h_in), stat('Next 48 hours', rain.data.next48h_in)),
    h(
      'p',
      { class: 'meta' },
      `Forecast for ${where} · Source: ${rain.source} · Issued ${dateTime(rain.data.updated_at)}. `,
      `${THRESHOLDS.rainWatchInches24h} inches or more in 24 hours raises flooding to Watch.`,
    ),
  );
}

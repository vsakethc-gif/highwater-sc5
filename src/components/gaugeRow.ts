/**
 * gaugeRow.ts — one river or stream gauge: name, current height, trend, flood category, sparkline.
 */
import { h } from '../lib/dom';
import type { FloodCategory, Gauge, Trend } from '../../shared/data/types';
import { feet, gaugeName } from '../../shared/format';
import { clockTime, isStale, relativeTime } from '../../shared/time';
import { icon, type IconName } from './icon';
import { sparkline } from './sparkline';

const TREND: Record<Trend, { label: string; icon: IconName | null }> = {
  rising: { label: 'Rising', icon: 'TrendingUp' },
  falling: { label: 'Falling', icon: 'TrendingDown' },
  steady: { label: 'Steady', icon: 'ArrowRight' },
  unknown: { label: 'Trend unknown', icon: null },
};

/** Flood categories reuse the status colors, matching the flood rules (brief 7.4). */
const CATEGORY: Record<FloodCategory, { label: string; key: string }> = {
  action: { label: 'Action stage', key: 'watch' },
  minor: { label: 'Minor flooding', key: 'warning' },
  moderate: { label: 'Moderate flooding', key: 'danger' },
  major: { label: 'Major flooding', key: 'danger' },
};

function floodChip(g: Gauge): HTMLElement {
  if (!g.has_official_stage) return h('span', { class: 'chip chip--muted' }, 'No official flood stage');
  if (!g.latest) return h('span', { class: 'chip chip--muted' }, 'No recent reading');
  if (!g.flood_category) return h('span', { class: 'chip' }, 'Below flood stage');
  const c = CATEGORY[g.flood_category];
  return h('span', { class: `chip chip--${c.key}` }, c.label);
}

export function gaugeRow(g: Gauge): HTMLLIElement {
  const trend = TREND[g.trend];
  const stale = g.latest ? isStale(g.latest.time) : false;

  const reading = g.latest
    ? h(
        'div',
        { class: 'gauge-row__reading' },
        h('span', { class: 'gauge-row__value num' }, feet(g.latest.value)),
        h('span', { class: 'gauge-row__trend' }, trend.icon && icon(trend.icon), trend.label),
      )
    : h('div', { class: 'gauge-row__reading' }, h('span', { class: 'meta' }, 'No reading in the last 6 hours'));

  const stageLine =
    g.stages && g.stages.minor !== null
      ? h('span', { class: 'num' }, `Flood stage ${g.stages.minor} ft`)
      : null;

  return h(
    'li',
    { class: 'gauge-row' },
    h(
      'div',
      { class: 'gauge-row__main' },
      h('h3', { class: 'gauge-row__name' }, gaugeName(g.name)),
      h(
        'p',
        { class: 'meta' },
        g.latest ? `Read at ${clockTime(g.latest.time)} (${relativeTime(g.latest.time)})` : `USGS ${g.site_id}`,
        stageLine && ' · ',
        stageLine,
      ),
      stale && h('p', { class: 'stale-note' }, icon('Clock'), 'Old reading. This gauge may be offline.'),
    ),
    reading,
    h('div', { class: 'gauge-row__chart' }, sparkline(g.recent_series), floodChip(g)),
  );
}

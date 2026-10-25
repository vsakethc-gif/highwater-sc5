/**
 * statusBadge.ts — the small colored label for a status level.
 * It always shows an icon AND the level name, so it never relies on color alone.
 */
import { h } from '../lib/dom';
import { LEVELS, type Level } from '../../shared/hazards/levels';
import { icon } from './icon';

export function statusBadge(level: Level): HTMLSpanElement {
  const info = LEVELS[level];
  return h('span', { class: `status-badge status-badge--${info.key}` }, icon(info.icon), info.name);
}

/**
 * reportCard.ts — one community report: category, "Unverified" label, when, the person's
 * note (always shown as plain text, never as HTML), and "Still there" / "Fixed" / "Flag".
 */
import { h } from '../lib/dom';
import { categoryInfo } from '../../shared/reports/categories';
import { voteOnReport, type Report } from '../../shared/reports/client';
import { relativeTime } from '../../shared/time';
import { icon } from './icon';

export function reportCard(r: Report, distanceKm: number | null): HTMLLIElement {
  const info = categoryInfo(r.category);
  const status = h('p', { class: 'report-card__status meta', 'aria-live': 'polite' });

  const vote = (kind: 'confirm' | 'fixed' | 'flag', label: string, iconName: 'ThumbsUp' | 'Check' | 'Flag') => {
    const b = h('button', { class: 'button button--secondary report-card__vote', type: 'button', disabled: Boolean(r.simulated) }, icon(iconName), label);
    b.addEventListener('click', async () => {
      if (kind === 'flag' && !window.confirm('Flag this report as inappropriate? Reports with 3 flags are hidden until reviewed.')) return;
      b.setAttribute('disabled', '');
      try {
        const result = await voteOnReport(r.id, kind);
        status.textContent =
          result === 'already_voted'
            ? 'You already did that for this report.'
            : kind === 'confirm'
              ? 'Thanks. This report will stay visible longer.'
              : kind === 'fixed'
                ? 'Thanks. Reports marked fixed by 3 people are closed.'
                : 'Thanks. Reports flagged by 3 people are hidden until reviewed.';
      } catch (err) {
        status.textContent = err instanceof Error ? err.message : 'That didn’t go through. Please try again.';
        b.removeAttribute('disabled');
      }
    });
    return b;
  };

  return h(
    'li',
    { class: 'report-card' },
    h(
      'div',
      { class: 'report-card__head' },
      h('span', { class: 'report-card__icon' }, icon(info.icon)),
      h('div', {}, h('h3', { class: 'report-card__title' }, info.label), h('p', { class: 'meta' }, `Reported ${relativeTime(r.created_at)}`, distanceKm !== null ? ` · ${(distanceKm / 1.609).toFixed(1)} mi away` : '')),
      h('span', { class: 'chip chip--muted' }, r.simulated ? 'Simulated' : 'Unverified'),
    ),
    // textContent via h(): a person's note can never run as code (prevents XSS).
    r.description ? h('p', { class: 'report-card__desc' }, r.description) : null,
    r.confirm_count > 0 ? h('p', { class: 'meta' }, `${r.confirm_count} ${r.confirm_count === 1 ? 'person says' : 'people say'} it’s still there`) : null,
    h('div', { class: 'report-card__actions' }, vote('confirm', 'Still there', 'ThumbsUp'), vote('fixed', 'Fixed', 'Check'), vote('flag', 'Flag', 'Flag')),
    status,
  );
}

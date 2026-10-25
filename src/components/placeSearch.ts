/**
 * placeSearch.ts — find a place by ZIP code (built-in list) or street address
 * (U.S. Census Geocoder, through our Worker). Used by the route planner and the
 * report page, so people who can't use GPS or tap a map (keyboard or screen-reader
 * users, or anyone without location access) can still set a location.
 *
 * It's a plain group, not a <form>, so it can sit inside another form (the report form).
 * Pressing Enter in the box searches, just like clicking Find.
 */
import { WORKER_URL } from '../../shared/config';
import { h } from '../lib/dom';
import { loadZips } from '../../shared/data/static';
import { searchAddress } from '../../shared/routing/plan';
import { icon } from './icon';

export interface FoundPlace {
  lon: number;
  lat: number;
  label: string;
}

export function placeSearch(id: string, label: string, onFound: (p: FoundPlace) => void, say: (text: string) => void): HTMLElement {
  const input = h('input', {
    id,
    class: 'input',
    type: 'text',
    autocomplete: 'street-address',
    placeholder: WORKER_URL ? 'Address or ZIP code' : 'ZIP code',
  });
  const results = h('ul', { class: 'search-results' });
  const find = h('button', { class: 'button button--secondary', type: 'button' }, icon('Search'), 'Find');

  async function search(): Promise<void> {
    const q = input.value.trim();
    results.replaceChildren();
    if (!q) return say('Type an address or a 5-digit ZIP code.');
    if (/^\d{5}$/.test(q)) {
      const z = (await loadZips().catch(() => ({}) as Record<string, [number, number, string]>))[q];
      if (!z) return say(`ZIP ${q} isn’t in the 8 SC-5 counties.`);
      return onFound({ lon: z[1], lat: z[0], label: `ZIP ${q}` });
    }
    if (!WORKER_URL) return say('Address search isn’t available yet. Enter a 5-digit ZIP code.');
    say('Searching…');
    try {
      const matches = await searchAddress(q);
      if (!matches.length) return say('No matching address found. Check the spelling, or try a ZIP code.');
      say(`${matches.length} match${matches.length > 1 ? 'es' : ''} found. Choose one.`);
      results.replaceChildren(
        ...matches.map((m) => {
          const b = h('button', { class: 'search-result', type: 'button' }, m.label);
          b.addEventListener('click', () => {
            results.replaceChildren();
            onFound({ lon: m.lon, lat: m.lat, label: m.label });
          });
          return h('li', {}, b);
        }),
      );
      (results.querySelector('button') as HTMLButtonElement | null)?.focus();
    } catch (err) {
      say(err instanceof Error ? err.message : 'Address search failed. Try a ZIP code.');
    }
  }

  find.addEventListener('click', () => void search());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // don't submit a surrounding form
      void search();
    }
  });

  return h(
    'div',
    { class: 'place-search', role: 'search' },
    h('label', { for: id, class: 'field-label' }, label),
    h('div', { class: 'zip-form__row' }, input, find),
    results,
  );
}

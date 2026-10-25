/**
 * locationBar.ts — choose a place: a county, your current location, or a ZIP code.
 *
 * "Use my location" asks the browser for GPS. The coordinates stay on this device:
 * they're used to find the county and are sent only to the public data services
 * that answer for that spot (NWS rain forecast, FEMA flood zone). They're never saved.
 */
import { COUNTIES } from '../../shared/config';
import { h } from '../lib/dom';
import { featureAt } from '../../shared/geo';
import { loadCounties, loadZips } from '../../shared/data/static';
import { getState, setState } from '../lib/state';
import { icon } from './icon';

export function locationBar(): HTMLElement {
  const place = getState().place;
  const message = h('p', { class: 'location-bar__message', 'aria-live': 'polite' });
  const say = (text: string) => (message.textContent = text);

  // County picker
  const select = h(
    'select',
    { id: 'county-select', class: 'select' },
    ...COUNTIES.map((c) =>
      h('option', { value: c.fips, selected: place.kind === 'county' && place.fips === c.fips }, c.name),
    ),
    place.kind === 'point' ? h('option', { value: '', selected: true, disabled: true }, place.label) : null,
  );
  select.addEventListener('change', () => setState({ place: { kind: 'county', fips: select.value } }));

  // Use my location
  const locate = h('button', { class: 'button button--secondary', type: 'button' }, icon('LocateFixed'), h('span', { class: 'locate-label' }, 'Use my location'));
  locate.addEventListener('click', () => {
    if (!('geolocation' in navigator)) return say('This browser can’t share your location. Choose a county or enter a ZIP code.');
    locate.setAttribute('disabled', '');
    say('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        locate.removeAttribute('disabled');
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const county = featureAt(await loadCounties(), lon, lat);
          if (!county) return say('Your location is outside the 8 SC-5 counties this app covers. Choose a county instead.');
          setState({ place: { kind: 'point', fips: county.properties.fips, lat, lon, label: 'Your location' } });
        } catch {
          say('Couldn’t load county boundaries. Choose a county instead.');
        }
      },
      (err) => {
        locate.removeAttribute('disabled');
        say(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was turned down. You can choose a county or enter a ZIP code instead.'
            : 'Couldn’t get your location. Choose a county or enter a ZIP code.',
        );
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    );
  });

  // ZIP search (uses a built-in list, no outside service)
  const zipInput = h('input', {
    id: 'zip-input',
    class: 'input',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'postal-code',
    maxlength: '5',
    pattern: '[0-9]{5}',
    placeholder: '29730',
  });
  const zipForm = h(
    'form',
    { class: 'zip-form', role: 'search' },
    h('label', { for: 'zip-input', class: 'field-label' }, 'ZIP code'),
    h('div', { class: 'zip-form__row' }, zipInput, h('button', { class: 'button button--secondary', type: 'submit' }, icon('Search'), 'Go')),
  );
  zipForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const zip = zipInput.value.trim();
    if (!/^\d{5}$/.test(zip)) return say('Enter a 5-digit ZIP code.');
    try {
      const entry = (await loadZips())[zip];
      if (!entry) return say(`ZIP ${zip} isn’t in the 8 SC-5 counties this app covers.`);
      const [lat, lon, fips] = entry;
      setState({ place: { kind: 'point', fips, lat, lon, label: `ZIP ${zip}` } });
    } catch {
      say('Couldn’t load the ZIP code list. Choose a county instead.');
    }
  });

  return h(
    'div',
    { class: 'location-bar' },
    h(
      'div',
      { class: 'location-bar__county' },
      h('label', { for: 'county-select', class: 'field-label' }, 'County'),
      select,
    ),
    h('div', { class: 'location-bar__locate' }, locate),
    zipForm,
    message,
  );
}

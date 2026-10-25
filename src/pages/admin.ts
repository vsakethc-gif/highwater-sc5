/**
 * admin.ts — a private page for the app's owner to hide, restore, or resolve reports
 * (brief 11.5). It is not linked anywhere in the app; open it at #/admin.
 *
 * Sign-in uses Supabase Auth (email + password you set in the Supabase dashboard).
 * The database only lets signed-in users listed in the `admins` table see all reports
 * or change their status, so this page can't do anything for anyone else.
 * The sign-in token is kept only in memory: closing the tab signs you out.
 */
import { APP_NAME, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../../shared/config';
import { h } from '../lib/dom';
import { categoryInfo } from '../../shared/reports/categories';
import { countyName } from '../lib/state';
import { dateTime } from '../../shared/time';
import { icon } from '../components/icon';
import { pageShell } from '../components/layout';
import '../styles/report.css';

interface AdminReport {
  id: string;
  category: string;
  county_fips: string;
  description: string | null;
  created_at: string;
  status: 'active' | 'hidden' | 'resolved' | 'expired';
  confirm_count: number;
  resolved_votes: number;
  flag_count: number;
  lat: number;
  lon: number;
}

let accessToken: string | null = null;

const headers = () => ({ apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' });

async function signIn(email: string, password: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error_description?: string; msg?: string }).error_description ?? 'Sign-in failed.');
  accessToken = (json as { access_token: string }).access_token;
}

async function loadAll(): Promise<AdminReport[]> {
  const cols = 'id,category,county_fips,description,created_at,status,confirm_count,resolved_votes,flag_count,lat,lon';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/reports?select=${cols}&order=created_at.desc&limit=300`, { headers: headers() });
  if (!res.ok) throw new Error(`Couldn’t load reports (${res.status}). Is your account in the admins table?`);
  return res.json();
}

async function setStatus(id: string, status: AdminReport['status']): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/reports?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Couldn’t update (${res.status}).`);
}

export function renderAdmin(root: HTMLElement): void {
  document.title = `Admin · ${APP_NAME}`;
  const body = h('div', {});
  const message = h('p', { class: 'route-message', 'aria-live': 'polite' });

  function loginForm(): HTMLElement {
    const email = h('input', { id: 'admin-email', class: 'input', type: 'email', autocomplete: 'username', required: true });
    const password = h('input', { id: 'admin-password', class: 'input', type: 'password', autocomplete: 'current-password', required: true });
    const form = h(
      'form',
      { class: 'admin-login' },
      h('label', { for: 'admin-email', class: 'field-label' }, 'Email'),
      email,
      h('label', { for: 'admin-password', class: 'field-label' }, 'Password'),
      password,
      h('button', { class: 'button button--primary', type: 'submit' }, icon('ShieldCheck'), 'Sign in'),
      message,
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      message.textContent = 'Signing in…';
      try {
        await signIn(email.value, password.value);
        password.value = '';
        await showReports();
      } catch (err) {
        message.textContent = err instanceof Error ? err.message : 'Sign-in failed.';
      }
    });
    return form;
  }

  async function showReports(): Promise<void> {
    body.replaceChildren(h('p', { class: 'meta' }, 'Loading…'));
    let reports: AdminReport[];
    try {
      reports = await loadAll();
    } catch (err) {
      body.replaceChildren(h('p', { class: 'notice notice--error' }, err instanceof Error ? err.message : 'Error'));
      return;
    }
    const signOut = h('button', { class: 'button button--text', type: 'button' }, icon('LogOut'), 'Sign out');
    signOut.addEventListener('click', () => {
      accessToken = null;
      body.replaceChildren(loginForm());
    });
    const action = (r: AdminReport, status: AdminReport['status'], label: string) => {
      const b = h('button', { class: 'button button--secondary', type: 'button', disabled: r.status === status }, label);
      b.addEventListener('click', async () => {
        try {
          await setStatus(r.id, status);
          await showReports();
        } catch (err) {
          window.alert(err instanceof Error ? err.message : 'Error');
        }
      });
      return b;
    };
    body.replaceChildren(
      h('div', { class: 'admin-bar' }, h('p', {}, `${reports.length} reports (all statuses, newest first)`), signOut),
      h(
        'div',
        { class: 'table-scroll' },
        h(
          'table',
          { class: 'data-table admin-table' },
          h('thead', {}, h('tr', {}, ...['Report', 'Status', 'Votes', 'Actions'].map((t) => h('th', { scope: 'col' }, t)))),
          h(
            'tbody',
            {},
            ...reports.map((r) =>
              h(
                'tr',
                { class: r.flag_count ? 'is-flagged' : '' },
                h(
                  'td',
                  {},
                  h('strong', {}, categoryInfo(r.category).label),
                  h('span', { class: 'data-table__help' }, `${countyName(r.county_fips)} County · ${dateTime(r.created_at)} · ${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}`),
                  r.description ? h('span', { class: 'data-table__help' }, r.description) : null,
                ),
                h('td', {}, r.status),
                h('td', { class: 'num' }, `${r.confirm_count} still · ${r.resolved_votes} fixed · ${r.flag_count} flags`),
                h('td', {}, h('div', { class: 'report-card__actions' }, action(r, 'hidden', 'Hide'), action(r, 'active', 'Restore'), action(r, 'resolved', 'Resolve'))),
              ),
            ),
          ),
        ),
      ),
    );
  }

  body.replaceChildren(
    SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY ? loginForm() : h('p', { class: 'notice' }, 'The reports database isn’t connected yet.'),
  );
  root.replaceChildren(
    ...pageShell(
      'none',
      h(
        'main',
        { id: 'main', class: 'container text-page' },
        h('p', { class: 'eyebrow' }, 'Private'),
        h('h1', { class: 'page-title' }, 'Report moderation'),
        h('p', { class: 'lede prose' }, 'For the app’s owner only. Hide inappropriate reports, restore ones hidden by mistake, or close fixed ones.'),
        body,
      ),
    ),
  );
}

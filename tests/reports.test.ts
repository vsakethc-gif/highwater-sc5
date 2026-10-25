import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateReport, validateVote, looksPersonal as workerLooksPersonal, hasBlockedWord } from '../worker/src/validate';
import { CATEGORIES, COUNTY_SITES, POWER_LINE_DISTANCE_FT, expiryHours, looksPersonal, categoryInfo } from '../shared/reports/categories';
import { reportsNearLine, type Report } from '../shared/reports/client';

const good = {
  category: 'streetlight_out',
  lat: 34.9249,
  lon: -81.0251,
  county_fips: '45091',
  description: 'Light out by the bus stop',
  device_id: '3f1c2b9e-5d4a-4b7e-9a1f-2c3d4e5f6a7b',
  turnstile_token: 'XXXX.DUMMY.TOKEN.XXXX',
};

describe('report checks in the Worker (brief 11.5)', () => {
  it('accepts a normal report and rounds the location to 5 decimals', () => {
    const r = validateReport({ ...good, lat: 34.9249123456 });
    if (typeof r === 'string') throw new Error(r);
    expect(r.lat).toBe(34.92491);
  });

  it('rejects unknown categories and places outside SC-5', () => {
    expect(validateReport({ ...good, category: 'ufo' })).toMatch(/category/);
    expect(validateReport({ ...good, lat: 32.78, lon: -79.93 })).toMatch(/SC-5/); // Charleston
    expect(validateReport({ ...good, county_fips: '45045' })).toMatch(/SC-5/); // Greenville
  });

  it('limits the note to 280 characters', () => {
    expect(validateReport({ ...good, description: 'x'.repeat(281) })).toMatch(/280/);
    expect(typeof validateReport({ ...good, description: 'x'.repeat(280) })).toBe('object');
  });

  it('rejects phone numbers, emails, and offensive words in the note', () => {
    expect(validateReport({ ...good, description: 'call me at 803-555-1234' })).toMatch(/phone numbers/);
    expect(validateReport({ ...good, description: 'email jane@example.com' })).toMatch(/email/);
    expect(validateReport({ ...good, description: 'this shit is broken' })).toMatch(/offensive/);
  });

  it('requires the "I’m human" check and a device ID', () => {
    expect(validateReport({ ...good, turnstile_token: '' })).toMatch(/human/);
    expect(validateReport({ ...good, device_id: 'x' })).toMatch(/device/);
  });

  it('an empty note is stored as no note', () => {
    const r = validateReport({ ...good, description: '   ' });
    if (typeof r === 'string') throw new Error(r);
    expect(r.description).toBeNull();
  });

  it('checks votes', () => {
    expect(typeof validateVote({ report_id: '3f1c2b9e-5d4a-4b7e-9a1f-2c3d4e5f6a7b', kind: 'confirm', device_id: good.device_id })).toBe('object');
    expect(validateVote({ report_id: 'nope', kind: 'confirm', device_id: good.device_id })).toMatch(/Unknown report/);
    expect(validateVote({ report_id: '3f1c2b9e-5d4a-4b7e-9a1f-2c3d4e5f6a7b', kind: 'delete', device_id: good.device_id })).toMatch(/Unknown vote/);
  });

  it('the browser and the Worker use the same personal-info rule', () => {
    for (const t of ['803 555 1234', '(803) 555-1234', 'a@b.co', 'Pothole on Main St', 'Route 5 near mile 12']) {
      expect(looksPersonal(t)).toBe(workerLooksPersonal(t));
    }
  });

  it('word filter matches whole words only', () => {
    expect(hasBlockedWord('Dickerson Road sign is down')).toBe(false);
    expect(hasBlockedWord('what a dick')).toBe(true);
  });
});

describe('categories and official channels (brief 11.1–11.2)', () => {
  it('has the 9 categories from the brief', () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual([
      'Streetlight out',
      'Traffic signal out',
      'Downed tree or debris on road',
      'Flooded road',
      'Blocked storm drain',
      'Pothole or road damage',
      'Damaged or missing sign',
      'Downed power line',
      'Something else',
    ]);
  });

  it('only "Downed power line" is an emergency, and it uses the utilities’ 30-foot rule', () => {
    expect(CATEGORIES.filter((c) => c.emergency).map((c) => c.id)).toEqual(['downed_power_line']);
    expect(POWER_LINE_DISTANCE_FT).toBe(30);
  });

  it('every category points somewhere official, and links only to verified sites', () => {
    const allowed = /^https:\/\/(apps\.scdot\.org|www\.duke-energy\.com|www\.dominionenergy\.com)\//;
    for (const c of CATEGORIES) {
      expect(c.channels.length, c.id).toBeGreaterThan(0);
      for (const ch of c.channels) if (ch.url) expect(ch.url).toMatch(allowed);
    }
  });

  it('has a county website for all 8 counties', () => {
    expect(Object.keys(COUNTY_SITES).sort()).toEqual(['45021', '45023', '45039', '45055', '45057', '45061', '45087', '45091']);
  });

  it('flooded-road reports expire after 48 hours; others after 30 days (same as the database)', () => {
    expect(expiryHours('flooded_road')).toBe(48);
    expect(expiryHours('pothole')).toBe(720);
    const sql = readFileSync('supabase/schema.sql', 'utf8');
    expect(sql).toContain("when category = 'flooded_road' then interval '48 hours' else interval '30 days'");
  });

  it('unknown category ids fall back to "Something else"', () => {
    expect(categoryInfo('nope').id).toBe('other');
  });
});

describe('database security rules (supabase/schema.sql)', () => {
  const sql = readFileSync('supabase/schema.sql', 'utf8');
  it('turns on Row Level Security for every table', () => {
    for (const t of ['reports', 'votes', 'admins']) expect(sql).toContain(`alter table public.${t} enable row level security`);
  });
  it('never lets the public read the device hash', () => {
    const grant = sql.match(/grant select \(([^)]+)\) on public\.reports to anon, authenticated/)![1];
    expect(grant).not.toContain('device_hash');
  });
  it('only the secret key may call the write functions', () => {
    expect(sql).toMatch(/revoke all on function public\.submit_report[^;]+from public, anon, authenticated/);
    expect(sql).toMatch(/revoke all on function public\.vote_report[^;]+from public, anon, authenticated/);
  });
  it('stores no names, emails, phones, or IP addresses', () => {
    const table = sql.slice(sql.indexOf('create table if not exists public.reports'), sql.indexOf('create index'));
    expect(table).not.toMatch(/\b(name|email|phone|ip_address)\b/);
  });
});

describe('reports near a route (brief 10.1)', () => {
  const r = (lat: number, lon: number): Report => ({
    id: String(lat),
    category: 'flooded_road',
    lat,
    lon,
    county_fips: '45091',
    description: null,
    created_at: '',
    last_confirmed_at: '',
    confirm_count: 0,
    resolved_votes: 0,
  });
  it('finds reports within 100 m of the route line', () => {
    const line = [[-81.0, 34.9], [-81.0, 34.95]];
    expect(reportsNearLine([r(34.9, -81.0005), r(34.9, -81.01)], line).map((x) => x.id)).toEqual(['34.9']);
  });
});

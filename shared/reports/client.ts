/**
 * client.ts — reading and sending community reports.
 *
 *   Read:  straight from Supabase with the PUBLIC key. The database only returns active,
 *          non-expired reports and safe columns (Row Level Security, supabase/schema.sql).
 *   Send:  through our Worker, which checks Turnstile and the content before saving.
 *   Scenario Mode: reports stay in this browser tab only and are never sent (brief 12.8).
 *
 * Privacy: no name, email, phone, or account. A random device ID (not tied to who you are)
 * is kept on this device so the database can limit how many reports one device sends.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, WORKER_URL } from '../config';
import type { ReportCategory } from './categories';
import { platform } from '../platform';

export interface Report {
  id: string;
  category: ReportCategory;
  lat: number;
  lon: number;
  county_fips: string;
  description: string | null;
  created_at: string;
  last_confirmed_at: string;
  confirm_count: number;
  resolved_votes: number;
  /** true for a Scenario Mode report kept only in this tab. */
  simulated?: boolean;
}

export const reportsAvailable = (): boolean => Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && WORKER_URL);

const DEVICE_KEY = 'sc5ready.device';
const SIM_KEY = 'sc5ready.simReports';

/** A random ID for this device, made once. It identifies a device, not a person. */
export function deviceId(): string {
  const { storage, randomId } = platform();
  try {
    let id = storage.getItem(DEVICE_KEY);
    if (!id) {
      id = randomId();
      storage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return randomId(); // storage blocked: a fresh ID each time still works
  }
}

const COLUMNS = 'id,category,lat,lon,county_fips,description,created_at,last_confirmed_at,confirm_count,resolved_votes';

/** Active reports in SC-5, newest first (at most 500). */
export async function fetchReports(signal?: AbortSignal): Promise<Report[]> {
  if (!reportsAvailable()) throw new Error('Community reports aren’t set up yet.');
  const url = `${SUPABASE_URL}/rest/v1/reports?select=${COLUMNS}&order=created_at.desc&limit=500`;
  const res = await fetch(url, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY }, signal: signal ?? AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Reports service returned ${res.status}`);
  return (await res.json()) as Report[];
}

export interface NewReport {
  category: ReportCategory;
  lat: number;
  lon: number;
  county_fips: string;
  description: string | null;
}

async function post(path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Error ${res.status}`);
  return json;
}

export async function submitReport(r: NewReport, turnstileToken: string): Promise<string> {
  const json = (await post('/report', { ...r, device_id: deviceId(), turnstile_token: turnstileToken })) as { id: string };
  return json.id;
}

export async function voteOnReport(reportId: string, kind: 'confirm' | 'fixed' | 'flag'): Promise<'ok' | 'already_voted'> {
  const json = (await post('/vote', { report_id: reportId, kind, device_id: deviceId() })) as { result: 'ok' | 'already_voted' };
  return json.result;
}

// ---------- Scenario Mode: local-only reports ----------

export function simulatedReports(): Report[] {
  try {
    return JSON.parse(platform().session.getItem(SIM_KEY) ?? '[]') as Report[];
  } catch {
    return [];
  }
}

export function addSimulatedReport(r: NewReport): Report {
  const now = new Date().toISOString();
  const report: Report = { ...r, id: platform().randomId(), created_at: now, last_confirmed_at: now, confirm_count: 0, resolved_votes: 0, simulated: true };
  try {
    platform().session.setItem(SIM_KEY, JSON.stringify([report, ...simulatedReports()]));
  } catch {
    /* ignore */
  }
  return report;
}

/** Flooded-road reports near a route (brief 10.1): within `meters` of any route point. */
export function reportsNearLine(reports: Report[], line: number[][], meters = 100): Report[] {
  const degLat = meters / 111_000;
  const degLon = meters / (111_000 * Math.cos((34.5 * Math.PI) / 180));
  return reports.filter((r) => line.some(([lon, lat]) => Math.abs(lat - r.lat) <= degLat && Math.abs(lon - r.lon) <= degLon));
}

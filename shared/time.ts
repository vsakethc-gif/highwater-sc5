/**
 * time.ts — "updated 5 minutes ago" text and the stale-data rule.
 */
import { THRESHOLDS } from './config';

/** "just now", "12 minutes ago", "3 hours ago", "2 days ago". */
export function relativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}

/** Clock time for display, e.g. "6:45 PM". Shown in the viewer's own time zone. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Date and time, e.g. "Sat, Oct 17, 6:45 PM". */
export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Data older than the threshold (2 hours) is "stale": shown with a warning, never as an all-clear. */
export function isStale(iso: string, now = Date.now()): boolean {
  return now - Date.parse(iso) > THRESHOLDS.staleAfterMinutes * 60_000;
}

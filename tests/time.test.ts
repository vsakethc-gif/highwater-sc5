import { describe, it, expect } from 'vitest';
import { relativeTime, isStale } from '../shared/time';

const now = Date.parse('2026-10-17T22:00:00Z');

describe('relativeTime', () => {
  it('formats minutes, hours, and days', () => {
    expect(relativeTime('2026-10-17T21:59:45Z', now)).toBe('just now');
    expect(relativeTime('2026-10-17T21:48:00Z', now)).toBe('12 minutes ago');
    expect(relativeTime('2026-10-17T21:00:00Z', now)).toBe('1 hour ago');
    expect(relativeTime('2026-10-15T22:00:00Z', now)).toBe('2 days ago');
  });
});

describe('isStale (2-hour rule)', () => {
  it('fresh at 1h59m, stale at 2h01m', () => {
    expect(isStale('2026-10-17T20:01:00Z', now)).toBe(false);
    expect(isStale('2026-10-17T19:59:00Z', now)).toBe(true);
  });
});

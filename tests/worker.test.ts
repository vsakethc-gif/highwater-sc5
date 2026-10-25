import { describe, it, expect } from 'vitest';
import { validateRoute, validateQuery, orsBody, RateLimiter, MAX_AVOID_POLYGONS } from '../worker/src/validate';

const ROCK_HILL = [-81.029, 34.923];
const LANCASTER = [-80.771, 34.72];

describe('Worker request checks', () => {
  it('accepts a normal trip in South Carolina', () => {
    const r = validateRoute({ start: ROCK_HILL, end: LANCASTER, alternatives: true });
    expect(typeof r).toBe('object');
  });

  it('rejects points far from South Carolina (protects our routing quota)', () => {
    expect(validateRoute({ start: [-118.24, 34.05], end: LANCASTER })).toMatch(/South Carolina/);
    expect(validateRoute({ start: 'here', end: LANCASTER })).toMatch(/Start and end/);
    expect(validateRoute(null)).toMatch(/JSON/);
  });

  it('limits how many avoid areas and points can be sent', () => {
    const ring = [ROCK_HILL, [-81.0, 34.923], [-81.0, 34.95], ROCK_HILL];
    const many = Array.from({ length: MAX_AVOID_POLYGONS + 1 }, () => [ring]);
    expect(validateRoute({ start: ROCK_HILL, end: LANCASTER, avoid: many })).toMatch(/Too many/);
    expect(validateRoute({ start: ROCK_HILL, end: LANCASTER, avoid: [[ring.slice(0, 2)]] })).toMatch(/at least 4/);
  });

  it('builds the OpenRouteService request with avoid polygons and alternatives', () => {
    const ring = [ROCK_HILL, [-81.0, 34.923], [-81.0, 34.95], ROCK_HILL];
    const r = validateRoute({ start: ROCK_HILL, end: LANCASTER, avoid: [[ring]], alternatives: true });
    if (typeof r === 'string') throw new Error(r);
    const body = orsBody(r) as any;
    expect(body.coordinates).toEqual([ROCK_HILL, LANCASTER]);
    expect(body.options.avoid_polygons.type).toBe('MultiPolygon');
    expect(body.alternative_routes.target_count).toBe(2);
  });

  it('address search text must be short and not empty', () => {
    expect(validateQuery('  155 Johnston St, Rock Hill  ')).toBe('155 Johnston St, Rock Hill');
    expect(validateQuery('')).toBeNull();
    expect(validateQuery('x'.repeat(121))).toBeNull();
  });
});

describe('rate limiter', () => {
  it('allows up to the limit in the window, then blocks, then allows again later', () => {
    const rl = new RateLimiter(3, 60_000);
    expect([rl.allow('a', 0), rl.allow('a', 1), rl.allow('a', 2), rl.allow('a', 3)]).toEqual([true, true, true, false]);
    expect(rl.allow('b', 3)).toBe(true); // each visitor counted separately
    expect(rl.allow('a', 60_001)).toBe(true);
  });
});

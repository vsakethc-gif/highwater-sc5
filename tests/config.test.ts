import { describe, it, expect } from 'vitest';
import { COUNTIES, DEFAULT_COUNTY_FIPS, FEATURES, DISCLAIMER } from '../shared/config';

describe('config', () => {
  it('lists the 8 core SC-5 counties with valid, unique South Carolina FIPS codes', () => {
    expect(COUNTIES).toHaveLength(8);
    for (const c of COUNTIES) expect(c.fips).toMatch(/^45\d{3}$/);
    expect(new Set(COUNTIES.map((c) => c.fips)).size).toBe(8);
  });

  it('default county is one of the listed counties', () => {
    expect(COUNTIES.some((c) => c.fips === DEFAULT_COUNTY_FIPS)).toBe(true);
  });

  it('every feature flag is a simple on/off switch', () => {
    for (const on of Object.values(FEATURES)) expect(typeof on).toBe('boolean');
  });

  it('disclaimer mentions 911 and that this is not an official warning system', () => {
    expect(DISCLAIMER).toContain('911');
    expect(DISCLAIMER).toContain('not an official warning system');
  });
});

import { describe, it, expect } from 'vitest';
import { LEVELS, highestLevel } from '../shared/hazards/levels';

describe('status levels', () => {
  it('has exactly four levels named Normal, Watch, Warning, Danger', () => {
    expect([0, 1, 2, 3].map((l) => LEVELS[l as 0 | 1 | 2 | 3].name)).toEqual(['Normal', 'Watch', 'Warning', 'Danger']);
  });

  it('gives every level its own icon, so levels never rely on color alone', () => {
    const icons = Object.values(LEVELS).map((l) => l.icon);
    expect(new Set(icons).size).toBe(4);
  });

  it('overall status is the highest level among hazards', () => {
    expect(highestLevel([0, 2, 1])).toBe(2);
    expect(highestLevel([3, 0])).toBe(3);
  });

  it('no hazards at all means Normal', () => {
    expect(highestLevel([])).toBe(0);
  });
});

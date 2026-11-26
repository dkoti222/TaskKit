import { MIN_GAP, nextPosition, POSITION_GAP, positionAt } from './position';

const list = (...positions: number[]) => positions.map((position) => ({ position }));

describe('positionAt', () => {
  it('gives the first item of an empty list the standard gap', () => {
    expect(positionAt([], 0)).toBe(POSITION_GAP);
  });

  it('puts an item at the top at half the first position', () => {
    expect(positionAt(list(1000, 2000), 0)).toBe(500);
  });

  it('puts an item at the end one gap after the last', () => {
    expect(positionAt(list(1000, 2000), 2)).toBe(3000);
  });

  it('treats an index past the end as "at the end"', () => {
    expect(positionAt(list(1000, 2000), 2)).toBe(positionAt(list(1000, 2000), 2));
  });

  it('puts an item between two neighbours halfway', () => {
    expect(positionAt(list(1000, 2000, 3000), 1)).toBe(1500);
    expect(positionAt(list(1000, 1500), 1)).toBe(1250);
  });

  it('keeps the order when halving many times', () => {
    let siblings = list(1000, 2000);
    // 1000 halved 15 times is ~0.03, still above MIN_GAP: no renumbering needed yet.
    for (let i = 0; i < 15; i++) {
      const p = positionAt(siblings, 1)!;
      expect(p).toBeGreaterThan(siblings[0].position);
      expect(p).toBeLessThan(siblings[1].position);
      siblings = [siblings[0], { position: p }];
    }
  });

  it('returns null when neighbours are too close (time to renumber)', () => {
    expect(positionAt(list(1, 1 + MIN_GAP), 1)).toBeNull();
    expect(positionAt(list(MIN_GAP), 0)).toBeNull();
  });
});

describe('nextPosition', () => {
  it('adds one gap after the last position, or starts at one gap', () => {
    expect(nextPosition(null)).toBe(POSITION_GAP);
    expect(nextPosition(undefined)).toBe(POSITION_GAP);
    expect(nextPosition(4000)).toBe(5000);
  });
});

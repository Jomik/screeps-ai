import { calculateDistanceTransform } from './distance-transform';

const getResultOfGenerator = <T>(gen: Generator<unknown, T, unknown>): T => {
  for (;;) {
    const { value, done } = gen.next();
    if (done) {
      return value;
    }
  }
};

const mapToDT = (map: number[][]): number[][] => {
  // Assume square
  const size = map.length;
  const cm = new PathFinder.CostMatrix();
  // Seed cost matrix
  map.forEach((row, x) => {
    row.forEach((value, y) => {
      cm.set(x, y, value === 0 ? 0 : Infinity);
    });
  });

  const uut = calculateDistanceTransform(
    { x: [0, size - 1], y: [0, size - 1] },
    cm
  );

  // Unwind the generator
  const result = getResultOfGenerator(uut);

  // Populate a map with result
  const arr = Array.from(Array(size), () => [] as number[]);
  for (let x = 0; x <= size - 1; ++x) {
    for (let y = 0; y <= size - 1; ++y) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      arr[x]![y] = result.get(x, y);
    }
  }

  return arr;
};

describe('distance-transform', () => {
  it('sees borders as edges', () => {
    const result = mapToDT([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ]);
    expect(result).toEqual([
      [1, 1, 1],
      [1, 2, 1],
      [1, 1, 1],
    ]);
  });
  it('respects walls', () => {
    const result = mapToDT([
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ]);
    expect(result).toEqual([
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ]);
  });
  it('measures distance', () => {
    const result = mapToDT([
      [1, 1, 1, 1, 1],
      [1, 0, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
    ]);
    expect(result).toEqual([
      [1, 1, 1, 1, 1],
      [1, 0, 1, 2, 1],
      [1, 1, 2, 2, 1],
      [1, 2, 2, 2, 1],
      [1, 1, 1, 1, 1],
    ]);
  });
});

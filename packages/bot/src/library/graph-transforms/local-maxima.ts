import { sleep, Thread } from 'kernel';
import {
  Coordinates,
  expandOrtogonally,
  coordinatesToNumber,
  numberToCoordinates,
} from '../coordinates';

export function* findLocalMaxima(
  distanceTransform: CostMatrix
): Thread<Array<Coordinates[]>> {
  const candidates = new Set<number>();
  const maxima: Set<number>[] = [];
  for (let x = 1; x <= 48; ++x) {
    for (let y = 1; y <= 48; ++y) {
      const value = distanceTransform.get(x, y);
      if (value === 0) {
        continue;
      }
      const neighbours = expandOrtogonally([x, y]);
      if (
        neighbours.some(([nx, ny]) => distanceTransform.get(nx, ny) > value)
      ) {
        continue;
      }
      candidates.add(coordinatesToNumber([x, y]));
    }
  }
  yield* sleep();
  for (const origin of [...candidates]) {
    if (maxima.some((group) => group.has(origin))) {
      continue;
    }
    const group = new Set<number>([origin]);
    let filtered = false;
    for (const currentPacked of group) {
      yield;
      const current = numberToCoordinates(currentPacked);
      const value = distanceTransform.get(...current);
      for (const neighbour of expandOrtogonally(current)) {
        const nvalue = distanceTransform.get(...neighbour);
        if (nvalue !== value) {
          continue;
        }
        const packedNeighbour = coordinatesToNumber(neighbour);
        group.add(packedNeighbour);

        if (!candidates.has(packedNeighbour)) {
          filtered = true;
        }
      }
    }
    if (filtered) {
      group.forEach((packed) => {
        candidates.delete(packed);
      });
    } else {
      maxima.push(group);
    }
  }

  return maxima.map((set) => [...set].map(numberToCoordinates));
}

import { Thread } from 'kernel';
import { findLocalMaxima } from './graph-transforms';
import { Coordinates } from './coordinates';

export function* chooseBaseOrigin(
  room: Room,
  distanceTransform: CostMatrix
): Thread<Coordinates> {
  const maxima = yield* findLocalMaxima(distanceTransform);
  const candidates = maxima.flatMap((c) => c);
  yield;

  const poi: Array<{ pos: RoomPosition }> = room.find(FIND_SOURCES);

  let sourceCost = Infinity;
  let bestPos: Coordinates = [0, 0];
  for (const [x, y] of candidates) {
    yield;
    if (distanceTransform.get(x, y) < 6) {
      continue;
    }
    const candidatePosition = new RoomPosition(x, y, room.name);
    const cost = poi.reduce(
      (acc, cur) =>
        acc +
        PathFinder.search(candidatePosition, { pos: cur.pos, range: 1 }).cost,
      0
    );

    if (cost < sourceCost) {
      sourceCost = cost;
      bestPos = [x, y];
    }
  }

  return bestPos;
}

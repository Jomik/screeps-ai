import { exit, Thread } from 'kernel';
import { findLocalMaxima } from '../graph-transforms';
import { Coordinates, RoomPlan } from './plan';

const BASE_SIZE = 10;
const BASE_SWAMP_COST = 7;

export function* chooseBaseOrigin(plan: RoomPlan): Thread<Coordinates> {
  const maxima = yield* findLocalMaxima(plan.buildingSpace);
  const candidates = maxima.flatMap((c) => c);
  yield;

  const room = Game.rooms[plan.roomName];
  if (!room) {
    return exit(`No vision in room ${plan.roomName}`);
  }
  const poi: Array<{ pos: RoomPosition }> = room.find(FIND_SOURCES);
  if (room.controller) {
    poi.push(room.controller);
  }

  const terrain = room.getTerrain();

  let sourceCost = Infinity;
  let bestPos: Coordinates = [0, 0];
  for (const [x, y] of candidates) {
    yield;
    const candidatePosition = new RoomPosition(x, y, room.name);
    let cost = poi.reduce(
      (acc, cur) =>
        acc +
        PathFinder.search(
          candidatePosition,
          { pos: cur.pos, range: 1 },
          {
            swampCost: 10,
            plainCost: 2,
          }
        ).cost,
      0
    );

    for (let offsetX = 0; offsetX <= BASE_SIZE; ++offsetX) {
      for (let offsetY = 0; offsetY <= BASE_SIZE; ++offsetY) {
        if (terrain.get(x + offsetX, y + offsetY) & TERRAIN_MASK_SWAMP) {
          cost += BASE_SWAMP_COST;
        }
      }
    }

    if (cost < sourceCost) {
      sourceCost = cost;
      bestPos = [x, y];
    }
  }

  return bestPos;
}

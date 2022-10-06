import { createProcess, exit, Thread } from 'kernel';
import { createLogger, distanceTransform } from '../library';
import {
  chooseBaseOrigin,
  Coordinates,
  coordinatesToNumber,
  getRoomPlan,
  isNextToRoad,
  numberToCoordinates,
  RoomPlan,
  saveRoomPlan,
  structureCosts,
} from '../library/room-planning';
import { expandCorners, expandOrtogonally, expandPosition } from '../utils';

const TARGET_CONTROLLER_LEVEL = 8;
const logger = createLogger('room-planner');

function* getRoadTo(
  origin: Coordinates,
  target: Coordinates,
  roomName: string,
  navigation: CostMatrix
): Thread<Coordinates[]> {
  const room = Game.rooms[roomName];
  if (!room) {
    return exit(`No vision in room ${roomName}`);
  }

  const originPos = new RoomPosition(origin[0], origin[1], roomName);
  const res = PathFinder.search(
    originPos,
    { pos: new RoomPosition(target[0], target[1], roomName), range: 1 },
    {
      roomCallback: () => navigation,
      maxRooms: 1,
      plainCost: 2,
      swampCost: 10,
    }
  );
  if (res.incomplete) {
    logger.warn(`No path to ${JSON.stringify(target)}`);
    return [];
  }

  return res.path.map(({ x, y }) => [x, y]);
}

export const roomPlanner = createProcess(function* (roomName: string) {
  const room = Game.rooms[roomName];
  if (!room) {
    return exit(`No vision in room ${roomName}`);
  }

  const plan = getRoomPlan(roomName);
  saveRoomPlan(plan, 'initial');

  // Set up distance transform
  const terrain = room.getTerrain();

  for (let x = 0; x <= 49; ++x) {
    for (let y = 0; y <= 49; ++y) {
      plan.buildingSpace.set(
        x,
        y,
        terrain.get(x, y) & TERRAIN_MASK_WALL ? 0 : Infinity
      );
    }
  }
  room
    .find(FIND_EXIT)
    .forEach(({ x, y }) =>
      [[x, y] as Coordinates, ...expandPosition([x, y])].forEach(([x, y]) =>
        plan.buildingSpace.set(x, y, 0)
      )
    );

  yield* distanceTransform(
    {
      x: [1, 48],
      y: [1, 48],
    },
    plan.buildingSpace
  );
  saveRoomPlan(plan, 'done');

  const origin = yield* chooseBaseOrigin(plan);
  const originPos = new RoomPosition(origin[0], origin[1], plan.roomName);
  yield;

  // TODO: Do something about existing structures?
  const structures = room.find(FIND_STRUCTURES);
  for (const { pos, structureType } of structures) {
    if (
      structureType === STRUCTURE_CONTROLLER ||
      structureType === STRUCTURE_INVADER_CORE ||
      structureType === STRUCTURE_PORTAL ||
      structureType === STRUCTURE_POWER_BANK ||
      structureType === STRUCTURE_KEEPER_LAIR
    ) {
      continue;
    }
    plan.structures.push([structureType, pos.x, pos.y]);
    plan.base.set(pos.x, pos.y, 255);
    const road = yield* getRoadTo(
      origin,
      [pos.x, pos.y],
      plan.roomName,
      plan.base
    );
    plan.structures.push(
      ...road.map(
        ([x, y]) => [STRUCTURE_ROAD, x, y] as RoomPlan['structures'][number]
      )
    );
  }
  yield;

  plan.structures.push(
    ...expandCorners(origin)
      .filter(([x, y]) => plan.base.get(x, y) === 0)
      .map(([x, y]) => [STRUCTURE_ROAD, x, y] as RoomPlan['structures'][number])
  );
  plan.structures
    .filter(([type]) => type === STRUCTURE_ROAD)
    .forEach(([_, x, y]) => plan.base.set(x, y, 1));
  saveRoomPlan(plan, 'done');
  yield;

  const typeToCount = Object.entries(CONTROLLER_STRUCTURES).map<
    [BuildableStructureConstant, number]
  >(([type, { [TARGET_CONTROLLER_LEVEL]: count = 0 }]) =>
    type === STRUCTURE_STORAGE
      ? [type, Math.max(1, count)]
      : [type as BuildableStructureConstant, count]
  );

  let bestType: BuildableStructureConstant | undefined = undefined;
  let bestCost = Infinity;

  const queue = new Set<number>();
  queue.add(coordinatesToNumber(origin));
  for (const coord of queue) {
    yield;
    const coordinates = numberToCoordinates(coord);
    expandOrtogonally(coordinates).forEach((c) =>
      queue.add(coordinatesToNumber(c))
    );
    const [x, y] = coordinates;
    if (
      plan.base.get(x, y) > 0 ||
      plan.buildingSpace.get(x, y) <= 0 ||
      terrain.get(x, y) & TERRAIN_MASK_WALL
    ) {
      continue;
    }

    bestCost = Infinity;
    bestType = undefined;

    for (const [structureType, count] of typeToCount) {
      if (
        (plan.structures.filter(([type]) => type === structureType).length ??
          0) >= count
      ) {
        continue;
      }
      yield;

      const cost = yield* structureCosts[structureType](
        coordinates,
        plan,
        bestCost
      );

      if (cost < bestCost) {
        bestCost = cost;
        bestType = structureType;
      }
    }

    if (bestType !== undefined) {
      plan.structures.push([bestType, ...coordinates]);
      plan.base.set(x, y, 255);

      if (!isNextToRoad(coordinates, plan)) {
        const result = PathFinder.search(
          new RoomPosition(x, y, plan.roomName),
          { pos: originPos, range: 1 },
          {
            maxRooms: 1,
            plainCost: 2,
            swampCost: 10,
            roomCallback: () => plan.base,
          }
        );
        result.path.forEach((p) => {
          plan.structures.push([STRUCTURE_ROAD, p.x, p.y]);
          plan.base.set(p.x, p.y, 1);
        });
      }
      saveRoomPlan(plan, 'done');
    }
  }

  saveRoomPlan(plan, 'done');
  return;
});

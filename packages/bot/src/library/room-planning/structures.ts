import { exit, Thread } from 'kernel';
import type { Coordinates, RoomPlan } from './plan';
import { dist } from './utils';

const constantCost = (cost: number) =>
  function* (
    [_x, _y]: Coordinates,
    _plan: RoomPlan,
    _maxCost: number
  ): Thread<number> {
    return cost;
  };

function* calculateExtensionCost(
  [x, y]: Coordinates,
  plan: RoomPlan,
  maxCost: number
): Thread<number> {
  const storage = plan.structures.find(([type]) => type === STRUCTURE_STORAGE);
  if (!storage) {
    return Infinity;
  }

  const result = PathFinder.search(
    new RoomPosition(x, y, plan.roomName),
    {
      pos: new RoomPosition(storage[1], storage[2], plan.roomName),
      range: 1,
    },
    {
      maxRooms: 1,
      maxCost,
      plainCost: 2,
      swampCost: 10,
      roomCallback: () => plan.base,
    }
  );
  return result.incomplete ? Infinity : result.cost;
}

function* calculateContainerCost(
  [x, y]: Coordinates,
  plan: RoomPlan,
  _maxCost: number
): Thread<number> {
  const room = Game.rooms[plan.roomName];
  if (!room) {
    return exit(`No vision in room ${plan.roomName}`);
  }
  const pos = new RoomPosition(x, y, plan.roomName);

  if (
    plan.structures.some(
      ([type, cx, cy]) =>
        type === STRUCTURE_CONTAINER &&
        Math.abs(x - cx) <= 6 &&
        Math.abs(y - cy) <= 6
    ) ??
    false
  ) {
    return Infinity;
  }

  if (room.controller && pos.getRangeTo(room.controller) === 3) {
    return 0;
  }

  if (pos.findInRange(FIND_SOURCES, 1).length > 0) {
    return 0;
  }

  return Infinity;
}

function* calculateLabCost(
  [x, y]: Coordinates,
  plan: RoomPlan,
  _maxCost: number
): Thread<number> {
  const labs = plan.structures.filter(([type]) => type === STRUCTURE_LAB);
  if (labs.length === 0) {
    if (plan.buildingSpace.get(x, y) > 3) {
      return -1;
    }
    return Infinity;
  }

  if (labs.length < 3) {
    if (
      labs.filter(([, ...lab]) => dist([x, y], lab) <= 1).length === labs.length
    ) {
      return -10;
    }
    return Infinity;
  }

  if (
    labs.filter(([, ...lab]) => dist([x, y], lab) <= 2).length >=
    Math.min(labs.length, 4)
  ) {
    return -10;
  }

  return Infinity;
}

export const structureCosts: Record<
  BuildableStructureConstant,
  (coords: Coordinates, plan: RoomPlan, maxCost: number) => Thread<number>
> = {
  [STRUCTURE_EXTRACTOR]: constantCost(Infinity),
  [STRUCTURE_LINK]: constantCost(Infinity),
  [STRUCTURE_RAMPART]: constantCost(Infinity),
  [STRUCTURE_ROAD]: constantCost(Infinity),
  [STRUCTURE_TOWER]: constantCost(Infinity),
  [STRUCTURE_WALL]: constantCost(Infinity),

  [STRUCTURE_FACTORY]: constantCost(10),
  [STRUCTURE_NUKER]: constantCost(10),
  [STRUCTURE_OBSERVER]: constantCost(10),
  [STRUCTURE_POWER_SPAWN]: constantCost(10),
  [STRUCTURE_TERMINAL]: constantCost(0),
  [STRUCTURE_SPAWN]: constantCost(1),

  [STRUCTURE_CONTAINER]: calculateContainerCost,
  [STRUCTURE_EXTENSION]: calculateExtensionCost,
  [STRUCTURE_LAB]: calculateLabCost,
  [STRUCTURE_STORAGE]: constantCost(-Infinity),
};

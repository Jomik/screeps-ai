import { createLogger } from '../library';
import { sleep } from '../library/sleep';
import { groupBy, isDefined, isStructureType, min } from '../utils';
import { intelRef } from './intel-manager';

const logger = createLogger('hauler');

const intel = intelRef.get();
const pickupEnergy = (hauler: Creep, need: number, includeContainer = true) => {
  if (!hauler.memory.home) {
    return;
  }
  const containers = includeContainer
    ? hauler.room
        .find(FIND_STRUCTURES)
        .filter(isStructureType(STRUCTURE_CONTAINER, STRUCTURE_STORAGE))
    : hauler.room
        .find(FIND_STRUCTURES)
        .filter(isStructureType(STRUCTURE_CONTAINER, STRUCTURE_STORAGE))
        .filter(
          (s) =>
            s.pos.findInRange(FIND_SOURCES, 1).length > 0 &&
            (!s.room.controller || s.pos.getRangeTo(s.room.controller) > 3)
        );

  const rooms = Object.values(Game.map.describeExits(hauler.memory.home))
    .filter(
      (roomName) =>
        Game.map.getRoomStatus(roomName).status === 'normal' &&
        !intel[roomName]?.hostile
    )
    .concat(hauler.memory.home)
    .map((roomName) => Game.rooms[roomName])
    .filter(isDefined);
  const energyDrops = rooms.flatMap((room) =>
    room.find(FIND_DROPPED_RESOURCES, {
      filter: ({ resourceType }) => resourceType === RESOURCE_ENERGY,
    })
  );

  const ruins = hauler.room.find(FIND_RUINS);
  const tombstones = hauler.room.find(FIND_TOMBSTONES);

  const targets = (
    [...containers, ...ruins, ...tombstones].filter(
      (target) => target.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    ) as Array<
      StructureContainer | Ruin | Tombstone | StructureStorage | Resource
    >
  ).concat(...energyDrops);
  const targetsWithNeeded = targets.filter((s) =>
    s instanceof Resource
      ? s.amount >= need
      : s.store.getUsedCapacity(RESOURCE_ENERGY) >= need
  );

  const targetWithNeededPath = PathFinder.search(
    hauler.pos,
    targetsWithNeeded.map(({ pos }) => pos)
  );

  const targetPath = !targetWithNeededPath.incomplete
    ? targetWithNeededPath
    : PathFinder.search(
        hauler.pos,
        targets.map(({ pos }) => pos)
      );

  const targetPos = targetPath.path[targetPath.path.length - 1];

  const target =
    targetPath.incomplete || !targetPos
      ? null
      : targets.find((target) => target.pos.isEqualTo(targetPos));

  if (!target) {
    return;
  }

  if (target instanceof Resource) {
    if (hauler.pickup(target) === OK) {
      return;
    }
  } else {
    if (hauler.withdraw(target, RESOURCE_ENERGY) === OK) {
      return;
    }
  }

  hauler.moveTo(target, {
    range: 1,
    visualizePathStyle: {
      lineStyle: 'dashed',
      stroke: 'yellow',
      opacity: 0.2,
    },
  });
};

const PriorityMap = {
  [STRUCTURE_TOWER]: 1,
  [STRUCTURE_SPAWN]: 2,
  [STRUCTURE_EXTENSION]: 2,
  [STRUCTURE_LINK]: 3,
  [STRUCTURE_CONTAINER]: 4,
  [STRUCTURE_STORAGE]: 7,
};

type HaulerTarget = ConcreteStructure<keyof typeof PriorityMap>;

const isHaulerTarget = isStructureType(
  ...(Object.keys(PriorityMap) as HaulerTarget['structureType'][])
);

const findHaulerTarget = (hauler: Creep): HaulerTarget | null => {
  if (!hauler.memory.home) {
    return null;
  }

  const room = Game.rooms[hauler.memory.home];
  if (!room) {
    return null;
  }

  if (hauler.memory.target) {
    const target = Game.getObjectById(hauler.memory.target);
    if (
      target &&
      !(target instanceof ConstructionSite) &&
      isHaulerTarget(target) &&
      target.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    ) {
      return target as HaulerTarget;
    }
    hauler.memory.target = undefined;
  }

  const potentialTargets = room
    .find(FIND_STRUCTURES)
    .filter(
      <T extends AnyStructure>(
        structure: T
      ): structure is T extends { structureType: keyof typeof PriorityMap }
        ? T
        : never => structure.structureType in PriorityMap
    )
    .filter(
      ({ store, structureType, pos }) =>
        store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
        (structureType !== STRUCTURE_LINK ||
          pos.findInRange(FIND_MY_SPAWNS, 5).length > 0)
    );

  const groupedByPriority = groupBy(
    potentialTargets,
    (t) => PriorityMap[t.structureType]
  );
  const [, targets] =
    min(Object.entries(groupedByPriority), ([p]) => Number.parseInt(p)) ?? [];

  if (!targets) {
    return null;
  }

  const pathResult = PathFinder.search(
    hauler.pos,
    targets.map(({ pos }) => pos)
  );
  const targetPos = pathResult.path[pathResult.path.length - 1];

  if (pathResult.incomplete || !targetPos) {
    return null;
  }

  const target = targets.find(({ pos }) => pos.isEqualTo(targetPos));
  // TODO: Be smarter about finding targets for haulers
  // hauler.memory.target = target?.id;

  return target ?? null;
};

export function* runHauler(id: Id<Creep>) {
  for (;;) {
    yield sleep();
    const hauler = Game.getObjectById(id);
    if (!hauler) {
      return;
    }

    const target = findHaulerTarget(hauler);

    const need = Math.min(
      hauler.store.getCapacity(RESOURCE_ENERGY),
      target?.store.getFreeCapacity(RESOURCE_ENERGY) ?? Infinity
    );

    if (hauler.store.getUsedCapacity(RESOURCE_ENERGY) < need) {
      pickupEnergy(
        hauler,
        need - hauler.store.getUsedCapacity(RESOURCE_ENERGY),
        target instanceof Structure
          ? !(
              [
                STRUCTURE_CONTAINER,
                STRUCTURE_STORAGE,
              ] as BuildableStructureConstant[]
            ).includes(target.structureType)
          : false
      );
      continue;
    }

    if (!target) {
      continue;
    }

    if (hauler.transfer(target, RESOURCE_ENERGY) !== OK) {
      hauler.moveTo(target, {
        visualizePathStyle: {
          lineStyle: 'dashed',
          stroke: 'green',
          opacity: 0.2,
        },
      });
    }
  }
}

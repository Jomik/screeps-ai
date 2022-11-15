import { Routine } from 'coroutines';
import { createLogger } from '../library';
import { sleep } from '../library/sleep';
import { go } from '../runner';
import { isDefined, isStructureType } from '../utils';
import { runHauler } from './hauler';
import { intelRef } from './intel-manager';

const logger = createLogger('creep-manager');

const pickupEnergy = (worker: Creep, need: number) => {
  const containers = worker.room
    .find(FIND_STRUCTURES)
    .filter(isStructureType(STRUCTURE_CONTAINER, STRUCTURE_STORAGE));
  const energyDrops = worker.room.find(FIND_DROPPED_RESOURCES, {
    filter: ({ resourceType }) => resourceType === RESOURCE_ENERGY,
  });

  const ruins = worker.room.find(FIND_RUINS);
  const links = worker.room
    .find(FIND_MY_STRUCTURES)
    .filter(isStructureType(STRUCTURE_LINK));
  const tombstones = worker.room.find(FIND_TOMBSTONES);
  const targets = [
    ...containers,
    ...energyDrops,
    ...ruins,
    ...tombstones,
    ...links,
  ];
  const targetsWithNeeded = targets.filter((s) =>
    s instanceof Resource
      ? s.amount >= need
      : s.store.getUsedCapacity(RESOURCE_ENERGY) >= need
  );
  const target =
    worker.pos.findClosestByRange(targetsWithNeeded) ??
    worker.pos.findClosestByRange(
      targets.filter((s) =>
        s instanceof Resource
          ? s.amount > 0
          : s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
      )
    );

  if (!target) {
    return;
  }

  if (target instanceof Resource) {
    if (worker.pickup(target) === OK) {
      return;
    }
  } else {
    if (worker.withdraw(target, RESOURCE_ENERGY) === OK) {
      return;
    }
  }

  worker.moveTo(target, {
    range: 1,
    visualizePathStyle: {
      lineStyle: 'dashed',
      stroke: 'yellow',
      opacity: 0.2,
    },
  });
};

function* runMiner(id: Id<Creep>) {
  for (;;) {
    yield sleep();
    const miner = Game.getObjectById(id);
    if (!miner) {
      return;
    }
    if (!isDefined(miner.memory.slot)) {
      miner.suicide();
      return;
    }

    const [x, y, roomName = miner.room.name] = miner.memory.slot;
    const target = new RoomPosition(x, y, roomName);
    if (!miner.pos.isEqualTo(target)) {
      miner.moveTo(target, {
        visualizePathStyle: { lineStyle: 'dashed', opacity: 0.2 },
      });
    }
    const [source] = miner.pos.findInRange(FIND_SOURCES_ACTIVE, 1);
    if (source === undefined) {
      continue;
    }

    miner.harvest(source);
    if (miner.store.getFreeCapacity()) {
      continue;
    }

    const container = miner.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: (structure): structure is StructureContainer =>
        structure.structureType === STRUCTURE_CONTAINER,
    });
    if (container && miner.pos.getRangeTo(container) === 1) {
      miner.transfer(container, RESOURCE_ENERGY);
    }
  }
}

function* runAttacker(id: Id<Creep>) {
  for (;;) {
    yield sleep();
    const attacker = Game.getObjectById(id);
    if (!attacker) {
      return;
    }

    const enemy = attacker.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (enemy) {
      attacker.moveTo(enemy, {
        range: 1,
        visualizePathStyle: { lineStyle: 'dashed', opacity: 0.2 },
      });
      attacker.attack(enemy);
    }
  }
}

const getStoredWorkerTarget = (
  worker: Creep
): AnyStructure | ConstructionSite | null => {
  const storedTarget = worker.memory.target
    ? Game.getObjectById(worker.memory.target)
    : null;
  if (!storedTarget) {
    worker.memory.target = undefined;
    return null;
  }

  if (storedTarget instanceof ConstructionSite) {
    return storedTarget;
  }

  if (storedTarget.hits >= storedTarget.hitsMax) {
    worker.memory.target = undefined;
    return null;
  }
  return storedTarget;
};

const DirectionConstants: DirectionConstant[] = [
  TOP,
  TOP_RIGHT,
  RIGHT,
  BOTTOM_RIGHT,
  BOTTOM,
  BOTTOM_LEFT,
  LEFT,
  TOP_LEFT,
];

function* runWorker(id: Id<Creep>) {
  for (;;) {
    yield sleep();
    const worker = Game.getObjectById(id);
    if (!worker) {
      return;
    }
    const room = worker.room;

    const target =
      getStoredWorkerTarget(worker) ??
      room
        .find(FIND_STRUCTURES, {
          filter: (s) =>
            s.hits < s.hitsMax / 2 && s.structureType !== STRUCTURE_WALL,
        })
        .sort((a, b) => a.hits - b.hits)[0] ??
      worker.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);

    if (!target) {
      if (worker.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        worker.drop(RESOURCE_ENERGY);
      }
      continue;
    }

    worker.memory.target = target.id;

    if (
      (worker.store.getUsedCapacity(RESOURCE_ENERGY) > 0 &&
        worker.pos.inRangeTo(target, 3)) ||
      worker.store.getFreeCapacity(RESOURCE_ENERGY) === 0
    ) {
      worker.moveTo(target, {
        range: 3,
        visualizePathStyle: { lineStyle: 'dashed', opacity: 0.2 },
      });
      if (target instanceof ConstructionSite) {
        if (worker.build(target) === ERR_INVALID_TARGET) {
          // Move creeps that may be blocking the site
          for (const creep of target.pos.lookFor(LOOK_CREEPS)) {
            if (!creep.my) {
              continue;
            }
            for (const dir of DirectionConstants) {
              if (creep.move(dir) === OK) {
                break;
              }
            }
          }
        }
      } else {
        worker.repair(target);
      }
    } else {
      pickupEnergy(worker, worker.store.getFreeCapacity(RESOURCE_ENERGY));
    }
  }
}

function* runUpgrader(id: Id<Creep>) {
  for (;;) {
    yield sleep();
    const upgrader = Game.getObjectById(id);
    if (!upgrader) {
      return;
    }

    const controller = upgrader.room.controller;
    if (!controller) {
      upgrader.suicide();
      return;
    }

    if (
      (upgrader.store.getUsedCapacity() &&
        upgrader.pos.inRangeTo(controller, 3)) ||
      !upgrader.store.getFreeCapacity()
    ) {
      upgrader.moveTo(controller, {
        range: 3,
        visualizePathStyle: { lineStyle: 'dashed', opacity: 0.2 },
      });
      upgrader.upgradeController(controller);
      continue;
    }

    const links = upgrader.room
      .find(FIND_MY_STRUCTURES)
      .filter(isStructureType(STRUCTURE_LINK));
    const controllerLink = links.find(
      (link) =>
        (upgrader.room.controller?.pos.getRangeTo(link) ?? Infinity) <= 3
    );

    if (!controllerLink || links.length < 2) {
      pickupEnergy(upgrader, upgrader.store.getFreeCapacity());
      continue;
    }

    const res = upgrader.withdraw(controllerLink, RESOURCE_ENERGY);
    if (res === ERR_NOT_IN_RANGE) {
      upgrader.moveTo(controllerLink, {
        range: 1,
        visualizePathStyle: { lineStyle: 'dashed', opacity: 0.2 },
      });
    }
  }
}

function* runScout(id: Id<Creep>) {
  const intel = intelRef.get();

  for (;;) {
    yield sleep();
    const scout = Game.getObjectById(id);

    if (!scout) {
      return;
    }

    const home = scout.memory.home;

    if (!isDefined(home)) {
      scout.suicide();
      return;
    }

    const adjacentRooms = Object.values(Game.map.describeExits(home)).filter(
      (roomName) => Game.map.getRoomStatus(roomName).status === 'normal'
    );
    const [targetRoom] = adjacentRooms.filter(
      (roomName) => !(roomName in intel)
    );

    if (!isDefined(targetRoom)) {
      scout.suicide();
      return;
    }

    if (scout.room.name !== targetRoom) {
      scout.moveTo(new RoomPosition(25, 25, targetRoom), {
        visualizePathStyle: {
          stroke: 'purple',
          lineStyle: 'dashed',
          opacity: 0.2,
        },
      });
    }
  }
}

export function* creepManager(): Routine {
  const running = new Set<string>();
  for (;;) {
    yield sleep();
    const creeps = Object.values(Game.creeps).filter((c) => c.my);
    for (const creep of creeps) {
      if (isDefined(creep.id) || running.has(creep.id)) {
        continue;
      }
      if (creep.name.startsWith('hauler')) {
        go(runHauler, creep.id);
      } else if (creep.name.startsWith('upgrader')) {
        go(runUpgrader, creep.id);
      } else if (creep.name.startsWith('worker')) {
        go(runWorker, creep.id);
      } else if (creep.name.startsWith('miner')) {
        go(runMiner, creep.id);
      } else if (creep.name.startsWith('attacker')) {
        go(runAttacker, creep.id);
      } else if (creep.name.startsWith('scout')) {
        go(runScout, creep.id);
      } else {
        logger.info(`Unknown creep ${creep.name}`);
        continue;
      }
      running.add(creep.id);
    }
  }
}

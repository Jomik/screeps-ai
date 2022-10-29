import { Routine } from 'coroutines';
import { createLogger } from '../library';
import { sleep } from '../library/sleep';
import { isDefined, isStructureType, max, restartOnTickChange } from '../utils';

const logger = createLogger('creep-manager');

const pickupEnergy = (worker: Creep, need: number, includeContainer = true) => {
  const containers = includeContainer
    ? worker.room
        .find(FIND_STRUCTURES)
        .filter(isStructureType(STRUCTURE_CONTAINER, STRUCTURE_STORAGE))
    : worker.room
        .find(FIND_STRUCTURES)
        .filter(isStructureType(STRUCTURE_CONTAINER, STRUCTURE_STORAGE))
        .filter((s) => s.pos.findInRange(FIND_SOURCES, 1).length > 0);
  const energyDrops = worker.room.find(FIND_DROPPED_RESOURCES, {
    filter: ({ resourceType }) => resourceType === RESOURCE_ENERGY,
  });

  const ruins = worker.room.find(FIND_RUINS);
  const tombstones = worker.room.find(FIND_TOMBSTONES);
  const targets = [...containers, ...energyDrops, ...ruins, ...tombstones];
  const targetsWithNeeded = targets.filter(
    (s) =>
      (s instanceof Resource
        ? s.amount
        : s.store.getUsedCapacity(RESOURCE_ENERGY)) >= need
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
    },
  });
};

const runMiners = () => {
  const miners = Object.values(Game.creeps).filter(
    (creep) => creep.my && creep.name.startsWith('miner')
  );

  for (const miner of miners) {
    if (!isDefined(miner.memory.slot)) {
      miner.suicide();
      continue;
    }
    const [x, y, roomName = miner.room.name] = miner.memory.slot;
    if (miner.pos.x !== x || miner.pos.y !== y) {
      miner.moveTo(new RoomPosition(x, y, roomName), {
        visualizePathStyle: { lineStyle: 'dashed' },
      });
    }
    const [source] = miner.pos.findInRange(FIND_SOURCES, 1);
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
};

const runAttackers = () => {
  const attackers = Object.values(Game.creeps).filter(
    (creep) => creep.my && creep.name.startsWith('attacker')
  );

  for (const attacker of attackers) {
    const enemy = attacker.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (enemy) {
      attacker.moveTo(enemy, {
        range: 1,
        visualizePathStyle: { lineStyle: 'dashed' },
      });
      attacker.attack(enemy);
    }
  }
};

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
    if (storedTarget.progress >= storedTarget.progressTotal) {
      worker.memory.target = undefined;
      return null;
    }
    return storedTarget;
  }

  if (storedTarget.hits >= storedTarget.hitsMax) {
    worker.memory.target = undefined;
    return null;
  }
  return storedTarget;
};

const runWorkers = () => {
  const workers = Object.values(Game.creeps).filter(
    (creep) => creep.my && creep.name.startsWith('worker')
  );

  for (const worker of workers) {
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
      (worker.store.getUsedCapacity(RESOURCE_ENERGY) &&
        worker.pos.inRangeTo(target, 3)) ||
      !worker.store.getFreeCapacity(RESOURCE_ENERGY)
    ) {
      worker.moveTo(target, {
        range: 3,
        visualizePathStyle: { lineStyle: 'dashed' },
      });
      if (target instanceof ConstructionSite) {
        worker.build(target);
      } else {
        worker.repair(target);
      }
    } else {
      pickupEnergy(worker, worker.store.getFreeCapacity(RESOURCE_ENERGY));
    }
  }
};

const runUpgraders = () => {
  const upgraders = Object.values(Game.creeps).filter(
    (creep) => creep.my && creep.name.startsWith('upgrader')
  );

  for (const upgrader of upgraders) {
    const controller = upgrader.room.controller;
    if (!controller) {
      // TODO
      // this.logger.warn('upgrader in room with no controller', upgrader);
      upgrader.suicide();
      continue;
    }

    if (
      (upgrader.store.getUsedCapacity() &&
        upgrader.pos.inRangeTo(controller, 3)) ||
      !upgrader.store.getFreeCapacity()
    ) {
      upgrader.moveTo(controller, {
        range: 3,
        visualizePathStyle: { lineStyle: 'dashed' },
      });
      upgrader.upgradeController(controller);
    } else {
      pickupEnergy(upgrader, upgrader.store.getFreeCapacity());
    }
  }
};

const runHaulers = () => {
  const haulers = Object.values(Game.creeps).filter(
    (creep) => creep.my && creep.name.startsWith('hauler')
  );

  for (const hauler of haulers) {
    const target =
      hauler.pos.findClosestByRange(FIND_MY_STRUCTURES, {
        filter: (
          structure
        ): structure is StructureSpawn | StructureExtension | StructureTower =>
          isStructureType(
            STRUCTURE_SPAWN,
            STRUCTURE_EXTENSION,
            STRUCTURE_TOWER
          )(structure) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
      }) ??
      hauler.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (structure): structure is StructureContainer =>
          isStructureType(STRUCTURE_CONTAINER)(structure) &&
          structure.pos.findInRange(FIND_SOURCES, 1).length === 0 &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
      }) ??
      hauler.room.storage ??
      hauler.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: (c) =>
          c.name.startsWith('worker') &&
          c.memory.target &&
          c.store.getFreeCapacity(RESOURCE_ENERGY) >= CARRY_CAPACITY,
      });

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
        visualizePathStyle: { lineStyle: 'dashed', stroke: 'green' },
      });
    }
  }
};

export const creepManager = restartOnTickChange(
  function* creepManager(): Routine {
    for (;;) {
      runAttackers();
      yield;
      runMiners();
      yield;
      runHaulers();
      yield;
      runUpgraders();
      yield;
      runWorkers();
      yield sleep();
    }
  }
);

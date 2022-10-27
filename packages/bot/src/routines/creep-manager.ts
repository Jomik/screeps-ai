import { Routine } from 'coroutines';
import { createLogger } from '../library';
import { sleep } from '../library/sleep';
import { isDefined, isStructureType, restartOnTickChange } from '../utils';

const logger = createLogger('creep-manager');

const pickupEnergy = (worker: Creep, need: number, includeContainer = true) => {
  const containers = includeContainer
    ? worker.room
        .find(FIND_STRUCTURES)
        .filter(isStructureType(STRUCTURE_CONTAINER, STRUCTURE_STORAGE))
        .filter((s) => s.store.getUsedCapacity(RESOURCE_ENERGY) >= need)
    : [];
  const energyDrops = worker.room
    .find(FIND_DROPPED_RESOURCES, {
      filter: ({ resourceType }) => resourceType === RESOURCE_ENERGY,
    })
    .filter((s) => s.amount >= need);

  const ruins = worker.room
    .find(FIND_RUINS)
    .filter((s) => s.store.getUsedCapacity(RESOURCE_ENERGY) >= need);
  const tombstones = worker.room
    .find(FIND_TOMBSTONES)
    .filter((s) => s.store.getUsedCapacity(RESOURCE_ENERGY) >= need);
  const targets = [...containers, ...energyDrops, ...ruins, ...tombstones];
  const target = worker.pos.findClosestByRange(targets);

  if (!target) {
    return;
  }
  worker.moveTo(target);
  if ('resourceType' in target) {
    worker.pickup(target);
  } else {
    worker.withdraw(target, RESOURCE_ENERGY);
  }
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

    const site = miner.pos.findInRange(FIND_CONSTRUCTION_SITES, 1)[0];
    if (site) {
      miner.build(site);
      continue;
    }

    const container = miner.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: (structure): structure is StructureContainer =>
        structure.structureType === STRUCTURE_CONTAINER,
    });
    if (container && miner.pos.isNearTo(container)) {
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
      attacker.moveTo(enemy, { range: 1 });
      attacker.attack(enemy);
    }
  }
};

const runWorkers = () => {
  const workers = Object.values(Game.creeps).filter(
    (creep) => creep.my && creep.name.startsWith('worker')
  );

  for (const worker of workers) {
    const room = worker.room;
    const buildings = room
      .find(FIND_STRUCTURES, {
        filter: (s) =>
          s.hits < s.hitsMax / 2 && s.structureType !== STRUCTURE_WALL,
      })
      .sort((a, b) => a.hits - b.hits);
    const target =
      buildings.length > 0
        ? buildings[0]
        : worker.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);

    if (!target) {
      if (worker.store.getFreeCapacity()) {
        pickupEnergy(worker, worker.store.getFreeCapacity());
      }
      continue;
    }

    if (
      (worker.store.getUsedCapacity() && worker.pos.inRangeTo(target, 3)) ||
      !worker.store.getFreeCapacity()
    ) {
      worker.moveTo(target, { range: 3 });
      if (target instanceof ConstructionSite) {
        worker.build(target);
      } else {
        worker.repair(target);
      }
    } else {
      pickupEnergy(worker, worker.store.getFreeCapacity());
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
      upgrader.moveTo(controller, { range: 3 });
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
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
      }) ??
      hauler.room.storage;
    if (!target) {
      continue;
    }
    const need = Math.min(
      hauler.store.getCapacity(RESOURCE_ENERGY),
      target.store.getFreeCapacity(RESOURCE_ENERGY)
    );
    if (hauler.store.getUsedCapacity(RESOURCE_ENERGY) >= need) {
      hauler.moveTo(target);
      hauler.transfer(target, RESOURCE_ENERGY);
    } else {
      pickupEnergy(
        hauler,
        need - hauler.store.getUsedCapacity(RESOURCE_ENERGY),
        !(
          [
            STRUCTURE_CONTAINER,
            STRUCTURE_STORAGE,
          ] as BuildableStructureConstant[]
        ).includes(target.structureType)
      );
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

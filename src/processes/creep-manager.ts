import { sleep, createProcess } from 'system';
import { restartOnTickChange } from './utils';

const runMiners = () => {
  const miners = Object.values(Game.creeps).filter(
    (creep) => creep.my && creep.name.startsWith('miner')
  );

  for (const miner of miners) {
    const [x, y] = miner.memory.slot;
    if (miner.pos.x !== x || miner.pos.y !== y) {
      miner.moveTo(x, y, { visualizePathStyle: { lineStyle: 'dashed' } });
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

    const pickupEnergy = () => {
      const energyDrops = worker.room.find(FIND_DROPPED_RESOURCES, {
        filter: ({ resourceType }) => resourceType === RESOURCE_ENERGY,
      });
      const resource = _.max(energyDrops, 'amount');
      if (!resource) {
        return;
      }
      worker.moveTo(resource);
      worker.pickup(resource);
    };

    if (!target) {
      if (worker.store.getFreeCapacity()) {
        pickupEnergy();
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
      pickupEnergy();
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
      const energyDrops = upgrader.room.find(FIND_DROPPED_RESOURCES, {
        filter: ({ resourceType }) => resourceType === RESOURCE_ENERGY,
      });
      const resource = _.max(energyDrops, 'amount');
      if (!resource) {
        continue;
      }
      upgrader.moveTo(resource);
      upgrader.pickup(resource);
    }
  }
};

const runHaulers = () => {
  const haulers = Object.values(Game.creeps).filter(
    (creep) => creep.my && creep.name.startsWith('hauler')
  );

  for (const hauler of haulers) {
    if (hauler.store.getFreeCapacity() < 75) {
      const target = hauler.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (structure): structure is StructureSpawn | StructureContainer =>
          (structure.structureType === STRUCTURE_CONTAINER ||
            structure.structureType === STRUCTURE_SPAWN) &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
      });
      if (!target) {
        continue;
      }
      hauler.moveTo(target);
      hauler.transfer(target, RESOURCE_ENERGY);
    } else {
      const energyDrops = hauler.room.find(FIND_DROPPED_RESOURCES, {
        filter: ({ resourceType }) => resourceType === RESOURCE_ENERGY,
      });
      const resource = _.max(energyDrops, 'amount');
      if (!resource) {
        continue;
      }
      hauler.moveTo(resource);
      hauler.pickup(resource);
    }
  }
};

export const creepManager = createProcess(
  restartOnTickChange(function* () {
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
      yield* sleep();
    }
  })
);

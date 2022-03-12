import { Process, Thread } from 'kernel/Process';
import { sleep } from 'kernel/sys-calls';

const runMiners = () => {
  const miners = Object.values(Game.creeps).filter(
    (creep) => creep.my && creep.name.startsWith('miner')
  );

  for (const miner of miners) {
    const [x, y] = miner.memory.slot;
    if (miner.pos.x !== x || miner.pos.y !== y) {
      miner.moveTo(x, y, { visualizePathStyle: { lineStyle: 'dashed' } });
    }
    const source = miner.pos.findInRange(FIND_SOURCES, 1);
    if (source.length === 0) {
      break;
    }
    miner.harvest(source[0]);
  }
};

const runHaulers = () => {
  const haulers = Object.values(Game.creeps).filter(
    (creep) => creep.my && creep.name.startsWith('hauler')
  );

  for (const hauler of haulers) {
    const spawn = Game.spawns['Spawn1'];
    if (hauler.store.getFreeCapacity() < 75) {
      hauler.moveTo(spawn);
      hauler.transfer(spawn, RESOURCE_ENERGY);
    } else {
      const energyDrops = hauler.room.find(FIND_DROPPED_RESOURCES, {
        filter: ({ resourceType }) => resourceType === RESOURCE_ENERGY,
      });
      const resource = _.max(energyDrops, 'amount');
      if (!resource) {
        break;
      }
      hauler.moveTo(resource);
      hauler.pickup(resource);
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
      upgrader.suicide();
      return;
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
        break;
      }
      upgrader.moveTo(resource);
      upgrader.pickup(resource);
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
      .find(FIND_MY_STRUCTURES, {
        filter: (s) => s.hits < s.hitsMax / 2,
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
      break;
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

export class CreepManager extends Process<undefined> {
  *run(): Thread {
    while (true) {
      runAttackers();
      runMiners();
      runHaulers();
      runUpgraders();
      runWorkers();
      yield* sleep();
    }
  }
}

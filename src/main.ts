import { ErrorMapper } from 'utils/ErrorMapper';

const spawnHauler = () => {
  const result = Game.spawns['Spawn1'].spawnCreep(
    [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
    `hauler-${Game.time}`
  );
  if (result === OK) {
    console.log('spawn hauler');
  }
};

const spawnMiner = (slot: [number, number]) => {
  const result = Game.spawns['Spawn1'].spawnCreep(
    [WORK, WORK, CARRY, MOVE],
    `miner-${Game.time}`,
    { memory: { slot } }
  );
  if (result === OK) {
    console.log('spawn miner', slot);
  }
};

const spawnUpgrader = () => {
  const result = Game.spawns['Spawn1'].spawnCreep(
    [WORK, CARRY, CARRY, MOVE, MOVE],
    `upgrader-${Game.time}`
  );
  if (result === OK) {
    console.log('spawn upgrader');
  }
};

// prettier-ignore
const box = [
  [1,1], [0,1], [-1,1],
  [1,0], [0,0], [-1,0],
  [1,-1], [0,-1], [-1,-1],
];

const doSpawns = () => {
  const spawn = Game.spawns['Spawn1'];
  const sources = spawn.room.find(FIND_SOURCES);
  const terrain = spawn.room.getTerrain();

  const slots = _.flatten(
    sources.map((source) =>
      box
        .map<RoomPosition>(
          ([x, y]) =>
            new RoomPosition(
              x + source.pos.x,
              y + source.pos.y,
              source.pos.roomName
            )
        )
        .filter(({ x, y }) => !(terrain.get(x, y) & TERRAIN_MASK_WALL))
        .sort((a, b) => {
          const goal = spawn.pos;
          const adistx = Math.abs(goal.x - a.x);
          const bdistx = Math.abs(goal.x - b.x);
          const adisty = Math.abs(goal.y - a.y);
          const bdisty = Math.abs(goal.y - b.y);
          return adistx - bdistx + adisty - bdisty;
        })
        .slice(0, 3)
    )
  );

  const miners = Object.values(Game.creeps).filter(
    (creep) => creep.my && creep.name.startsWith('miner')
  );
  const haulers = Object.values(Game.creeps).filter(
    (creep) => creep.my && creep.name.startsWith('hauler')
  );
  const upgraders = Object.values(Game.creeps).filter(
    (creep) => creep.my && creep.name.startsWith('upgrader')
  );

  if (miners.length === 0) {
    const closestSlot = spawn.pos.findClosestByPath(slots);
    if (!closestSlot) {
      console.log('No source slot');
    } else {
      spawnMiner([closestSlot.x, closestSlot.y]);
    }
  } else if (haulers.length === 0) {
    spawnHauler();
  } else if (miners.length < slots.length) {
    const takenSlots = miners.map((creep) => creep.memory.slot);
    const freeSlots = slots.filter(
      (pos) => !takenSlots.some(([x, y]) => pos.x === x && pos.y === y)
    );
    const freeSlot = spawn.pos.findClosestByPath(freeSlots);
    if (freeSlot) {
      spawnMiner([freeSlot.x, freeSlot.y]);
    }
  } else if (haulers.length < 2) {
    spawnHauler();
  } else if (upgraders.length < 4) {
    spawnUpgrader();
  }
};

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
    const spawn = Game.spawns['Spawn1'];
    const controller = upgrader.room.controller;

    if (
      (upgrader.store.getUsedCapacity() &&
        controller &&
        upgrader.pos.inRangeTo(controller, 3)) ||
      !upgrader.store.getFreeCapacity()
    ) {
      upgrader.moveTo(controller ?? spawn, { range: 3 });
      if (controller) {
        upgrader.upgradeController(controller);
      }
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

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  doSpawns();

  runMiners();
  runHaulers();
  runUpgraders();

  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
});

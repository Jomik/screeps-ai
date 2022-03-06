import { Process } from 'kernel/Process';

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
    [WORK, WORK, MOVE],
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

const spawnWorker = () => {
  const result = Game.spawns['Spawn1'].spawnCreep(
    [WORK, CARRY, CARRY, MOVE, MOVE],
    `worker-${Game.time}`
  );
  if (result === OK) {
    console.log('spawn worker');
  }
};

const spawnAttacker = () => {
  const result = Game.spawns['Spawn1'].spawnCreep(
    [MOVE, ATTACK],
    `attacker-${Game.time}`
  );
  if (result === OK) {
    console.log('spawn attacker');
  }
};

// prettier-ignore
const box = [
  [1,1], [0,1], [-1,1],
  [1,0], [0,0], [-1,0],
  [1,-1], [0,-1], [-1,-1],
];

export class SpawnManager extends Process<undefined> {
  run() {
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
    const workers = Object.values(Game.creeps).filter(
      (creep) => creep.my && creep.name.startsWith('worker')
    );
    const attackers = Object.values(Game.creeps).filter(
      (creep) => creep.my && creep.name.startsWith('attacker')
    );
    const enemies = spawn.room.find(FIND_HOSTILE_CREEPS);

    if (attackers.length < enemies.length) {
      spawnAttacker();
    } else if (miners.length === 0) {
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
    } else if (upgraders.length < 4 && spawn.room.controller) {
      spawnUpgrader();
    } else if (workers.length < 2) {
      spawnWorker();
    }
  }
}

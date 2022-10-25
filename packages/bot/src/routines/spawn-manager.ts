import { Routine } from 'coroutines';
import { Coordinates, createLogger, expandPosition } from '../library';
import { sleep } from '../library/sleep';
import { isDefined } from '../utils';

const logger = createLogger('spawn-manager');

export function* spawnManager(): Routine {
  const getSpawn = (): StructureSpawn => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return Game.spawns['Spawn1']!;
  };

  const spawnHauler = () => {
    getSpawn().spawnCreep(
      [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
      `hauler-${Game.time}`
    );
  };

  const spawnMiner = (slot: [...Coordinates, string]) => {
    getSpawn().spawnCreep([WORK, WORK, CARRY, MOVE], `miner-${Game.time}`, {
      memory: { slot },
    });
  };

  const spawnUpgrader = () => {
    getSpawn().spawnCreep(
      [WORK, CARRY, CARRY, MOVE, MOVE],
      `upgrader-${Game.time}`
    );
  };

  const spawnWorker = () => {
    getSpawn().spawnCreep(
      [WORK, CARRY, CARRY, MOVE, MOVE],
      `worker-${Game.time}`
    );
  };

  const spawnAttacker = () => {
    getSpawn().spawnCreep([MOVE, ATTACK], `attacker-${Game.time}`);
  };

  for (;;) {
    while (getSpawn().spawning) {
      yield sleep();
    }
    const spawn = getSpawn();

    const sources = spawn.room.find(FIND_SOURCES);
    const terrain = spawn.room.getTerrain();
    const goal = spawn.pos;

    const slots = sources
      .map((source) =>
        expandPosition([source.pos.x, source.pos.y])
          .map(([x, y]) => new RoomPosition(x, y, spawn.room.name))
          .filter(({ x, y }) => !(terrain.get(x, y) & TERRAIN_MASK_WALL))
          .sort((a, b) => {
            const adistx = Math.abs(goal.x - a.x);
            const bdistx = Math.abs(goal.x - b.x);
            const adisty = Math.abs(goal.y - a.y);
            const bdisty = Math.abs(goal.y - b.y);
            return adistx - bdistx + adisty - bdisty;
          })
          .slice(0, 3)
      )
      .flat();

    const {
      miner: miners = [],
      hauler: haulers = [],
      upgrader: upgraders = [],
      worker: workers = [],
      attacker: attackers = [],
    } = _.groupBy(Object.values(Game.creeps), (c) => c.name.split('-')[0]);
    const enemies = spawn.room.find(FIND_HOSTILE_CREEPS);

    if (attackers.length < enemies.length) {
      spawnAttacker();
    } else if (miners.length === 0) {
      const closestSlot = spawn.pos.findClosestByPath(slots);
      if (!closestSlot) {
        // TODO
        // this.logger.error('No source slot', spawn.room);
      } else {
        spawnMiner([closestSlot.x, closestSlot.y, closestSlot.roomName]);
      }
    } else if (haulers.length === 0) {
      spawnHauler();
    } else if (miners.length < slots.length) {
      const takenSlots = miners
        .map((creep) => creep.memory.slot)
        .filter(isDefined);
      const freeSlots = slots.filter(
        (pos) => !takenSlots.some(([x, y]) => pos.x === x && pos.y === y)
      );
      const freeSlot = spawn.pos.findClosestByPath(freeSlots);
      if (freeSlot) {
        spawnMiner([freeSlot.x, freeSlot.y, freeSlot.roomName]);
      }
    } else if (haulers.length < 2) {
      spawnHauler();
    } else if (upgraders.length < 4 && spawn.room.controller) {
      spawnUpgrader();
    } else if (workers.length < 2) {
      spawnWorker();
    }
    yield sleep();
  }
}

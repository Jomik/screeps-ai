import { Process, Thread } from 'kernel/Process';
import { sleep } from 'kernel/sys-calls';
import { expandPosition } from 'utils/position';

export class SpawnManager extends Process<undefined> {
  private spawn = Game.spawns['Spawn1'];
  private spawnHauler() {
    const result = this.spawn.spawnCreep(
      [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
      `hauler-${Game.time}`
    );
    if (result === OK) {
      this.logger.info('spawn hauler', this.spawn);
    }
  }

  private spawnMiner(slot: [number, number]) {
    const result = this.spawn.spawnCreep(
      [WORK, WORK, CARRY, MOVE],
      `miner-${Game.time}`,
      { memory: { slot } }
    );
    if (result === OK) {
      this.logger.info('spawn miner', this.spawn);
    }
  }

  private spawnUpgrader() {
    const result = this.spawn.spawnCreep(
      [WORK, CARRY, CARRY, MOVE, MOVE],
      `upgrader-${Game.time}`
    );
    if (result === OK) {
      this.logger.info('spawn upgrader', this.spawn);
    }
  }

  private spawnWorker() {
    const result = this.spawn.spawnCreep(
      [WORK, CARRY, CARRY, MOVE, MOVE],
      `worker-${Game.time}`
    );
    if (result === OK) {
      this.logger.info('spawn worker', this.spawn);
    }
  }

  private spawnAttacker() {
    const result = this.spawn.spawnCreep(
      [MOVE, ATTACK],
      `attacker-${Game.time}`
    );
    if (result === OK) {
      this.logger.info('spawn attacker', this.spawn);
    }
  }

  *run(): Thread {
    do {
      const spawn = this.spawn;
      if (spawn.spawning) {
        yield* sleep(spawn.spawning.remainingTime);
      }

      const sources = spawn.room.find(FIND_SOURCES);
      const terrain = spawn.room.getTerrain();

      const slots = sources
        .map((source) =>
          expandPosition(source.pos)
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
        this.spawnAttacker();
      } else if (miners.length === 0) {
        const closestSlot = spawn.pos.findClosestByPath(slots);
        if (!closestSlot) {
          this.logger.error('No source slot', spawn.room);
        } else {
          this.spawnMiner([closestSlot.x, closestSlot.y]);
        }
      } else if (haulers.length === 0) {
        this.spawnHauler();
      } else if (miners.length < slots.length) {
        const takenSlots = miners.map((creep) => creep.memory.slot);
        const freeSlots = slots.filter(
          (pos) => !takenSlots.some(([x, y]) => pos.x === x && pos.y === y)
        );
        const freeSlot = spawn.pos.findClosestByPath(freeSlots);
        if (freeSlot) {
          this.spawnMiner([freeSlot.x, freeSlot.y]);
        }
      } else if (haulers.length < 2) {
        this.spawnHauler();
      } else if (upgraders.length < 4 && spawn.room.controller) {
        this.spawnUpgrader();
      } else if (workers.length < 2) {
        this.spawnWorker();
      }
      yield* sleep(10);
    } while (true);
  }
}

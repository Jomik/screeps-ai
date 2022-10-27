import { Routine } from 'coroutines';
import { Coordinates, createLogger, expandPosition } from '../library';
import { sleep } from '../library/sleep';
import { isDefined, isStructureType, MaxControllerLevel } from '../utils';

const MaxWorkers = 5;
const MaxUpgraders = 5;

const logger = createLogger('spawn-manager');

const calculateBodyCost = (body: BodyPartConstant[]): number =>
  body.reduce((acc, cur) => acc + BODYPART_COST[cur], 0);

export function* spawnManager(): Routine {
  const getSpawn = (): StructureSpawn => {
    // TODO: This is slightly bad.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return Game.spawns['Spawn1']!;
  };

  const spawnHauler = () => {
    const spawn = getSpawn();
    const capacity = spawn.room.energyAvailable;
    const body = [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
    const extras = [CARRY, MOVE];
    while (calculateBodyCost(body.concat(extras)) < capacity) {
      body.push(...extras);
    }
    spawn.spawnCreep(body, `hauler-${Game.time}`);
  };

  const spawnMiner = (slot: [...Coordinates, string]) => {
    const spawn = getSpawn();
    const capacity = spawn.room.energyAvailable;
    const body = [WORK, WORK, CARRY, MOVE];
    const extras = [WORK];
    while (calculateBodyCost(body.concat(extras)) < capacity) {
      body.push(...extras);
    }
    spawn.spawnCreep(body, `miner-${Game.time}`, {
      memory: { slot },
    });
  };

  const spawnUpgrader = () => {
    const spawn = getSpawn();
    const capacity = spawn.room.energyAvailable;
    const body = [WORK, CARRY, CARRY, MOVE, MOVE];
    const extras = [WORK, CARRY];
    while (calculateBodyCost(body.concat(extras)) < capacity) {
      body.push(...extras);
    }
    spawn.spawnCreep(body, `upgrader-${Game.time}`);
  };

  const spawnWorker = () => {
    const spawn = getSpawn();
    const capacity = spawn.room.energyAvailable;
    const body = [WORK, CARRY, CARRY, MOVE, MOVE];
    const extras = [WORK, CARRY];
    while (calculateBodyCost(body.concat(extras)) < capacity) {
      body.push(...extras);
    }
    spawn.spawnCreep(body, `worker-${Game.time}`);
  };

  for (;;) {
    while (!getSpawn() || getSpawn().spawning) {
      yield sleep();
    }
    const spawn = getSpawn();
    const { room } = spawn;

    const sources = room.find(FIND_SOURCES);
    const terrain = room.getTerrain();
    const goal = spawn.pos;

    const slots = sources
      .map((source) =>
        expandPosition([source.pos.x, source.pos.y])
          .map(([x, y]) => new RoomPosition(x, y, room.name))
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
    } = _.groupBy(Object.values(Game.creeps), (c) => c.name.split('-')[0]);

    const hasConstructionSite =
      room.find(FIND_MY_CONSTRUCTION_SITES).length > 0;

    const energyInRoom = [
      ...room.find(FIND_DROPPED_RESOURCES, {
        filter: (resource): resource is Resource<RESOURCE_ENERGY> =>
          resource.resourceType === RESOURCE_ENERGY,
      }),
      ...room
        .find(FIND_STRUCTURES)
        .filter(isStructureType(STRUCTURE_CONTAINER, STRUCTURE_STORAGE)),
    ].reduce(
      (acc, cur) =>
        acc +
        ('resourceType' in cur
          ? cur.amount
          : cur.store.getUsedCapacity(RESOURCE_ENERGY)),
      0
    );
    const takenSlots = miners
      .filter((creep) => (creep.ticksToLive ?? 0) > 100)
      .map((creep) => creep.memory.slot)
      .filter(isDefined);
    const freeSlots = slots.filter(
      (pos) => !takenSlots.some(([x, y]) => pos.x === x && pos.y === y)
    );

    if (haulers.length === 0 && energyInRoom >= 300) {
      spawnHauler();
    } else if (miners.length === 0) {
      const closestSlot = spawn.pos.findClosestByPath(slots);
      if (!closestSlot) {
        // TODO
        // this.logger.error('No source slot', room);
      } else {
        spawnMiner([closestSlot.x, closestSlot.y, closestSlot.roomName]);
      }
    } else if (haulers.length === 0) {
      spawnHauler();
    } else if (freeSlots.length > 0) {
      const freeSlot = spawn.pos.findClosestByPath(freeSlots);
      if (freeSlot) {
        spawnMiner([freeSlot.x, freeSlot.y, freeSlot.roomName]);
      }
    } else if (haulers.length < 2) {
      spawnHauler();
    } else {
      const controller = room.controller;
      if (
        controller &&
        (controller.level < MaxControllerLevel ||
          controller.ticksToDowngrade < 500) &&
        upgraders.length < workers.length &&
        upgraders.length < MaxUpgraders * Math.min(controller.level / 4, 1)
      ) {
        spawnUpgrader();
      } else if (
        (hasConstructionSite ||
          workers.length < 1 ||
          (controller &&
            controller.progressTotal - controller.progress < 100)) &&
        workers.length <
          MaxWorkers * Math.min((room.controller?.level ?? 4) / 4, 1)
      ) {
        spawnWorker();
      } else if (
        controller &&
        upgraders.length < MaxUpgraders - workers.length + 1
      ) {
        spawnUpgrader();
      }
    }
    yield sleep();
  }
}

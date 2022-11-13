import { Routine } from 'coroutines';
import { Coordinates, createLogger, dist, expandPosition } from '../library';
import { sleep } from '../library/sleep';
import { isDefined, isStructureType, MaxControllerLevel } from '../utils';
import { CreepTypes } from './creep-manager';
import { intelRef } from './intel-manager';

const MaxWorkers = 5;
const MaxUpgraders = 5;

const logger = createLogger('spawn-manager');

const calculateBodyCost = (body: BodyPartConstant[]): number =>
  body.reduce((acc, cur) => acc + BODYPART_COST[cur], 0);

const spawnCreep = (
  spawn: StructureSpawn,
  type: CreepTypes,
  memory: CreepMemory,
  bodyGenerator: IterableIterator<BodyPartConstant[]>
): ScreepsReturnCode => {
  const capacity = spawn.room.energyAvailable;
  const body: BodyPartConstant[] = [];
  for (const next of bodyGenerator) {
    const newBody = body.concat(next);
    if (
      newBody.length > MAX_CREEP_SIZE ||
      calculateBodyCost(newBody) > capacity
    ) {
      break;
    }
    body.push(...next);
  }

  return spawn.spawnCreep(body, `${type}-${Game.time}`, {
    memory,
  });
};

export function* spawnManager(): Routine {
  const getSpawn = (): StructureSpawn => {
    // TODO: This is slightly bad.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return Game.spawns['Spawn1']!;
  };

  const spawnHauler = () => {
    function* bodyGenerator() {
      for (;;) {
        yield [CARRY, MOVE];
      }
    }
    const spawn = getSpawn();
    return spawnCreep(
      spawn,
      'hauler',
      { home: spawn.room.name },
      bodyGenerator()
    );
  };

  const spawnMiner = (slot: [...Coordinates, string]) => {
    function* bodyGenerator() {
      yield [WORK, WORK, CARRY, MOVE];
      for (;;) {
        yield [WORK];
      }
    }
    return spawnCreep(getSpawn(), 'miner', { slot }, bodyGenerator());
  };

  const spawnRemoteMiner = (slot: [...Coordinates, string]) => {
    function* bodyGenerator() {
      yield [WORK, WORK, CARRY, MOVE];
      for (;;) {
        yield [WORK];
        yield [MOVE];
      }
    }
    return spawnCreep(getSpawn(), 'miner', { slot }, bodyGenerator());
  };

  const spawnUpgrader = () => {
    function* bodyGenerator() {
      yield [WORK, WORK, CARRY, MOVE];
      for (;;) {
        yield [WORK];
      }
    }
    return spawnCreep(getSpawn(), 'upgrader', {}, bodyGenerator());
  };

  const spawnWorker = () => {
    function* bodyGenerator() {
      yield [WORK, CARRY, MOVE, MOVE];
      for (;;) {
        yield [CARRY];
        yield [CARRY];
        yield [MOVE];

        yield [CARRY];
        yield [CARRY];
        yield [MOVE];

        yield [WORK];
        yield [MOVE];
      }
    }
    return spawnCreep(getSpawn(), 'worker', {}, bodyGenerator());
  };

  const intel = intelRef.get();

  for (;;) {
    yield sleep();
    while (!getSpawn() || getSpawn().spawning) {
      yield sleep();
    }
    const spawn = getSpawn();
    const { room } = spawn;

    const sources = room.find(FIND_SOURCES);
    const terrain = room.getTerrain();
    const goal = spawn.pos;

    const slots = sources.flatMap((source) =>
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
    );

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
      (pos) =>
        !takenSlots.some(
          ([x, y, roomName]) =>
            pos.x === x && pos.y === y && pos.roomName === roomName
        )
    );

    const adjacentRooms = Object.values(
      Game.map.describeExits(room.name)
    ).filter(
      (roomName) => Game.map.getRoomStatus(roomName).status === 'normal'
    );
    if (haulers.length === 0 && energyInRoom >= 300) {
      spawnHauler();
      continue;
    }

    if (miners.length === 0) {
      const closestSlot = spawn.pos.findClosestByPath(slots);
      if (closestSlot) {
        spawnMiner([closestSlot.x, closestSlot.y, closestSlot.roomName]);
        continue;
      }
    }

    if (haulers.length === 0) {
      spawnHauler();
      continue;
    }

    if (freeSlots.length > 0) {
      const path = PathFinder.search(spawn.pos, freeSlots);
      if (!path.incomplete) {
        const freeSlot = path.path[path.path.length - 1];
        if (freeSlot) {
          spawnMiner([freeSlot.x, freeSlot.y, freeSlot.roomName]);
          continue;
        }
      }
    }

    if (haulers.length < 2) {
      spawnHauler();
      continue;
    }

    const remoteSlots = adjacentRooms.flatMap((roomName) => {
      const roomIntel = intel[roomName];
      if (!roomIntel || roomIntel.hostile) {
        return [];
      }
      return roomIntel.remotes.map(
        ([x, y]) => new RoomPosition(x, y, roomName)
      );
    });
    const freeRemoteSlots = remoteSlots.filter(
      (pos) =>
        !takenSlots.some(
          ([x, y, roomName]) =>
            pos.roomName === roomName && dist([x, y], [pos.x, pos.y]) <= 1
        )
    );

    if (freeRemoteSlots.length > 0) {
      const path = PathFinder.search(
        spawn.pos,
        freeRemoteSlots.map((pos) => ({ pos, range: 1 }))
      );
      if (!path.incomplete) {
        const freeSlot = path.path[path.path.length - 1];
        if (freeSlot) {
          spawnRemoteMiner([freeSlot.x, freeSlot.y, freeSlot.roomName]);
          continue;
        }
      }
    }

    if (haulers.length < 2 + remoteSlots.length) {
      spawnHauler();
      continue;
    }

    const controller = room.controller;
    if (
      controller &&
      (controller.level < MaxControllerLevel ||
        controller.ticksToDowngrade < 500) &&
      upgraders.length < workers.length
    ) {
      spawnUpgrader();
      continue;
    }

    if (
      controller &&
      (hasConstructionSite ||
        workers.length < 1 ||
        controller.progressTotal - controller.progress < 100) &&
      workers.length < MaxWorkers * Math.min((controller.level ?? 4) / 4, 1)
    ) {
      spawnWorker();
      continue;
    }

    if (
      controller &&
      upgraders.length < MaxUpgraders &&
      (!room.storage ||
        room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000)
    ) {
      spawnUpgrader();
      continue;
    }
  }
}

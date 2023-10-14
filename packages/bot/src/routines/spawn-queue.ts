import { SubRoutine } from 'coroutines';
import { createLogger } from '../library';
import { safeGameObject, TickSafe } from '../library/safe';
import { sleep } from '../library/sleep';
import { waitForSpawnRequest } from '../library/spawn';
import { CreepTypes } from './creep-manager';

const logger = createLogger('spawn-queue');

function* waitForSpawn(room: TickSafe<Room>): SubRoutine<StructureSpawn> {
  const spawns = room.find(FIND_MY_SPAWNS).map(safeGameObject);

  for (;;) {
    const spawn = spawns.find((spawn) => !spawn.spawning);
    if (spawn) {
      return spawn;
    }

    yield sleep();
  }
}

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

export function* spawnQueue(room: TickSafe<Room>) {
  for (;;) {
    logger.info('Waiting for spawn');
    const spawn = yield* waitForSpawn(room);
    logger.info('Waiting for spawn request');
    const { request, resolve } = yield* waitForSpawnRequest(room.name);

    logger.info(`Trying to spawn ${request.type}`);
    while (
      spawnCreep(spawn, request.type, request.memory, request.bodyFactory()) !==
      OK
    ) {
      yield sleep();
    }
    yield sleep();
    if (!spawn.spawning) {
      logger.error('Creep not spawned?!');
      continue;
    }
    const creep = Game.creeps[spawn.spawning.name];
    if (!creep) {
      logger.error('No creep with spawned name?!!');
      continue;
    }

    resolve(creep.id);
  }
}

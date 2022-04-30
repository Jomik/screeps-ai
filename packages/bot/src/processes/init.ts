import { getChildren, createProcess, fork, sleep } from 'os';
import { createLogger } from '../library';
import { groupByKey } from '../utils';

const logger = createLogger('init');

export const init = createProcess(function* () {
  logger.info('Initializing');
  for (;;) {
    const childrenByPID = yield* getChildren();
    const childMap = groupByKey(Object.values(childrenByPID), 'type');

    if (
      childMap.creepManager === undefined ||
      childMap.creepManager.length === 0
    ) {
      yield* fork('creepManager');
    }

    if (
      childMap.spawnManager === undefined ||
      childMap.spawnManager.length === 0
    ) {
      yield* fork('spawnManager');
    }

    for (const room of Object.values(Game.rooms)) {
      if (
        !childMap.roomPlanner?.some(
          ({ args: [roomName] }) => roomName === room.name
        ) &&
        room.find(FIND_MY_SPAWNS).length > 0
      ) {
        yield* fork('roomPlanner', undefined, room.name);
      }
    }

    yield* sleep(10);
  }
});

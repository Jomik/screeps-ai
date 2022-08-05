import { createProcess, sleep } from 'os';
import { createLogger } from '../library';
import { ensureChild } from '../library';

const logger = createLogger('init');

export const init = createProcess(function* () {
  logger.info('Initializing');
  for (;;) {
    yield* ensureChild('creepManager');
    yield* ensureChild('spawnManager');
    for (const room of Object.values(Game.rooms)) {
      const spawns = room.find(FIND_MY_SPAWNS);

      if (spawns.length > 0) {
        yield* ensureChild('baseManager', undefined, room.name);
      }
    }

    yield* sleep(500);
  }
});

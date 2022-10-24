import './polyfills';

import { go, run } from 'runner';

import { ErrorMapper } from './utils/ErrorMapper';
import { createLogger, recordGlobals, resetStats } from './library';
import { wrapWithMemoryHack } from './utils/memory-hack';
import { resolveSleep } from './library/sleep';
import { main } from './routines/main';

const logger = createLogger('runner');
run.onError = (err) => {
  logger.error(err as Error);
};

go(main);

export const loop = ErrorMapper.wrapLoop(
  wrapWithMemoryHack(() => {
    resetStats();
    resolveSleep();

    while (Game.cpu.tickLimit * 0.8 > Game.cpu.getUsed()) {
      if (!run()) {
        break;
      }
    }

    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }

    recordGlobals();
  })
);

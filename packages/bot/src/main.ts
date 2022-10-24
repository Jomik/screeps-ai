import './polyfills';

import { ErrorMapper } from './utils/ErrorMapper';
import { recordGlobals, resetStats } from './library';
import { wrapWithMemoryHack } from './utils/memory-hack';
import { resolveSleep } from './library/sleep';
import { main } from './routines/main';
import { go, run } from './runner';

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

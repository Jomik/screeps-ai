import './polyfills';

import { ErrorMapper } from './utils/ErrorMapper';
import { recordGlobals, resetStats } from './library';
import { wrapWithMemoryHack } from './utils/memory-hack';
import { kernel } from './kernel';
import './cli';

export const loop = ErrorMapper.wrapLoop(
  wrapWithMemoryHack(() => {
    resetStats();

    kernel.run();

    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }

    recordGlobals();
  })
);

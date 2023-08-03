import './polyfills';

import { ErrorMapper } from './utils/ErrorMapper';
import { recordGlobals, resetStats } from './library';
import { wrapWithMemoryHack } from './utils/memory-hack';
import { resolveSleep } from './library/sleep';
import { main } from './routines/main';
import { scheduler, go, run } from './runner';

go(main);

declare const global: { go: typeof go };
global.go = go;

export const loop = ErrorMapper.wrapLoop(
  wrapWithMemoryHack(() => {
    resetStats();
    resolveSleep();

    const cpuUsage: Record<string, number> = {};
    while (
      Game.cpu.tickLimit * 0.8 > Game.cpu.getUsed() &&
      scheduler.canRun()
    ) {
      // TODO: Monitor CPU
      // const start = Game.cpu.getUsed();
      const task = run();
      // const end = Game.cpu.getUsed();
      // cpuUsage[task.name] = (cpuUsage[task.name] ?? 0) + end - start;
    }

    const visuals = new RoomVisual();
    Object.entries(cpuUsage).forEach(([name, usage], index) => {
      visuals.text(`${name}: ${usage.toFixed(2).toString()}`, 49, index + 0.2, {
        font: 0.7,
        align: 'right',
      });
    });
    visuals.text(
      `Heap usage: ${(
        ((Game.cpu.getHeapStatistics?.().used_heap_size ?? 0) /
          (Game.cpu.getHeapStatistics?.().heap_size_limit ?? 0)) *
        100
      ).toFixed(2)}%`,
      0,
      0.2,
      { font: 0.7, align: 'left' }
    );

    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }

    recordGlobals();
  })
);

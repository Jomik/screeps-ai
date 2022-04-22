import './polyfills';

import { Kernel, PID } from 'kernel';
import { ErrorMapper } from 'utils/ErrorMapper';
import { LogLevel, ScreepsLogger } from './Logger';
import { RoundRobinScheduler } from 'schedulers/RoundRobinScheduler';
import { recordGlobals, resetStats } from 'library';

const kernel = new Kernel({
  loggerFactory: (name) => new ScreepsLogger(name),
  scheduler: new RoundRobinScheduler(
    () => Game.cpu.tickLimit * 0.8 - Game.cpu.getUsed()
  ),
});

// @ts-ignore: to use ps in console
global.ps = (pid?: PID) => {
  if (pid !== undefined && !kernel.pids.includes(pid)) {
    return 'Invalid argument';
  }
  return kernel.ps(pid);
};
// @ts-ignore: to use ps in console
global.reboot = () => {
  return kernel.reboot();
};
// @ts-ignore: to use kill in console
global.kill = (pid: PID) => {
  if (!kernel.pids.includes(pid)) {
    return 'Invalid argument';
  }
  return kernel.kill(pid);
};

// @ts-ignore: to use setLogLevel in console
global.LogLevel = LogLevel;
// @ts-ignore: to use setLogLevel in console
global.setLogLevel = (level: LogLevel) => {
  return ScreepsLogger.setLogLevel(level);
};
// @ts-ignore: to use setLogFilter in console
global.setLogFilter = (filter: string | undefined) => {
  return ScreepsLogger.setLogFilter(filter);
};

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  resetStats();

  kernel.run();

  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }

  recordGlobals();
});

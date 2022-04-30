import './polyfills';

import { Kernel, MemoryValue, PID, PriorityScheduler } from 'os';
import { ErrorMapper } from './utils/ErrorMapper';
import {
  getMemoryRef,
  LogLevel,
  recordGlobals,
  resetStats,
  createLogger,
  setLogFilter,
  setLogLevel,
} from './library';
import { registry } from './registry';
import { wrapWithMemoryHack } from './utils/memory-hack';

declare const global: Record<string, any>;

const kernelLogger = createLogger('kernel');
const kernel = new Kernel(
  registry,
  new PriorityScheduler(0, {
    quota: () => Game.cpu.tickLimit * 1.8 - Game.cpu.getUsed(),
    clock: () => Game.time,
  }),
  (key, value) => getMemoryRef(`kernel:${key}`, value),
  {
    onKernelError(message) {
      kernelLogger.alert(message);
    },
    onThreadExit({ type, pid }, reason) {
      kernelLogger.info(`${type}:${pid} exited: ${reason}`);
    },
    onThreadError({ type, pid }, error: Error) {
      kernelLogger.error(`${type}:${pid} errored:`, error);
    },
  }
);

// @ts-ignore: to use ps in console
global.ps = (root: PID = 0) => {
  const processes = kernel.ps();
  const processMap = new Map(processes.map((info) => [info.pid, info]));

  const processesByParent = _.groupBy(
    processes.filter(({ pid }) => pid !== 0),
    'parent'
  );

  const getSubTree = (prefix: string, pid: PID, end: boolean): string => {
    const entry = processMap.get(pid);
    if (!entry) {
      return `${prefix}${end ? '`-- ' : '|-- '}MISSING:${pid}`;
    }

    const { type, args } = entry;

    const argSuffix = type === 'roomPlanner' ? `:${args[0]}` : '';

    const header = `${prefix}${
      end ? '`-- ' : '|-- '
    }${type}:${pid}${argSuffix}`;

    const children = processesByParent[pid] ?? [];
    children.sort((a, b) => a.pid - b.pid);
    const childTree = children.map(({ pid }, i) =>
      getSubTree(
        prefix + (end ? '    ' : '|    '),
        pid,
        i === children.length - 1
      )
    );

    return `${header}\n${childTree.join('')}`;
  };

  return getSubTree('', root, true);
};

// @ts-ignore: to use reboot in console
global.reboot = () => {
  return kernel.reboot();
};

// @ts-ignore: to use kill in console
global.kill = (pid: PID) => {
  return kernel.kill(pid);
};

// @ts-ignore: to use setLogLevel in console
global.LogLevel = LogLevel;
// @ts-ignore: to use setLogLevel in console
global.setLogLevel = setLogLevel;
// @ts-ignore: to use setLogFilter in console
global.setLogFilter = setLogFilter;

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

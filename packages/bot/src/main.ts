import './polyfills';

import { Kernel, MemoryValue, PID, PriorityScheduler } from 'os';
import { ErrorMapper } from './utils/ErrorMapper';
import { recordGlobals, resetStats } from './library';
import { registry } from './registry';

declare const global: Record<string, any>;
declare const console: { log(message: string): void };

declare global {
  interface Memory {
    kernel?: Record<string, MemoryValue>;
  }
}
const memoryPointer = !Memory['kernel']
  ? (Memory['kernel'] = {})
  : Memory['kernel'];
const kernel = new Kernel(
  registry,
  new PriorityScheduler(0, {
    quota: () => Game.cpu.tickLimit * 1.8 - Game.cpu.getUsed(),
    clock: () => Game.time,
  }),
  memoryPointer,
  {
    onKernelError(message) {
      console.log(message);
    },
    onThreadExit(info, reason) {
      console.log(`${info.type} exited: ${reason}`);
    },
    onThreadError(info, error: Error) {
      console.log(`${info.type} exited: ${error.message}`);
    },
  }
);

// loggerFactory: (name) => new ScreepsLogger(name),

// @ts-ignore: to use ps in console
global.ps = () => {
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

    const { type } = entry;

    const header = `${prefix}${end ? '`-- ' : '|-- '}${type}:${pid}`;

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

  return getSubTree('', 0 as PID, true);
};

// @ts-ignore: to use reboot in console
global.reboot = () => {
  return kernel.reboot();
};

// @ts-ignore: to use kill in console
global.kill = (pid: PID) => {
  return kernel.kill(pid);
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

import { Kernel, PID, Priority, PriorityScheduler } from 'kernel';
import {
  getMemoryRef,
  createLogger,
  InvalidArgumentsError,
  registerCommand,
} from './library';
import { registry } from './registry';

const kernelLogger = createLogger('kernel');
export const kernel = new Kernel({
  registry,
  scheduler: new PriorityScheduler(0 as Priority),
  getDataHandle: (key, value) => getMemoryRef(`kernel:${key}`, value),
  quota: () => Game.cpu.tickLimit * 1.8 - Game.cpu.getUsed(),
  clock: () => Game.time,
  logger: {
    onKernelError(message) {
      kernelLogger.alert(message);
    },
    onProcessExit({ type, pid }, reason) {
      kernelLogger.info(`${type}:${pid} exited: ${reason}`);
    },
    onProcessError({ type, pid }, error: Error) {
      kernelLogger.error(`${type}:${pid} errored:`, error);
    },
  },
});

registerCommand('ps', (root: unknown = 0) => {
  if (typeof root !== 'number') {
    throw new InvalidArgumentsError('number', root);
  }

  const processes = kernel.ps();
  const processMap = new Map(processes.map((info) => [info.pid, info]));

  const processesByParent = _.groupBy(
    processes.filter(({ pid }) => pid !== 0),
    'parent'
  );

  const getSubTree = (prefix: string, pid: PID, end: boolean): string => {
    const entry = processMap.get(pid);
    if (!entry) {
      return `${prefix}${pid}:${end ? '`-- ' : '|-- '}MISSING`;
    }

    const { type, args } = entry;

    const argSuffix =
      args.length > 0
        ? `:${args.map((arg) => JSON.stringify(arg)).join(',')}`
        : '';

    const header = `${prefix}${
      end ? '`-- ' : '|-- '
    }${pid}:${type}${argSuffix}`;

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

  return getSubTree('', root as PID, true);
});

registerCommand('reboot', () => {
  kernel.reboot();
  return undefined;
});

registerCommand('reset', () => {
  kernel.reset();
  return undefined;
});

registerCommand('kill', (pid) => {
  if (typeof pid !== 'number') {
    throw new InvalidArgumentsError('number', pid);
  }

  if (!kernel.kill(pid as PID)) {
    return `Could not kill ${pid}`;
  }

  return undefined;
});

registerCommand('inspect', (pid) => {
  if (typeof pid !== 'number') {
    throw new InvalidArgumentsError('number', pid);
  }

  const process = kernel.ps().find((p) => p.pid === pid);
  if (!process) {
    return `Process ${pid} not found`;
  }

  const memory = kernel.inspect(pid as PID);

  return JSON.stringify({ ...process, args: undefined, memory }, null, 2);
});

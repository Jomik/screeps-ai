import { PID } from 'kernel';
import { kernel } from '../kernel';
import { LogLevel, setLogLevel, setLogFilter } from './logger';

declare const global: Record<string, any>;

export class InvalidArgumentsError extends Error {
  constructor(
    public readonly expected: string,
    public readonly actual: unknown
  ) {
    super(`Expected ${expected} got ${typeof actual}`);
  }
}

export const registerCommand = (
  command: string,
  fn: (...args: unknown[]) => string
) => {
  if (command in global) {
    throw new Error(`Command ${command} has already been registered`);
  }

  global[command] = (...args: unknown[]) => {
    try {
      return fn(...args);
    } catch (err: unknown) {
      return err;
    }
  };
};

export const initConsole = () => {
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
    return 'Rebooting...';
  });

  registerCommand('reset', () => {
    kernel.reset();
    return 'Resetting...';
  });

  registerCommand('kill', (pid) => {
    if (typeof pid !== 'number') {
      throw new InvalidArgumentsError('number', pid);
    }

    if (kernel.kill(pid as PID)) {
      return `Killed ${pid}`;
    }
    return `Could not kill ${pid}`;
  });

  registerCommand('inspect', (pid) => {
    if (typeof pid !== 'number') {
      throw new InvalidArgumentsError('number', pid);
    }

    const process = kernel.ps().find((p) => p.pid === pid);
    if (!process) {
      return `Process ${pid} not found`;
    }

    return JSON.stringify(process);
  });

  global.LogLevel = LogLevel;
  global.setLogLevel = setLogLevel;
  global.setLogFilter = setLogFilter;
};

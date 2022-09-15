import { PID } from 'kernel';
import { kernel } from './kernel';
import { LogLevel, setLogFilter, setLogLevel } from './library';

declare const global: Record<string, any>;

global.ps = (root: PID = 0 as PID) => {
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

  return getSubTree('', root, true);
};

global.reboot = () => {
  return kernel.reboot();
};

global.reset = () => {
  return kernel.reset();
};

global.kill = (pid: PID) => {
  return kernel.kill(pid);
};

global.inspect = (pid: PID) => {
  const process = kernel.ps().find((p) => p.pid === pid);
  if (!process) {
    return `Process not found`;
  }

  return JSON.stringify(process);
};

global.LogLevel = LogLevel;
global.setLogLevel = setLogLevel;
global.setLogFilter = setLogFilter;

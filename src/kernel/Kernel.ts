import { Logger } from 'Logger';
import {
  ChildDescriptor,
  Process,
  ProcessConstructor,
  ProcessMemory,
  Thread,
} from './Process';
import { Scheduler, SchedulerThreadReturn } from '../schedulers/Scheduler';
import { hibernate, SysCall, SysCallResults } from './sys-calls';
import { getMemoryRef } from './memory';
import { recordStats } from 'library';
import { ErrorMapper } from 'utils/ErrorMapper';

export type PID = number;

declare const SocketInSymbol: unique symbol;
declare const SocketOutSymbol: unique symbol;

export type SocketIn<T = unknown> = string & {
  [SocketInSymbol]: T;
};
export type SocketOut<T = unknown> = string & {
  [SocketOutSymbol]: T;
};
export type Socket<T = unknown> = SocketIn<T> & SocketOut<T>;

type ProcessDescriptor<M extends ProcessMemory> = {
  type: string;
  pid: PID;
  parent: number;
  memory: M;
};

type PackedProcessDescriptor<M extends ProcessMemory> = [
  type: string,
  pid: PID,
  parent: number,
  memory: M
];

const packEntry = <M extends ProcessMemory>(
  entry: ProcessDescriptor<M>
): PackedProcessDescriptor<M> => [
  entry.type,
  entry.pid,
  entry.parent,
  entry.memory,
];

const unpackEntry = <M extends ProcessMemory>(
  entry: PackedProcessDescriptor<M>
): ProcessDescriptor<M> => ({
  type: entry[0],
  pid: entry[1],
  parent: entry[2],
  memory: entry[3],
});

type ProcessTable = Record<PID, PackedProcessDescriptor<any>>;

class Tron extends Process {
  *run(): Thread {
    this.logger.alert('Global reset');
    yield* hibernate();
  }
}

export class Kernel {
  private readonly tableRef = getMemoryRef<ProcessTable>('processTable', {});
  private get table(): ProcessTable {
    return this.tableRef.get();
  }
  get pids() {
    return Object.keys(this.table).map((k) => Number.parseInt(k));
  }

  private readonly logger: Logger;
  private readonly scheduler: Scheduler;

  private readonly loggerFactory: (name: string) => Logger;
  private readonly threads = new Map<PID, Thread>();
  private readonly registry = new Map<string, ProcessConstructor<any>>();
  private readonly sockets = new Map<Socket, unknown[]>();

  constructor(
    private readonly Init: ProcessConstructor,
    config: {
      processes: ProcessConstructor<any>[];
      loggerFactory: (name: string) => Logger;
      scheduler: Scheduler;
    }
  ) {
    const { processes, loggerFactory, scheduler } = config;
    this.scheduler = scheduler;
    this.loggerFactory = loggerFactory;
    this.logger = loggerFactory(this.constructor.name);
    for (const type of [Tron, this.Init, ...processes]) {
      this.registerProcess(type);
    }
    if (!this.table[0]) {
      this.logger.warn('Tron missing');
      this.reboot();
    } else {
      for (const pid of this.pids) {
        this.initThread(pid);
      }
    }
    this.PIDCount = Math.max(0, ...this.pids);
  }

  reboot() {
    this.logger.info('Rebooting...');

    for (const pid of this.pids) {
      this.scheduler.remove(pid);
    }

    this.tableRef.set({});
    this.createProcess(Tron, {}, 0, 0);
    this.createProcess(this.Init, {}, 1, 0);
  }

  private PIDCount: number;
  private acquirePID(): number {
    if (this.PIDCount >= 50000) {
      this.PIDCount = 0;
    }
    ++this.PIDCount;
    if (this.table[this.PIDCount]) {
      return this.acquirePID();
    }
    return this.PIDCount;
  }

  private registerProcess<Type extends ProcessConstructor<any>>(type: Type) {
    // istanbul ignore next
    if (this.registry.has(type.name) && this.registry.get(type.name) !== type) {
      throw new Error(
        `A different version already exists in registry: ${type.name}`
      );
    }
    this.registry.set(type.name, type);
  }

  private createProcess<
    M extends ProcessMemory,
    Type extends ProcessConstructor<M>
  >(type: Type, memory: M, pid: number, parent: number) {
    // istanbul ignore next
    if (this.table[pid]) {
      throw new Error(`PID already occupied: ${pid}`);
    }

    // istanbul ignore next
    if (!this.registry.has(type.name)) {
      throw new Error(`No process of type, ${type.name}, has been registered`);
    }

    this.table[pid] = packEntry({
      type: type.name,
      pid,
      parent,
      memory,
    });

    this.initThread(pid);
  }

  private initThread(pid: PID) {
    const descriptor = unpackEntry(this.table[pid]);
    const Type = this.registry.get(descriptor.type);
    if (!Type) {
      this.kill(pid);
      this.logger.error(
        `Error trying to initialise pid ${pid} with unknown type ${descriptor.type}`
      );
      return;
    }
    const process = new Type({
      memory: () => unpackEntry(this.table[pid]).memory as never,
      children: () => this.findChildren(pid),
      logger: this.loggerFactory(`${descriptor.type}:${pid}`),
    });

    this.threads.set(pid, process.run.bind(process)());
    this.scheduler.add(pid);
  }

  private findChildren(pid: PID): ChildDescriptor[] {
    return (
      Object.values(this.table)
        .map((v) => unpackEntry(v))
        .filter(({ parent }) => parent === pid)
        // The type has to be in the registry, or it will not be part of the process table.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        .map((v) => ({ type: this.registry.get(v.type)!, pid: v.pid }))
    );
  }

  public kill(pid: PID) {
    if (pid === 0) {
      this.logger.alert('Trying to kill Tron, rebooting...');
      this.reboot();
      return;
    }

    this.threads.delete(pid);
    delete this.table[pid];
    this.scheduler.remove(pid);

    // Children are adopted by Tron
    this.findChildren(pid).forEach((child) => {
      const entry = unpackEntry(this.table[child.pid]);
      this.table[child.pid] = packEntry({
        ...entry,
        parent: 0,
      });
    });
  }

  private getSocket(path: SocketIn | SocketOut) {
    let socket = this.sockets.get(path as Socket);
    if (socket === undefined) {
      socket = [];
      this.sockets.set(path as Socket, socket);
    }
    return socket;
  }

  private runThread(pid: PID): SchedulerThreadReturn {
    const thread = this.threads.get(pid);
    if (!thread) {
      this.logger.error(`Attempting to run ${pid} with missing thread.`);
      this.kill(pid);
      return undefined;
    }

    let nextArg: SysCallResults = undefined;
    for (;;) {
      let sysCall: IteratorResult<SysCall | void>;
      try {
        sysCall = thread.next(nextArg);
      } catch (err) {
        this.logger.error(
          `Error while running ${
            unpackEntry(this.table[pid]).type
          }:${pid}\n${ErrorMapper.sourceMappedStackTrace(err as Error)}`
        );
        this.kill(pid);
        return;
      }
      nextArg = undefined;

      if (sysCall.done) {
        this.kill(pid);
        return undefined;
      }

      if (!sysCall.value) {
        return undefined;
      }

      switch (sysCall.value.type) {
        case 'sleep': {
          return sysCall.value;
        }
        case 'fork': {
          const { memory, processType } = sysCall.value;
          const childPID = this.acquirePID();
          this.createProcess(processType, memory, childPID, pid);
          nextArg = { type: 'fork', pid: childPID };
          this.logger.info(`PID ${pid} forked ${processType.name}:${childPID}`);
          break;
        }
        case 'kill': {
          const { pid: childPID } = sysCall.value;
          if (!this.findChildren(pid).some((child) => child.pid === childPID)) {
            break;
          }
          this.kill(childPID);
          break;
        }
        case 'open_socket': {
          const { path } = sysCall.value;
          const entry = unpackEntry(this.table[pid]);
          nextArg = {
            type: 'open_socket',
            path: `/${entry.type}/${pid}/${path}` as Socket,
          };
          break;
        }
        case 'read': {
          const { path } = sysCall.value;
          const socket = this.getSocket(path);
          nextArg = { type: 'read', message: socket.shift() ?? null };
          break;
        }
        case 'write': {
          const { path, message } = sysCall.value;
          const socket = this.getSocket(path);
          socket.push(message);
          break;
        }
      }
    }
  }

  public run(): void {
    const schedule = this.scheduler.run();
    let nextArg: SchedulerThreadReturn = undefined;
    for (;;) {
      const next = schedule.next(nextArg);
      if (next.done) {
        break;
      }

      const pid = next.value;
      const entry = unpackEntry(this.table[pid]);
      this.logger.verbose(`Running thread ${entry.type}:${pid}`);
      const startCPU = Game.cpu.getUsed();
      nextArg = this.runThread(pid);
      const endCpu = Game.cpu.getUsed();
      this.logger.verbose(`${entry.type}:${pid} ${nextArg?.type ?? 'yield'}`);
      recordStats({
        threads: {
          [entry.type]: {
            [pid]: endCpu - startCPU,
          },
        },
      });
    }
    recordStats({
      sockets: [...this.sockets.entries()].reduce(
        (acc, [path, messages]) => ({ ...acc, [path]: messages.length }),
        {}
      ),
    });
  }

  /* istanbul ignore next */
  public ps(pid: PID = 0) {
    const tableByParent = _.groupBy(
      Object.values(this.table)
        .map(unpackEntry)
        .filter(({ pid }) => pid !== 0),
      'parent'
    );

    const getSubTree = (prefix: string, pid: PID, end: boolean): string => {
      const entry = unpackEntry(this.table[pid]);
      const { type } = entry;

      const header = `${prefix}${end ? '`-- ' : '|-- '}${type}:${pid}`;

      const children = tableByParent[pid] ?? [];
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

    return getSubTree('', pid, true);
  }
}

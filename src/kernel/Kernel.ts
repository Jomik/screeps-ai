import { Logger } from 'Logger';
import { Process, ProcessConstructor, ProcessMemory, Thread } from './Process';
import { Scheduler, SchedulerThreadReturn } from '../schedulers/Scheduler';
import { hibernate, SysCallResults } from './sys-calls';
import { getMemoryRef } from './memory';
import { recordStats } from 'library';

type Memory = Record<string, unknown>;

export type PID = number;

type ProcessDescriptor<M extends Memory | undefined> = {
  type: string;
  pid: PID;
  parent: number;
  memory: M;
};

type PackedProcessDescriptor<M extends Memory | undefined> = [
  type: string,
  pid: PID,
  parent: number,
  memory: M
];

const packEntry = <M extends Memory | undefined>(
  entry: ProcessDescriptor<M>
): PackedProcessDescriptor<M> => [
  entry.type,
  entry.pid,
  entry.parent,
  entry.memory,
];

const unpackEntry = <M extends Memory | undefined>(
  entry: PackedProcessDescriptor<M>
): ProcessDescriptor<M> => ({
  type: entry[0],
  pid: entry[1],
  parent: entry[2],
  memory: entry[3],
});

type ProcessTable = Record<PID, PackedProcessDescriptor<never>>;

class Tron extends Process<undefined> {
  *run(): Thread {
    this.logger.alert('Global reset');
    yield* hibernate();
  }
}

export interface ROMHandle<T> {
  get(): T;
  set(value: T): void;
}

export class Kernel {
  private readonly tableRef = getMemoryRef<ProcessTable>('processTable', {});
  private get table(): ProcessTable {
    return this.tableRef.get();
  }
  private readonly logger: Logger;
  private readonly scheduler: Scheduler;
  private readonly Init: ProcessConstructor<undefined>;

  private readonly loggerFactory: (name: string) => Logger;
  private readonly threads: Record<PID, Thread> = {};
  private readonly registry: Record<string, ProcessConstructor<never>> = {};

  constructor(config: {
    Init: ProcessConstructor<undefined>;
    processes: ProcessConstructor<any>[];
    loggerFactory: (name: string) => Logger;
    scheduler: Scheduler;
  }) {
    const { Init, processes, loggerFactory, scheduler } = config;
    this.scheduler = scheduler;
    this.Init = Init;
    this.loggerFactory = loggerFactory;
    this.logger = loggerFactory(this.constructor.name);
    for (const type of [Tron, Init, ...processes]) {
      this.registerProcess(type as never);
    }
    if (!this.table[0]) {
      this.logger.warn('Tron missing');
      this.reboot();
    } else {
      for (const key of Object.keys(this.table)) {
        const pid = Number.parseInt(key);
        this.initThread(pid);
      }
    }
    this.PIDCount = Math.max(
      0,
      ...Object.keys(this.table).map((k) => Number.parseInt(k))
    );
  }

  reboot() {
    this.logger.info('Rebooting...');

    for (const key of Object.keys(this.table)) {
      const pid = Number.parseInt(key);
      this.scheduler.remove(pid);
    }

    this.tableRef.set({});
    this.createProcess(Tron, undefined, 0, 0);
    this.createProcess(this.Init, undefined, 1, 0);
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

  private registerProcess<Type extends ProcessConstructor<never>>(type: Type) {
    // istanbul ignore next
    if (this.registry[type.name] && this.registry[type.name] !== type) {
      throw new Error(
        `A different version already exists in registry: ${type.name}`
      );
    }
    this.registry[type.name] = type;
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
    if (!this.registry[type.name]) {
      throw new Error(`No process of type, ${type.name}, has been registered`);
    }

    this.table[pid] = packEntry<never>({
      type: type.name,
      pid,
      parent,
      memory: memory as never,
    });

    this.initThread(pid);
  }

  private initThread(pid: PID) {
    const descriptor = unpackEntry(this.table[pid]);
    const process = new this.registry[descriptor.type]({
      memory: () => unpackEntry(this.table[pid]).memory,
      children: () => this.findChildren(pid),
      logger: this.loggerFactory(`${descriptor.type}:${pid}`),
    });

    this.threads[pid] = process.run.bind(process)();
    this.scheduler.add(pid);
  }

  private findChildren(
    pid: PID
  ): Array<{ type: ProcessConstructor<never>; pid: PID }> {
    return Object.values(this.table)
      .map((v) => unpackEntry(v))
      .filter(({ parent }) => parent === pid)
      .map((v) => ({ type: this.registry[v.type], pid: v.pid }));
  }

  private killProcess(pid: PID) {
    delete this.threads[pid];
    delete this.table[pid];
    this.scheduler.remove(pid);
    this.findChildren(pid).forEach((child) => this.killProcess(child.pid));
  }

  private runThread(pid: PID): SchedulerThreadReturn {
    const thread = this.threads[pid];

    let nextArg: SysCallResults = undefined;
    do {
      let sysCall;
      try {
        sysCall = thread.next(nextArg);
      } catch (err) {
        this.logger.error(
          `Error while running ${unpackEntry(this.table[pid]).type}:${pid}\n${
            err instanceof Error ? err.message : err
          }`
        );
        this.killProcess(pid);
        return;
      }
      nextArg = undefined;

      if (sysCall.done) {
        this.killProcess(pid);
        return undefined;
      }

      if (!sysCall.value) {
        return undefined;
      }

      if (sysCall.value.type === 'sleep') {
        return sysCall.value;
      }

      if (sysCall.value.type === 'fork') {
        const { memory, processType } = sysCall.value;
        const childPID = this.acquirePID();
        this.createProcess(processType, memory, childPID, pid);
        nextArg = { type: 'fork', pid: childPID };
        this.logger.info(`${pid} forked ${processType.name}:${childPID}`);
      }
    } while (true);
  }

  run(): void {
    const schedule = this.scheduler.run();
    let nextArg: SchedulerThreadReturn = undefined;
    do {
      const next = schedule.next(nextArg);
      if (next.done) {
        break;
      }

      const pid = next.value;
      const entry = unpackEntry(this.table[pid]);
      const startCPU = Game.cpu.getUsed();
      nextArg = this.runThread(pid);
      const endCpu = Game.cpu.getUsed();
      recordStats({
        threads: {
          [entry.type]: {
            [pid]: endCpu - startCPU,
          },
        },
      });
    } while (true);
  }

  /* istanbul ignore next */
  ps(pid: PID = 0) {
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

import { Logger } from 'Logger';
import { Process, ProcessConstructor, ProcessMemory, Thread } from './Process';
import { hibernate, SysCallResults } from './sys-calls';

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

export interface ROM {
  getHandle<T>(key: string, defaultValue: T): ROMHandle<T>;
}

export class Kernel {
  private readonly tableHandle: ROMHandle<ProcessTable>;
  private get table(): ProcessTable {
    return this.tableHandle.get();
  }
  private readonly logger: Logger;

  private readonly loggerFactory: (name: string) => Logger;
  private readonly threads: Record<PID, Thread> = {};
  private readonly registry: Record<string, ProcessConstructor<never>> = {};

  constructor(config: {
    Init: ProcessConstructor<undefined>;
    processes: ProcessConstructor<any>[];
    rom: ROM;
    loggerFactory: (name: string) => Logger;
  }) {
    const { Init, processes, rom, loggerFactory } = config;
    this.loggerFactory = loggerFactory;
    this.logger = loggerFactory(this.constructor.name);
    this.tableHandle = rom.getHandle<ProcessTable>('processTable', {});
    for (const type of [Tron, Init, ...processes]) {
      this.registerProcess(type as never);
    }
    if (!this.table[0]) {
      this.logger.info('Tron missing, reinitialising');
      this.tableHandle.set({});
      this.createProcess(Tron, undefined, 0, 0);
      this.createProcess(Init, undefined, 1, 0);
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
    this.findChildren(pid).forEach((child) => this.killProcess(child.pid));
  }

  run(): void {
    for (const [key, thread] of Object.entries(this.threads)) {
      const pid = Number.parseInt(key);
      let sysCall: ReturnType<Thread['next']>;
      let nextArg: SysCallResults = undefined;
      do {
        if (!this.table[pid]) {
          break;
        }

        sysCall = thread.next(nextArg);
        nextArg = undefined;
        if (sysCall.done) {
          this.killProcess(pid);
          break;
        }

        if (!sysCall.value) {
          continue;
        }

        if (sysCall.value.type === 'sleep') {
          break;
        }

        if (sysCall.value.type === 'fork') {
          const { memory, processType } = sysCall.value;
          const childPID = this.acquirePID();
          this.createProcess(processType, memory, childPID, pid);
          nextArg = { type: 'fork', pid: childPID };
        }
      } while (true);
    }
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

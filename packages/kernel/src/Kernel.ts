import type { Priority, Scheduler } from './Scheduler';
import {
  MemoryPointer,
  MemoryValue,
  PID,
  Process,
  ProcessInfo,
  SysCallResults,
  Thread,
} from './system';
import { isDefined } from './utils';

const ArgsMemoryKey = '__args';

type ProcessMemory = {
  [ArgsMemoryKey]: MemoryValue[];
  [k: string]: MemoryPointer;
};

type ProcessDescriptor = {
  type: string;
  pid: PID;
  memory: ProcessMemory;
  parent: PID;
  priority: Priority | null;
};

type PackedProcessDescriptor = [
  type: string,
  pid: PID,
  memory: ProcessMemory,
  parent: PID,
  priority: Priority | null
];

const packEntry = (entry: ProcessDescriptor): PackedProcessDescriptor => [
  entry.type,
  entry.pid,
  entry.memory,
  entry.parent,
  entry.priority,
];

const unpackEntry = (entry: PackedProcessDescriptor): ProcessDescriptor => ({
  type: entry[0],
  pid: entry[1],
  memory: entry[2],
  parent: entry[3],
  priority: entry[4],
});

const entryToInfo = (entry: ProcessDescriptor): ProcessInfo => ({
  pid: entry.pid,
  parent: entry.parent,
  priority: entry.priority,
  type: entry.type as never,
  args: entry.memory[ArgsMemoryKey] as never,
});

type ProcessTable = Record<PID, PackedProcessDescriptor>;

export interface IKernel {
  run(): void;
  reboot(): void;
  kill(pid: PID): boolean;
  ps(): Array<ProcessInfo>;
}

export interface PersistentDataHandle<T extends MemoryValue> {
  get(): T;
  set(value: MemoryValue): void;
}

export class Kernel implements IKernel {
  private tableRef: PersistentDataHandle<ProcessTable>;
  private get table(): ProcessTable {
    return this.tableRef.get();
  }
  private set table(value: ProcessTable) {
    this.tableRef.set(value);
  }

  private getProcessDescriptor(pid: PID): ProcessDescriptor {
    const descriptor = this.table[pid];
    if (!descriptor) {
      throw new Error(`Attempted to access non-existent process ${pid}`);
    }

    return unpackEntry(descriptor);
  }
  private get pids(): PID[] {
    return Object.keys(this.table).map((k) => Number.parseInt(k));
  }

  private readonly registry: Record<string, Process<MemoryValue[]>>;
  private readonly threads = new Map<PID, Thread>();
  private readonly sleepingThreads = new Map<PID, number>();

  private readonly scheduler: Scheduler;
  private readonly clock: () => number;
  private readonly quota: () => number;
  private readonly onError: (error: unknown) => void;

  constructor(config: {
    registry: OSRegistry;
    scheduler: Scheduler;
    getDataHandle: <T extends MemoryValue>(
      key: string,
      defaultValue: T
    ) => PersistentDataHandle<T>;
    onError(error: unknown): void;
    clock(): number;
    quota(): number;
  }) {
    const { registry, scheduler } = config;
    this.registry = registry as never;
    this.scheduler = scheduler;
    this.clock = () => config.clock();
    this.quota = () => config.quota();
    this.onError = (err) => config.onError(err);
    this.tableRef = config.getDataHandle<ProcessTable>('table', {});

    this.reboot();
    this.PIDCount = Math.max(0, ...this.pids);
  }

  private clear() {
    for (const pid of this.pids) {
      this.scheduler.remove(pid);
    }
    this.threads.clear();
    this.sleepingThreads.clear();
  }

  /**
   * Wipes memory and starts init.
   */
  reset() {
    this.clear();
    this.table = {};
    this.createProcess('init', [], 0, 0);
  }

  /**
   * Restarts all processes. Keeps memory.
   */
  reboot() {
    this.clear();
    const init = this.table[0];
    if (!init || unpackEntry(init).type !== 'init') {
      this.table = {};
      this.createProcess('init', [], 0, 0);
    } else {
      for (const pid of this.pids) {
        if (pid in this.table) {
          this.initThread(pid);
        }
      }
    }
  }

  private PIDCount: PID;
  private acquirePID(): PID {
    if (this.PIDCount >= 50000) {
      this.PIDCount = 0;
    }
    ++this.PIDCount;
    if (this.table[this.PIDCount]) {
      return this.acquirePID();
    }
    return this.PIDCount;
  }

  private createProcess(
    type: string,
    args: MemoryValue[],
    parent: PID,
    pid: PID = this.acquirePID(),
    priority?: Priority
  ): ProcessDescriptor {
    // istanbul ignore next
    if (pid in this.table) {
      throw new Error(`PID already occupied`);
    }

    const descriptor = {
      type,
      pid,
      parent,
      memory: {
        [ArgsMemoryKey]: args,
      },
      priority: priority ?? null,
    };

    this.table[pid] = packEntry(descriptor);

    this.initThread(pid);
    return descriptor;
  }

  private initThread(pid: PID) {
    const { type, memory, priority } = this.getProcessDescriptor(pid);
    const process = this.registry[type];
    if (!process) {
      this.kill(pid);
      this.onError(
        new Error(
          `Error trying to initialise pid ${pid} with unknown type ${type}`
        )
      );
      return;
    }

    const args = memory[ArgsMemoryKey];
    this.threads.set(pid, process(...args));
    this.scheduler.add(pid, priority);
  }

  private findChildren(pid: PID): ProcessDescriptor[] {
    return Object.values(this.table)
      .map((v) => unpackEntry(v))
      .filter(({ parent }) => parent === pid);
  }

  public kill(pid: PID): boolean {
    if (pid === 0 || !(pid in this.table || this.threads.has(pid))) {
      return false;
    }

    // Orphans are killed
    this.findChildren(pid).forEach((child) => {
      this.kill(child.pid);
    });

    this.threads.delete(pid);
    delete this.table[pid];
    this.scheduler.remove(pid);

    return true;
  }

  private runThread(pid: PID): boolean {
    const thread = this.threads.get(pid);
    if (!thread) {
      this.initThread(pid);
      return false;
    }

    if (this.sleepingThreads.has(pid)) {
      return false;
    }

    let nextArg: SysCallResults = undefined;
    for (;;) {
      const sysCall = thread.next(nextArg);
      nextArg = undefined;

      if (sysCall.done) {
        this.kill(pid);
        return false;
      }

      if (!sysCall.value) {
        return true;
      }

      switch (sysCall.value.type) {
        case 'sleep': {
          this.sleepingThreads.set(pid, this.clock() + sysCall.value.ticks);
          return false;
        }
        case 'spawn': {
          const { args, processType, priority } = sysCall.value;
          const child = this.createProcess(
            processType,
            args,
            pid,
            undefined,
            priority
          );
          nextArg = { type: 'spawn', pid: child.pid };
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
        case 'malloc': {
          const descriptor = this.getProcessDescriptor(pid);
          nextArg = { type: 'malloc', pointer: descriptor.memory };
          break;
        }
        case 'children': {
          const children = this.findChildren(pid).reduce<
            Record<PID, ProcessInfo>
          >(
            (acc, entry) => ({
              ...acc,
              [entry.pid]: entryToInfo(entry),
            }),
            {}
          );
          nextArg = { type: 'children', children };
          break;
        }
        case 'request_priority': {
          const priority = isDefined(sysCall.value.priority)
            ? this.scheduler.clampPriority(sysCall.value.priority)
            : undefined;
          this.table[pid] = packEntry({
            ...this.getProcessDescriptor(pid),
            priority: priority ?? null,
          });
          this.scheduler.add(pid, priority ?? null);
          break;
        }
        case 'info': {
          const info = entryToInfo(this.getProcessDescriptor(pid));
          nextArg = { type: 'info', info };
          break;
        }
      }
    }
  }

  public run(): void {
    const tick = this.clock();
    for (const [pid, wakeTime] of this.sleepingThreads) {
      if (tick >= wakeTime) {
        this.sleepingThreads.delete(pid);
      }
    }

    const schedule = this.scheduler.run(this.quota);
    let nextArg = true;
    for (;;) {
      const next = schedule.next(nextArg);
      if (next.done) {
        break;
      }

      const pid = next.value;
      try {
        nextArg = this.runThread(pid);
      } catch (err) {
        this.kill(pid);
        this.onError(err);

        if (pid === 0) {
          this.reset();
          return;
        }
        continue;
      }
    }
  }

  /* istanbul ignore next */
  public ps(): Array<ProcessInfo> {
    return Object.values(this.table).map((entry) =>
      entryToInfo(unpackEntry(entry))
    );
  }

  public inspect(pid: PID): ProcessMemory | null {
    const entry = this.table[pid];
    if (!entry) {
      return null;
    }

    return unpackEntry(entry).memory;
  }
}

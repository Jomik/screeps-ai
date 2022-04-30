import type { Priority, Scheduler, SchedulerThreadReturn } from './Scheduler';
import {
  MemoryPointer,
  MemoryValue,
  OSExit,
  PID,
  Process,
  ProcessInfo,
  SysCallResults,
  Thread,
} from './system';

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
  priority: Priority;
};

type PackedProcessDescriptor = [
  type: string,
  pid: PID,
  memory: ProcessMemory,
  parent: PID,
  priority: Priority
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
  type: entry.type as keyof OSRegistry,
  args: entry.memory[ArgsMemoryKey] as never,
});

type ProcessTable = Record<PID, PackedProcessDescriptor>;

export interface IKernel {
  run(): void;
  reboot(): void;
  kill(pid: PID): boolean;
  ps(): Array<ProcessInfo>;
}

interface KernelLogger {
  onKernelError?(message: string): void;
  onThreadExit?(process: ProcessInfo, reason: string): void;
  onThreadError?(process: ProcessInfo, error: unknown): void;
}

interface PersistentDataHandle<T extends MemoryValue> {
  get(): T;
  set(value: MemoryValue): void;
}

export class Kernel implements IKernel {
  private tableRef = this.getDataHandle<ProcessTable>('table', {});
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
    return Object.keys(this.table).map((k) => Number.parseInt(k) as PID);
  }

  private readonly registry: Record<string, Process<MemoryValue[]>>;
  private readonly threads = new Map<PID, Thread>();

  constructor(
    registry: OSRegistry,
    private readonly scheduler: Scheduler,
    private readonly getDataHandle: <T extends MemoryValue>(
      key: string,
      defaultValue: T
    ) => PersistentDataHandle<T>,
    private readonly logger?: KernelLogger
  ) {
    this.registry = registry as never;
    const root = this.table[0 as PID];
    if (!root || unpackEntry(root).type !== 'init') {
      this.logger?.onKernelError?.('Root process, init, is missing or corrupt');
      this.reboot();
    } else {
      for (const pid of this.pids) {
        this.initThread(pid);
      }
    }
    this.PIDCount = Math.max(0, ...this.pids) as PID;
  }

  reboot() {
    for (const pid of this.pids) {
      this.scheduler.remove(pid);
    }
    this.table = {};
    this.threads.clear();

    this.createProcess('init', [], 0 as PID, 0 as PID, undefined);
  }

  private PIDCount: PID;
  private acquirePID(): PID {
    if (this.PIDCount >= 50000) {
      this.PIDCount = 0 as PID;
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
    priority: Priority = this.scheduler.defaultPriority
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
      priority: this.scheduler.clampPriority(priority),
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
      this.logger?.onKernelError?.(
        `Error trying to initialise pid ${pid} with unknown type ${type}`
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

  private runThread(pid: PID): SchedulerThreadReturn {
    const thread = this.threads.get(pid);
    if (!thread) {
      this.logger?.onKernelError?.(
        `Attempting to run ${pid} with missing thread.`
      );
      this.kill(pid);
      return undefined;
    }

    let nextArg: SysCallResults = undefined;
    for (;;) {
      const sysCall = thread.next(nextArg);
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
          const { args, processType, priority } = sysCall.value;
          const child = this.createProcess(
            processType,
            args,
            pid,
            undefined,
            priority as Priority
          );
          nextArg = { type: 'fork', pid: child.pid };
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
        case 'allocate': {
          const descriptor = this.getProcessDescriptor(pid);
          nextArg = { type: 'allocate', pointer: descriptor.memory };
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
      const entry = this.getProcessDescriptor(pid);
      const startCPU = Game.cpu.getUsed();
      try {
        nextArg = this.runThread(pid);
      } catch (err) {
        this.kill(pid);
        if (err instanceof OSExit) {
          this.logger?.onThreadExit?.(entryToInfo(entry), err.message);
          continue;
        }
        this.logger?.onThreadError?.(entryToInfo(entry), err);
        continue;
      }
      const endCpu = Game.cpu.getUsed();
      // TODO
      // recordStats({
      //   threads: {
      //     [entry.type]: {
      //       [pid]: endCpu - startCPU,
      //     },
      //   },
      // });
    }
  }

  /* istanbul ignore next */
  public ps(): Array<ProcessInfo> {
    return Object.values(this.table).map((entry) =>
      entryToInfo(unpackEntry(entry))
    );
  }
}

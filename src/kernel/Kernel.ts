import { isGeneratorFunction } from 'utils/generator';
import { entries } from 'utils/object';
import { Process, ProcessConstructor, ProcessMemory, Thread } from './Process';
import { sleep, SysCalls } from './sys-calls';

type Memory = Record<string, unknown>;

type ProcessDescriptor<M extends Memory | undefined> = {
  type: string;
  pid: number;
  parent: number;
  priority: number;
  memory: M;
};

type PackedProcessDescriptor<M extends Memory | undefined> = [
  type: string,
  pid: number,
  parent: number,
  priority: number,
  memory: M
];

const packEntry = <M extends Memory | undefined>(
  entry: ProcessDescriptor<M>
): PackedProcessDescriptor<M> => [
  entry.type,
  entry.pid,
  entry.parent,
  entry.priority,
  entry.memory,
];

const unpackEntry = <M extends Memory | undefined>(
  entry: PackedProcessDescriptor<M>
): ProcessDescriptor<M> => ({
  type: entry[0],
  pid: entry[1],
  parent: entry[2],
  priority: entry[3],
  memory: entry[4],
});

function* threadify(process: Process<never>): Thread {
  const run = process.run.bind(process) as (() => void) | (() => Thread);

  if (isGeneratorFunction(run)) {
    const res = yield* run();
    return res;
  } else {
    while (true) {
      run();
      yield sleep();
    }
  }
}

class Tron extends Process<undefined> {
  run() {
    // Do nothing
  }
}

export class Kernel {
  private readonly table: Record<number, PackedProcessDescriptor<never>> = {};
  private readonly threads: Record<number, Thread> = {};
  private readonly registry: Record<string, ProcessConstructor<never>> = {};

  constructor() {
    this.createProcess(Tron, undefined, 0, 0, 0);
  }

  private PIDCount = 0;
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

  spawn<M extends ProcessMemory, Type extends ProcessConstructor<M>>(
    type: Type,
    memory: M,
    priority?: number
  ): void {
    const pid = this.acquirePID();
    this.createProcess(type, memory, pid, 0, priority);
  }

  private registerProcess<Type extends ProcessConstructor<never>>(type: Type) {
    if (this.registry[type.name]) {
      if (this.registry[type.name] !== type) {
        throw new Error(`Process already exists in registry: ${type.name}`);
      }
    }
    this.registry[type.name] = type;
  }

  private createProcess<
    M extends ProcessMemory,
    Type extends ProcessConstructor<M>
  >(type: Type, memory: M, pid: number, parent: number, priority = 50) {
    if (this.table[pid]) {
      throw new Error(`PID already occupied: ${pid}`);
    }
    this.registerProcess(type as never);

    const process = new this.registry[type.name](memory as never);

    this.table[pid] = packEntry<never>({
      type: type.name,
      pid,
      parent,
      priority,
      memory: memory as never,
    });
    this.threads[pid] = threadify(process);
  }

  private killProcess(pid: number) {
    delete this.threads[pid];
    delete this.table[pid];
  }

  private runThread(pid: number, thread: Thread) {
    let state: ReturnType<Thread['next']> = thread.next();
    let interrupt = false;

    if (state.done) {
      this.killProcess(pid);
      return;
    }

    while (!state.done && !interrupt) {
      const syscall: void | SysCalls = state.value;
      // Cooperative scheduling
      if (!syscall) {
        return;
        // TODO: Decide if we should stop or continue or requeue
        // state = thread.next();
        // continue;
      }

      switch (syscall.type) {
        case 'sleep':
          return;
      }
    }
  }

  run(): void {
    // TODO: Scheduling
    for (const [pid, thread] of entries(this.threads)) {
      try {
        this.runThread(pid, thread);
      } catch (error) {
        this.killProcess(pid);
        throw error;
      }
    }
  }

  ps(pid = 0) {
    const tableByParent = _.groupBy(
      Object.values(this.table)
        .map(unpackEntry)
        .filter(({ pid }) => pid !== 0),
      'parent'
    );

    const getSubTree = (prefix: string, pid: number, end: boolean): string => {
      const row = this.table[pid];
      if (!row) {
        return `No process with pid ${pid}`;
      }

      const [type] = row;

      const header = `${prefix}${end ? '`-- ' : '|-- '}${type}:${pid}`;

      const children = tableByParent[pid] ?? [];
      children.sort((a, b) => a.priority - b.priority);
      const childTree = children.map(({ pid }, i) =>
        getSubTree(
          prefix + (end ? '    ' : '|    '),
          pid,
          i === children.length - 1
        )
      );

      return `${header}\n${childTree.join('\n')}`;
    };

    return getSubTree('', pid, true);
  }
}

import { STATUS_CODES } from 'http';
import { ErrorMapper } from 'utils/ErrorMapper';
import { isGeneratorFunction } from 'utils/generator';
import { entries } from 'utils/object';
import { Process, ProcessConstructor, ProcessMemory, Thread } from './Process';
import { CFS } from './schedulers/CFS';
import { sleep, SysCall } from './sys-calls';

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

function threadify(process: Process<never>): () => Thread {
  const run = process.run.bind(process) as (() => void) | (() => Thread);

  if (isGeneratorFunction(run)) {
    return run;
  } else {
    return function* () {
      while (true) {
        run();
        yield sleep();
      }
    };
  }
}

class Tron extends Process<undefined> {
  *run() {
    while (true) {
      yield sleep(Infinity);
    }
  }
}

export class Kernel {
  private readonly table: Record<PID, PackedProcessDescriptor<never>> = {};
  private readonly threads: Record<PID, Thread> = {};
  private readonly registry: Record<string, ProcessConstructor<never>> = {};
  private readonly scheduler: CFS;

  constructor(processes: ProcessConstructor<any>[]) {
    this.scheduler = new CFS();
    this.createProcess(Tron, undefined, 0, 0, 0);
    processes.forEach((type) => this.registerProcess(type as never));
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
      memory: memory as never,
    });
    this.threads[pid] = threadify(process)();
    this.scheduler.add(pid);
  }

  private killProcess(pid: PID) {
    delete this.threads[pid];
    delete this.table[pid];
    this.scheduler.remove(pid);
  }

  run(): void {
    const schedule = this.scheduler.run();
    let pid = schedule.next();
    while (!pid.done) {
      let sysCall: ReturnType<Thread['next']>;
      try {
        sysCall = this.threads[pid.value].next();
      } catch (error) {
        this.killProcess(pid.value);
        console.log(ErrorMapper.sourceMappedStackTrace(error as never));
        pid = schedule.next({ done: true, value: undefined });
        break;
      }
      pid = schedule.next(sysCall);
    }
  }

  ps(pid: PID = 0) {
    const tableByParent = _.groupBy(
      Object.values(this.table)
        .map(unpackEntry)
        .filter(({ pid }) => pid !== 0),
      'parent'
    );

    const getSubTree = (prefix: string, pid: PID, end: boolean): string => {
      const row = this.table[pid];
      if (!row) {
        return `No process with pid ${pid}`;
      }

      const [type] = row;

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

      return `${header}\n${childTree.join('\n')}`;
    };

    return getSubTree('', pid, true);
  }
}

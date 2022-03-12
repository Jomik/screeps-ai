import { Tron } from 'processes/Tron';
import { getMemoryRef } from './memory';
import { ProcessConstructor, ProcessMemory, Thread } from './Process';
import { SysCallResults } from './sys-calls';

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

export class Kernel {
  private get table(): ProcessTable {
    return getMemoryRef<ProcessTable>('processTable', {});
  }

  private readonly threads: Record<PID, Thread> = {};
  private readonly registry: Record<string, ProcessConstructor<never>> = {};

  constructor(processes: ProcessConstructor<any>[]) {
    this.registerProcess(Tron as never);
    processes.forEach((type) => this.registerProcess(type as never));
    if (!this.table[0]) {
      for (const key in this.table) {
        delete this.table[key];
      }
      this.createProcess(Tron, undefined, 0, 0);
    } else {
      for (const key of Object.keys(this.table)) {
        const pid = Number.parseInt(key);
        this.initThread(pid);
      }
    }
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
    memory: M
  ): void {
    const pid = this.acquirePID();
    this.createProcess(type, memory, pid, 0);
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
  >(type: Type, memory: M, pid: number, parent: number) {
    if (this.table[pid]) {
      throw new Error(`PID already occupied: ${pid}`);
    }
    this.registerProcess(type as never);

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
    const process = new this.registry[descriptor.type]();
    process.init({
      pid,
      parent: () => unpackEntry(this.table[pid]).parent,
      memory: () => unpackEntry(this.table[pid]).memory,
      children: () => this.findChildren(pid),
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

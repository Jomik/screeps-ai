import { PID } from './Kernel';
import { SysCall, SysCallResults } from './sys-calls';

export type Thread = Generator<SysCall | void, void, SysCallResults>;

export type ProcessMemory = Record<string, unknown> | undefined;

const internal = Symbol('internal');

type Config = {
  pid: PID;
  parent: () => PID;
  children: () => Array<{ type: ProcessConstructor<never>; pid: PID }>;
  memory: () => Memory;
};

export abstract class Process<Memory extends ProcessMemory> {
  private [internal]: any;
  get parent(): PID {
    return this[internal].parent();
  }
  get pid(): PID {
    return this[internal].pid;
  }
  get children(): Array<{ type: ProcessConstructor<any>; pid: PID }> {
    return this[internal].children();
  }
  get memory(): Memory {
    return this[internal].memory();
  }

  hasChildOfType(type: ProcessConstructor<any>): boolean {
    return this.children.map((v) => v.type).includes(type);
  }

  init(config: Config): void {
    this[internal] = config;
  }

  abstract run(): Thread;
}

export type ProcessConstructor<Memory extends ProcessMemory> =
  new () => Process<Memory>;

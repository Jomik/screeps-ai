import { Logger } from 'Logger';
import { PID } from './Kernel';
import { SysCall, SysCallResults } from './sys-calls';

export type Thread = Generator<SysCall | void, void, SysCallResults>;

export type ProcessMemory = Record<string, unknown> | undefined;

const internal = Symbol('internal');

type Child = {
  type: ProcessConstructor<any>;
  pid: PID;
};

type Config = {
  pid: PID;
  parent: () => PID;
  children: () => Child[];
  memory: () => Memory;
};

export abstract class Process<Memory extends ProcessMemory> {
  protected readonly logger: Logger = new Logger(this.constructor as never);
  private [internal]: any;

  protected get parent(): PID {
    return this[internal].parent();
  }

  protected get pid(): PID {
    return this[internal].pid;
  }

  protected get children(): Child[] {
    return this[internal].children();
  }

  protected get memory(): Memory {
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

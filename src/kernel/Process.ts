import { Logger } from 'Logger';
import { PID } from './Kernel';
import { SysCall, SysCallResults } from './sys-calls';

export type Thread<R = void> = Generator<SysCall | void, R, SysCallResults>;

export type ProcessMemory = Record<string, unknown> | undefined;

const internal = Symbol('internal');

type Child = {
  type: ProcessConstructor<any>;
  pid: PID;
};

type Config = {
  children: () => Child[];
  memory: () => Memory;
  logger: Logger;
};

export abstract class Process<Memory extends ProcessMemory> {
  protected readonly logger: Logger;
  private [internal]: any;

  constructor(config: Config) {
    this.logger = config.logger;
    this[internal] = config;
  }

  protected get children(): Child[] {
    return this[internal].children();
  }

  protected get memory(): Memory {
    return this[internal].memory();
  }

  abstract run(): Thread;
}

export type ProcessConstructor<Memory extends ProcessMemory> = new (
  config: Config
) => Process<Memory>;

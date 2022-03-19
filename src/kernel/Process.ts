import { Logger } from 'Logger';
import { PID } from './Kernel';
import { SysCall, SysCallResults } from './sys-calls';

export type Thread<R = void> = Generator<SysCall | void, R, SysCallResults>;

export type ProcessMemory = Record<string, unknown>;

const internal = Symbol('internal');

export type ChildDescriptor = {
  type: ProcessConstructor<any>;
  pid: PID;
};

type Config<M extends ProcessMemory> = {
  children: () => ChildDescriptor[];
  memory: () => M;
  logger: Logger;
};

export abstract class Process<M extends ProcessMemory = Record<string, never>> {
  protected readonly logger: Logger;
  private [internal]: Config<M>;

  constructor(config: Config<M>) {
    this.logger = config.logger;
    this[internal] = config;
  }

  protected get children(): ChildDescriptor[] {
    return this[internal].children();
  }

  protected get memory(): M {
    return this[internal].memory();
  }

  abstract run(): Thread;
}

export type ProcessConstructor<
  M extends ProcessMemory = Record<string, never>
> = new (config: Config<M>) => Process<M>;

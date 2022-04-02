import { Logger } from 'Logger';
import { PID } from './Kernel';
import { SysCall, SysCallResults } from './sys-calls';

export type Thread<R = void> = Generator<SysCall | void, R, SysCallResults>;

export type ProcessMemory = Record<string, unknown>;

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
  private config: Config<M>;

  constructor(config: Config<M>) {
    this.logger = config.logger;
    this.config = config;
  }

  protected get memory(): M {
    return this.config.memory();
  }

  protected get children(): ChildDescriptor[] {
    return this.config.children();
  }

  protected hasChildOfType(type: ProcessConstructor<any>): boolean {
    return this.children.some((v) => v.type === type);
  }

  abstract run(): Thread;
}

export type ProcessConstructor<
  M extends ProcessMemory = Record<string, never>
> = new (config: Config<M>) => Process<any>;

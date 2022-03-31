import { Logger } from 'Logger';
import { PID, SocketIn, SocketOut } from './Kernel';
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

type ObjectsFromMemory<M extends ProcessMemory> = {
  [Key in keyof M as M[Key] extends Id<_HasId> | undefined
    ? Key
    : never]: M[Key] extends Id<_HasId> | undefined
    ? fromId<NonNullable<M[Key]>> | null
    : never;
};

type SocketsFromMemory<M extends ProcessMemory> = {
  [Key in keyof M as M[Key] extends SocketIn | SocketOut | undefined
    ? Key
    : never]: M[Key];
};

export abstract class Process<M extends ProcessMemory = Record<string, never>> {
  protected readonly logger: Logger;
  private config: Config<M>;
  protected objects: ObjectsFromMemory<M>;

  constructor(config: Config<M>) {
    this.logger = config.logger;
    this.config = config;

    this.objects = new Proxy<Config<M>, ObjectsFromMemory<M>>(this.config, {
      set(target, property: string, value: _HasId | null | undefined) {
        const memory = target.memory();
        return Reflect.set(memory, property, value?.id, memory);
      },
      get(target, property: string) {
        const memory = target.memory();
        if (memory[property] === undefined || memory[property] === null) {
          return Reflect.get(memory, property, memory) as never;
        }

        return Game.getObjectById(memory[property] as Id<_HasId>);
      },
    });
  }

  protected get memory(): {
    [K in keyof M as M[K] extends Id<_HasId> | SocketIn | SocketOut
      ? never
      : K]: M[K];
  } {
    return this.config.memory();
  }

  protected get sockets(): SocketsFromMemory<M> {
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

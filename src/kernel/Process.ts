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

type NamingConvention<S extends string> =
  | `${string}${Capitalize<S>}`
  | `${Lowercase<S>}${string}`;

type AugmentedMemory<M extends ProcessMemory> = {
  [Key in keyof M]: M[Key] extends string | undefined
    ? Key extends NamingConvention<'room'>
      ? M[Key] extends undefined
        ? Room | undefined
        : Room
      : Key extends NamingConvention<'creep'>
      ? M[Key] extends undefined
        ? Creep | undefined
        : Creep
      : M[Key]
    : M[Key];
};

export abstract class Process<M extends ProcessMemory = Record<string, never>> {
  protected readonly logger: Logger;
  private config: Config<M>;
  protected memory: AugmentedMemory<M>;

  constructor(config: Config<M>) {
    this.logger = config.logger;
    this.config = config;

    this.memory = new Proxy<Config<M>, AugmentedMemory<M>>(this.config, {
      set(target, property: string, value: unknown) {
        const memory = target.memory();
        if (typeof value !== 'string' || value !== undefined) {
          return Reflect.set(memory, property, value, memory);
        }
        if (property.startsWith('room') || property.endsWith('Room')) {
          return Reflect.set(memory, property, (value as Room).name, memory);
        }
        if (property.startsWith('creep') || property.endsWith('Creep')) {
          return Reflect.set(memory, property, (value as Creep).name, memory);
        }
        return Reflect.set(memory, property, value, memory);
      },
      get(target, property: string) {
        const memory = target.memory();
        if (typeof memory[property] !== 'string') {
          return Reflect.get(memory, property, memory) as never;
        }

        if (property.startsWith('room') || property.endsWith('Room')) {
          return Game.rooms[memory[property] as never];
        }
        if (property.startsWith('creep') || property.endsWith('Creep')) {
          return Game.creeps[memory[property] as never];
        }

        return Reflect.get(memory, property, memory) as never;
      },
    });
  }

  protected get children(): ChildDescriptor[] {
    return this.config.children();
  }

  abstract run(): Thread;
}

export type ProcessConstructor<
  M extends ProcessMemory = Record<string, never>
> = new (config: Config<M>) => Process<any>;

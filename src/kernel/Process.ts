import { SysCalls } from './sys-calls';

export type Thread = Generator<SysCalls | void, void, void>;

export type ProcessMemory = Record<string, unknown> | undefined;

export abstract class Process<Memory extends ProcessMemory> {
  constructor(protected memory: Memory) {}
  abstract run(): Thread | void;
}

export type ProcessConstructor<Memory extends ProcessMemory> = new (
  memory: Memory
) => Process<Memory>;

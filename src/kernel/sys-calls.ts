import { PID } from './Kernel';
import { ProcessConstructor, ProcessMemory } from './Process';

export type SysCall = Sleep | Fork;
export type SysCallResults = void | { type: 'fork'; pid: number };

type SysCallGenerator<T extends SysCall, R> = Generator<
  T,
  R,
  void | SysCallResults
>;

type Sleep = {
  type: 'sleep';
  ticks: number;
};
export function* sleep(ticks: number = 1): SysCallGenerator<Sleep, void> {
  yield {
    type: 'sleep',
    ticks,
  };
}

export function* hibernate() {
  while (true) {
    yield* sleep(Infinity);
  }
}

type Fork = {
  type: 'fork';
  processType: ProcessConstructor<never>;
  memory: never;
};
export function* fork<
  M extends ProcessMemory,
  Type extends ProcessConstructor<M>
>(type: Type, memory: M): SysCallGenerator<Fork, PID> {
  const res = yield {
    type: 'fork',
    processType: type as never,
    memory: memory as never,
  };
  if (!res || res.type !== 'fork') {
    throw new Error('Did not receive a new process ID');
  }
  return res.pid;
}

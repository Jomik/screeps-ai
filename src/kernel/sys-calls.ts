import { PID } from './Kernel';
import { ProcessConstructor, ProcessMemory, Thread } from './Process';

export type SysCall = Sleep | Fork;
export type SysCallResults = void | { type: 'fork'; pid: number };

type Sleep = {
  type: 'sleep';
  ticks: number;
};
export function* sleep(ticks: number = 1): Thread<void> {
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
>(type: Type, memory: M): Thread<PID> {
  const res = yield {
    type: 'fork',
    processType: type as never,
    memory: memory as never,
  };
  // istanbul ignore next
  if (!res || res.type !== 'fork') {
    throw new Error('Did not receive a new process ID');
  }
  return res.pid;
}

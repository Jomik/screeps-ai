import { PID } from './Kernel';
import { ProcessConstructor, ProcessMemory, Thread } from './Process';

export type SysCall = Sleep | Fork | Kill;
export type SysCallResults = void | ForkResult;

type Sleep = {
  type: 'sleep';
  ticks: number;
};
export function* sleep(ticks = 1): Thread<void> {
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
type ForkResult = {
  type: 'fork';
  pid: PID;
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

type Kill = {
  type: 'kill';
  pid: PID;
};
export function* kill(pid: PID): Thread {
  yield {
    type: 'kill',
    pid,
  };
}

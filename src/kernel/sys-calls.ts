import { PID } from './Kernel';
import { ProcessConstructor, ProcessMemory, Thread } from './Process';

export type SysCall = Sleep | Fork<Record<string, unknown>> | Kill;
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
  for (;;) {
    yield* sleep(Infinity);
  }
}

type Fork<M extends ProcessMemory> = {
  type: 'fork';
  processType: ProcessConstructor<M>;
  memory: M;
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
    processType: type as ProcessConstructor<Record<string, unknown>>,
    memory,
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

export function* restartOnTickChange(process: () => Thread): Thread {
  for (;;) {
    const tick = Game.time;
    const thread = process();
    while (tick === Game.time) {
      const { done, value } = thread.next();

      if (done) {
        return value;
      }

      yield value;
    }
  }
}

import { PID } from './Kernel';
import { ProcessConstructor, Thread } from './Process';

export type SysCall = Sleep | Fork | Kill;
export type SysCallResults = void | ForkResult;

function assertResultType<T extends Exclude<SysCallResults, void>['type']>(
  res: SysCallResults,
  type: T
): asserts res is Extract<SysCallResults, { type: T }> {
  // istanbul ignore next
  if (!res || res.type !== type) {
    throw new Error(
      `Expected to receive a fork result, but got ${res?.type ?? 'unknown'}`
    );
  }
}

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

type Fork = {
  type: 'fork';
  processType: ProcessConstructor<Record<string, unknown>>;
  memory: Record<string, unknown>;
};
type ForkResult = {
  type: 'fork';
  pid: PID;
};
export function* fork<Type extends ProcessConstructor<any>>(
  type: Type,
  memory: Type extends ProcessConstructor<infer M> ? M : never
): Thread<PID> {
  const res = yield {
    type: 'fork',
    processType: type,
    memory,
  };
  assertResultType(res, 'fork');
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

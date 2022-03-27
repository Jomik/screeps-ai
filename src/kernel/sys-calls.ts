import { PID, Socket, SocketIn, SocketOut } from './Kernel';
import { ProcessConstructor, Thread } from './Process';

export type SysCall = Sleep | Fork | Kill | OpenSocket | Read | Write;
export type SysCallResults = void | ForkResult | OpenSocketResult | ReadResult;

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

type OpenSocket = {
  type: 'open_socket';
  path: string;
};
type OpenSocketResult = {
  type: 'open_socket';
  path: Socket;
};
export function* openSocket<T>(path: string): Thread<Socket<T>> {
  const res = yield {
    type: 'open_socket',
    path,
  };
  assertResultType(res, 'open_socket');
  return res.path as Socket<T>;
}

type Read = {
  type: 'read';
  path: SocketOut<unknown>;
};
type ReadResult = {
  type: 'read';
  message: unknown | null;
};
export function* read<T>(path: SocketOut<T>): Thread<T | null> {
  const res = yield {
    type: 'read',
    path,
  };
  assertResultType(res, 'read');
  return res.message as T | null;
}

type Write = {
  type: 'write';
  path: SocketIn<unknown>;
  message: unknown;
};
export function* write<T>(path: SocketIn<T>, message: T): Thread {
  yield {
    type: 'write',
    path,
    message,
  };
}

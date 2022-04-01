import {
  File,
  FileIn,
  FileOut,
  FilePath,
  Socket,
  SocketIn,
  SocketOut,
  SocketPath,
} from './io';
import { PID } from './Kernel';
import { ProcessConstructor, Thread } from './Process';

export type SysCall = Sleep | Fork | Kill | Open | Read | Write;
export type SysCallResults = void | ForkResult | OpenResult | ReadResult;

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

type Open = {
  type: 'open';
  path: SocketPath | FilePath;
};
type OpenResult = {
  type: 'open';
  path: Socket | File;
};
export function* openSocket<T>(path: string): Thread<Socket<T>> {
  const res = yield {
    type: 'open',
    path: `sock://${path}`,
  };
  assertResultType(res, 'open');
  return res.path as Socket<T>;
}
export function* openFile<T>(path: string): Thread<File<T>> {
  const res = yield {
    type: 'open',
    path: `file://${path}`,
  };
  assertResultType(res, 'open');
  return res.path as File<T>;
}

type Read = {
  type: 'read';
  path: SocketOut | FileOut;
};
type ReadResult = {
  type: 'read';
  data: unknown | null;
};
export function* read<T>(path: SocketOut<T> | FileOut<T>): Thread<T | null> {
  const res = yield {
    type: 'read',
    path,
  };
  assertResultType(res, 'read');
  return res.data as T | null;
}

type Write = {
  type: 'write';
  path: SocketIn | FileIn;
  data: unknown;
};
export function* write<T>(path: SocketIn<T> | FileIn<T>, data: T): Thread {
  yield {
    type: 'write',
    path,
    data,
  };
}

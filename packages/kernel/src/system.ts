import type { Priority } from './Scheduler';

declare const PIDSymbol: unique symbol;
export type PID = number & {
  [PIDSymbol]?: 'PID';
};

declare global {
  interface OSRegistry {
    init: Process<[]>;
  }
}

export type MemoryValue =
  | string
  | number
  | PID
  | boolean
  | null
  | { [x: string]: MemoryValue | undefined }
  | Array<MemoryValue>;

export type MemoryPointer =
  | Record<string, MemoryValue | undefined>
  | Array<MemoryValue>;

export type SysCall =
  | Sleep
  | Spawn
  | Kill
  | MAlloc
  | Children
  | RequestPriority
  | Info;
export type SysCallResults =
  | void
  | SpawnResult
  | MAllocResult
  | ChildrenResult
  | InfoResult;

export type Thread<R = void> = Generator<SysCall | void, R, SysCallResults>;

declare const ProcessSymbol: unique symbol;
export type Process<Args extends MemoryValue[]> = ((
  ...args: Args
) => Thread<void>) & {
  [ProcessSymbol]: 'Process';
};
export type ArgsForProcess<Type extends Process<never>> = Type extends Process<
  infer Args
>
  ? Args
  : never;
export type ProcessInfo = {
  [Type in keyof OSRegistry]: {
    pid: PID;
    parent: PID;
    priority: Priority | null;
    type: Type;
    args: ArgsForProcess<OSRegistry[Type]>;
  };
}[keyof OSRegistry];

export const createProcess = <Args extends MemoryValue[]>(
  process: (...args: Args) => Thread<void>
): Process<Args> => process as Process<Args>;

function assertResultType<T extends Exclude<SysCallResults, void>['type']>(
  res: SysCallResults,
  type: T
): asserts res is Extract<SysCallResults, { type: T }> {
  // istanbul ignore next
  if (!res || res.type !== type) {
    throw new Error(
      `Expected to receive a ${type} result, but got ${res?.type ?? 'unknown'}`
    );
  }
}

type Sleep = {
  type: 'sleep';
  ticks: number;
};
export function* sleep(ticks = 1): Thread {
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

type Spawn = {
  type: 'spawn';
  processType: string;
  args: MemoryValue[];
  priority?: Priority;
};
type SpawnResult = {
  type: 'spawn';
  pid: PID;
};
export function* spawn<Type extends keyof OSRegistry>(
  type: Type,
  priority?: Priority,
  ...args: ArgsForProcess<OSRegistry[Type]>
): Thread<PID> {
  const res = yield {
    type: 'spawn',
    processType: type as string,
    args,
    priority,
  };
  assertResultType(res, 'spawn');
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

type MAlloc = {
  type: 'malloc';
};
type MAllocResult = {
  type: 'malloc';
  pointer: Record<string, MemoryValue>;
};

export function* malloc<M extends MemoryValue>(
  address: string,
  defaultValue: M
): Thread<{ value: M }> {
  const res = yield {
    type: 'malloc',
  };
  assertResultType(res, 'malloc');
  if (!(address in res.pointer)) {
    res.pointer[address] = defaultValue;
  }
  return {
    get value() {
      return res.pointer[address] as M;
    },
    set value(v: M) {
      res.pointer[address] = v;
    },
  };
}

type Children = {
  type: 'children';
};
type ChildrenResult = {
  type: 'children';
  children: Record<PID, ProcessInfo>;
};
export function* getChildren(): Thread<Record<PID, ProcessInfo>> {
  const res = yield {
    type: 'children',
  };
  assertResultType(res, 'children');
  return res.children;
}

type RequestPriority = {
  type: 'request_priority';
  priority: Priority | undefined;
};
export function* requestPriority(priority: Priority | undefined): Thread {
  yield {
    type: 'request_priority',
    priority,
  };
}

type Info = {
  type: 'info';
};
type InfoResult = {
  type: 'info';
  info: ProcessInfo;
};
export function* processInfo(): Thread<ProcessInfo> {
  const res = yield {
    type: 'info',
  };
  assertResultType(res, 'info');
  return res.info;
}

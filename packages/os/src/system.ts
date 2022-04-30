export class OSExit extends Error {}

declare const PIDSymbol: unique symbol;
export type PID = number & {
  [PIDSymbol]: 'PID';
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
  | undefined
  | void
  | null
  | { [x: string]: MemoryValue }
  | Array<MemoryValue>;

export type MemoryPointer = Record<string, MemoryValue> | Array<MemoryValue>;
export type SysCall = Sleep | Fork | Kill | Allocate | Children;
export type SysCallResults =
  | void
  | ForkResult
  | AllocateResult
  | ChildrenResult;

export type Thread<R = void> = Generator<SysCall | void, R, SysCallResults>;

declare const ProcessSymbol: unique symbol;
export type Process<Args extends MemoryValue[]> = ((
  ...args: Args
) => Thread<void>) & {
  [ProcessSymbol]: 'Process';
};
export type ArgsForProcess<Type extends Process<any>> = Type extends Process<
  infer Args
>
  ? Args
  : never;

export const createProcess = <Args extends MemoryValue[]>(
  process: (...args: Args) => Thread<void>
): Process<Args> =>
  function* (...args) {
    // yield;
    yield* process(...args);
  } as Process<Args>;

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

type Fork = {
  type: 'fork';
  processType: string;
  args: MemoryValue[];
  priority?: number;
};
type ForkResult = {
  type: 'fork';
  pid: PID;
};
export function* fork<Type extends keyof OSRegistry>(
  type: Type,
  priority?: number,
  ...args: ArgsForProcess<OSRegistry[Type]>
): Thread<PID> {
  const res = yield {
    type: 'fork',
    processType: type as string,
    args,
    priority,
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

export const exit = (reason: string): never => {
  throw new OSExit(reason);
};

type Allocate = {
  type: 'allocate';
};
type AllocateResult = {
  type: 'allocate';
  pointer: Record<string, MemoryPointer>;
};

export function* allocate<M extends MemoryPointer>(
  address: string,
  defaultValue: M
): Thread<NonNullable<M>> {
  const res = yield {
    type: 'allocate',
  };
  assertResultType(res, 'allocate');
  if (!(address in res.pointer)) {
    res.pointer[address] = defaultValue;
  }
  return res.pointer[address] as NonNullable<M>;
}

export type ProcessInfo = {
  [Type in keyof OSRegistry]: {
    pid: PID;
    parent: PID;
    type: Type;
    args: ArgsForProcess<OSRegistry[Type]>;
  };
}[keyof OSRegistry];

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

import { Registry } from 'processes';
import { PID } from './kernel/Kernel';

export type SysCall = Sleep | Fork | Kill | Allocate;
export type SysCallResults = void | ForkResult | AllocateResult;

export type Thread<R = void> = Generator<SysCall | void, R, SysCallResults>;

export type Process<Args extends JSONValue[] = never[]> = (
  ...args: Args
) => Thread<void>;

export const createProcess = <Args extends JSONValue[]>(
  process: Process<Args>
): Process<Args> => process;

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
  processType: keyof Registry;
  args: JSONValue[];
};
type ForkResult = {
  type: 'fork';
  pid: PID;
};
export function* fork<Type extends keyof Registry>(
  type: Type,
  ...args: Registry[Type] extends Process<infer Args> ? Args : never
): Thread<PID> {
  const res = yield {
    type: 'fork',
    processType: type,
    args,
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

type Allocate = {
  type: 'allocate';
};
type AllocateResult = {
  type: 'allocate';
  pointer: Record<string, JSONPointer>;
};

export function* allocate<M extends JSONPointer>(
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

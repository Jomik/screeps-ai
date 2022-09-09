import {
  allocate,
  ArgsForProcess,
  fork,
  getChildren,
  MemoryPointer,
  MemoryValue,
  PID,
  Priority,
  Thread,
} from 'kernel';

const NotCalculated = Symbol.for('NotCalculated');
export const memoizeForTick = <T>(fn: () => Thread<T>): (() => Thread<T>) => {
  let tick = -1;
  let result: T | typeof NotCalculated = NotCalculated;

  return function* () {
    if (tick !== Game.time || result === NotCalculated) {
      result = yield* fn();
      tick = Game.time;
    }

    return result;
  };
};

export function* ensureChild<Type extends keyof OSRegistry>(
  type: Type,
  priority?: Priority,
  ...args: ArgsForProcess<OSRegistry[Type]>
): Thread<PID> {
  const children = yield* getChildren();
  const child = Object.values(children).find(
    (process) => process.type === type && _.isEqual(process.args, args)
  );

  if (child !== undefined) {
    return child.pid;
  }

  return yield* fork(type, priority, ...args);
}

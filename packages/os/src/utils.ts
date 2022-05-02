import { allocate, MemoryValue, Thread } from './system';

export const isProcessType =
  <Type extends keyof OSRegistry>(type: Type) =>
  (info: { type: keyof OSRegistry }): info is { type: Type } =>
    info.type === type;

export const runOnce = <Args extends any[], R extends MemoryValue>(
  process: (...args: Args) => Thread<R>
): ((...args: Args) => Thread<R>) => {
  return function* (...args) {
    const memory = yield* allocate<{ ran: boolean; result?: R }>('run_once', {
      ran: false,
    });

    if (!memory.ran) {
      const result = yield* process(...args);

      memory.ran = true;
      memory.result = result;
    }

    return memory.result as R;
  };
};

export const isDefined = <T>(value: T | undefined | null): value is T =>
  value !== undefined && value !== null;

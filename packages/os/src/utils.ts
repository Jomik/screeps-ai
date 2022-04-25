import { allocate, JSONValue, Thread } from './system';

export const isProcessType =
  <Type extends keyof OSRegistry>(type: Type) =>
  (info: { type: keyof OSRegistry }): info is { type: Type } =>
    info.type === type;

export const restartOnTickChange = <Args extends any[], R>(
  process: (...args: Args) => Thread<R>
): ((...args: Args) => Thread<R>) => {
  return function* (...args) {
    for (;;) {
      const tick = Game.time;
      const thread = process(...args);
      while (tick === Game.time) {
        const { done, value } = thread.next();

        if (done) {
          return value;
        }

        yield value;
      }
    }
  };
};

export const runOnce = <Args extends any[], R extends JSONValue>(
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

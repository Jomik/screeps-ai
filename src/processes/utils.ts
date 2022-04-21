import { Thread } from 'system';

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

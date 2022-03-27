import { Thread } from 'kernel';

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

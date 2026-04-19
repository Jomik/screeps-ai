import { Future } from 'coroutines';

const sleepers = new Map<
  number,
  { future: Future<void>; resolve: () => void }
>();

export const resolveSleep = () => {
  const sleep = sleepers.get(Game.time);

  if (sleep === undefined) {
    return;
  }

  sleep.resolve();
  sleepers.delete(Game.time);
};

export const sleep = (ticks: number = 1): Future<void> => {
  const wakeTime = Game.time + ticks;

  const existing = sleepers.get(wakeTime);
  if (existing !== undefined) {
    return existing.future;
  }

  const [future, resolve] = Future.defer<void>();
  sleepers.set(wakeTime, { future, resolve });

  return future;
};

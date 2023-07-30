import { Future } from './Future';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RoutineCall = void | Future<any>;
export type SubRoutine<T> = Generator<RoutineCall, T, unknown>;
export type Routine = SubRoutine<void>;

export interface Scheduler {
  next(): Routine;
  schedule(routine: Routine): void;
  remove(routine: Routine): void;
}

const resultMap = new WeakMap<Routine, unknown>();

export const createRunner = (
  scheduler: Scheduler,
  onError?: (error: unknown) => void
) => {
  const go = <Args extends unknown[]>(
    fn: (...args: Args) => Routine,
    ...args: Args
  ): void => {
    const task = fn(...args);
    resultMap.set(task, undefined);
    scheduler.schedule(task);
  };

  const wrapExecution = (
    routine: Routine
  ): IteratorResult<RoutineCall, void> => {
    try {
      const lastResult = resultMap.get(routine);
      resultMap.delete(routine);
      return routine.next(lastResult);
    } catch (err: unknown) {
      onError?.(err);
      return { done: true, value: undefined };
    }
  };

  const run = (): void => {
    const routine = scheduler.next();

    if (!routine) {
      throw new Error('No routine to run');
    }

    if (!resultMap.has(routine)) {
      throw new Error('Scheduler returned routine that is not ready to run!');
    }

    const execution = wrapExecution(routine);

    if (execution.done) {
      scheduler.remove(routine);
      return;
    }

    if (execution.value instanceof Future) {
      execution.value.then((data) => {
        resultMap.set(routine, data);
        scheduler.schedule(routine);
      });
      return;
    }

    resultMap.set(routine, undefined);
    scheduler.schedule(routine);

    return;
  };

  return { go, run };
};

import { Future } from './Future';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RoutineCall = void | Future<any>;
export type Routine<T = void> = Generator<RoutineCall, T, unknown>;

export interface Scheduler {
  next(): Routine;
  schedule(routine: Routine): void;
  remove(routine: Routine): void;
}

const resultMap = new WeakMap<Routine, unknown>();

export const createRunner = (
  scheduler: Scheduler,
  onError?: (error: unknown) => void,
) => {
  const go = <Args extends unknown[]>(
    fn: (this: Routine, ...args: Args) => Routine,
    ...args: Args
  ): Routine => {
    // NOTE: This allows the routine to reference itself as this
    // Intended to for use with the scheduler
    function* wrapper(): Routine {
      yield* task;
    }
    const routine = wrapper();
    const task = fn.call(routine, ...args);

    resultMap.set(routine, undefined);
    scheduler.schedule(routine);

    return routine;
  };

  const wrapExecution = (
    routine: Routine,
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

  const run = (): Routine => {
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
      return routine;
    }

    if (execution.value instanceof Future) {
      execution.value.then((data) => {
        resultMap.set(routine, data);
        scheduler.schedule(routine);
      });
      return routine;
    }

    resultMap.set(routine, undefined);
    scheduler.schedule(routine);

    return routine;
  };

  return { go, run };
};

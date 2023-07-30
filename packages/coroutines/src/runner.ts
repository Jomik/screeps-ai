import { Future } from './Future';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RoutineCall = void | Future<any>;
export type SubRoutine<T> = Generator<RoutineCall, T, unknown>;
export type Routine = SubRoutine<void>;

type InternalRoutine = Routine & {
  name: string;
};

export const createRunner = (onError?: (error: unknown) => void) => {
  const resultMap = new WeakMap<Routine, unknown>();
  const coroutines: InternalRoutine[] = [];

  const go = <Args extends unknown[]>(
    fn: ((...args: Args) => Routine) & { name: string },
    ...args: Args
  ): void => {
    const task = fn(...args) as InternalRoutine;
    resultMap.set(task, undefined);
    task.name = fn.name;
    coroutines.push(task);
  };

  const wrapExecution = (
    routine: InternalRoutine
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

  const canRun = (): boolean =>
    coroutines.some((routine) => resultMap.has(routine));

  const run = (): { state: 'done' | 'ready' | 'waiting'; name: string } => {
    const routine = coroutines.pop();
    if (!routine) {
      throw new Error('No routine to run');
    }

    if (!resultMap.has(routine)) {
      coroutines.unshift(routine);
      return { state: 'waiting', name: routine.name };
    }

    const execution = wrapExecution(routine);

    if (execution.done) {
      return { state: 'done', name: routine.name };
    }

    if (execution.value instanceof Future) {
      execution.value.then((data) => {
        resultMap.set(routine, data);
      });
    } else {
      resultMap.set(routine, undefined);
    }
    coroutines.unshift(routine);

    return {
      state: resultMap.has(routine) ? 'ready' : 'waiting',
      name: routine.name,
    };
  };

  return { go, run, canRun };
};

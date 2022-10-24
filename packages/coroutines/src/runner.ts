import { Future } from './Future';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RoutineCall = void | Future<any>;
export type SubRoutine<T> = Generator<RoutineCall, T, unknown>;
export type Routine = SubRoutine<void>;

const Result = Symbol('Result');
const IsReady = Symbol('IsReady');
type InternalRoutine = Routine & {
  [Result]?: unknown;
  [IsReady]: boolean;
  name: string;
};

export const createRunner = (onError?: (error: unknown) => void) => {
  const coroutines: InternalRoutine[] = [];

  const go = <Args extends unknown[]>(
    fn: ((...args: Args) => Routine) & { name: string },
    ...args: Args
  ): void => {
    const task = fn(...args) as InternalRoutine;
    task[IsReady] = true;
    task.name = fn.name;
    coroutines.push(task);
  };

  const runRoutine = (
    routine: InternalRoutine
  ): IteratorResult<RoutineCall, void> => {
    try {
      const lastResult = routine[Result];
      routine[Result] = undefined;
      return routine.next(lastResult);
    } catch (err: unknown) {
      onError?.(err);
      return { done: true, value: undefined };
    }
  };

  const canRun = (): boolean => coroutines.some((routine) => routine[IsReady]);

  const run = (): { state: 'done' | 'ready' | 'waiting'; name: string } => {
    const routine = coroutines.pop();
    if (!routine) {
      throw new Error('No routine to run');
    }

    if (!routine[IsReady]) {
      coroutines.unshift(routine);
      return { state: 'waiting', name: routine.name };
    }

    const execution = runRoutine(routine);

    if (execution.done) {
      return { state: 'done', name: routine.name };
    }

    if (execution.value instanceof Future) {
      routine[IsReady] = false;
      execution.value.then((data) => {
        routine[Result] = data;
        routine[IsReady] = true;
      });
    }
    coroutines.unshift(routine);

    return {
      state: routine[IsReady] ? 'ready' : 'waiting',
      name: routine.name,
    };
  };

  return { go, run, canRun };
};

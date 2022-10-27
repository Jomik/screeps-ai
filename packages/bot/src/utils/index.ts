import { Routine } from 'coroutines';
import { StartOfSourceMap } from 'source-map';
export * from './isStructureType';

type GroupByKey<T extends Record<Key, string>, Key extends string> = {
  [Type in T[Key]]?: Array<Extract<T, Record<Key, Type>>>;
};

export const MaxControllerLevel =
  Math.max(...Object.keys(CONTROLLER_LEVELS).map((n) => Number.parseInt(n))) +
  1;

export const groupByKey = <T extends Record<Key, string>, Key extends string>(
  values: Array<T>,
  key: Key
): GroupByKey<T, Key> =>
  values.reduce((acc, cur) => {
    return {
      ...acc,
      [cur[key]]: (acc[cur[key]] ?? ([] as T[])).concat(cur),
    };
  }, {} as GroupByKey<T, Key>);

export const isDefined = <T>(value: T | undefined | null): value is T =>
  value !== undefined && value !== null;

export const restartOnTickChange = <Args extends unknown[]>(
  routine: (...args: Args) => Routine
): ((...args: Args) => Routine) => {
  const fn = function* (...args: Args) {
    for (;;) {
      const tick = Game.time;
      const thread = routine(...args);
      while (tick === Game.time) {
        const { done, value } = thread.next();

        if (done) {
          return value;
        }

        yield value;
      }
    }
  };
  Object.defineProperty(fn, 'name', { value: routine.name });
  return fn;
};

let counter = 0;
let time = 0;
export const getGuid = (): string => {
  if (time !== Game.time) {
    time = Game.time;
    counter = 0;
  }
  return `${time.toString(36)}:${(++counter).toString(36)}`;
};

export const objectEntries = <T extends string, V>(
  obj: Partial<Record<T, V>>
): [T, V][] => Object.entries(obj).filter(isDefined) as [T, V][];

export const max = <T>(arr: T[], map: (v: T) => number): T | null =>
  arr.reduce<{ value: number; item: T | null }>(
    (prev, item) => {
      const value = map(item);
      return value > prev.value ? { value, item } : prev;
    },
    { value: -Infinity, item: null }
  ).item;

export const min = <T>(arr: T[], map: (v: T) => number): T | null =>
  max(arr, (v) => -map(v));

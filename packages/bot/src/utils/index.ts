import { Thread } from 'os';

type GroupByKey<T extends Record<Key, string>, Key extends string> = {
  [Type in T[Key]]?: Array<Extract<T, Record<Key, Type>>>;
};

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

let counter = 0;
let time = 0;
export const getGuid = (): string => {
  if (time !== Game.time) {
    time = Game.time;
    counter = 0;
  }
  return `${time.toString(36)}:${(++counter).toString(36)}`;
};

// prettier-ignore
const outline = [
  [1,1], [0,1], [-1,1],
  [1,0], /*[0,0],*/ [-1,0],
  [1,-1], [0,-1], [-1,-1],
] as const;

export const expandPosition = (pos: RoomPosition): RoomPosition[] =>
  outline.map(([x, y]) => new RoomPosition(x + pos.x, y + pos.y, pos.roomName));

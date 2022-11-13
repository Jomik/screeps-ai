declare global {
  interface ProxyConstructor {
    new <TSource extends object, TTarget extends object>(
      target: TSource,
      handler: ProxyHandler<TSource>
    ): TTarget;
  }
}

declare const TickSafeSymbol: unique symbol;
export type TickSafe<T> = T & {
  [TickSafeSymbol]: 'TickSafe';
  valid: boolean;
};

export const safeRoom = (target: string | Room): TickSafe<Room> =>
  new Proxy(
    { name: typeof target === 'string' ? target : target.name },
    {
      get(target, name) {
        const room = Game.rooms[target.name];
        if (name === 'valid') {
          return room !== undefined;
        }
        if (!room) {
          throw new Error(`Room ${target.name} disappeared from safe object`);
        }

        return room[name as never];
      },
      getPrototypeOf(target) {
        const room = Game.rooms[target.name];
        if (!room) {
          return null;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return Object.getPrototypeOf(room);
      },
    }
  );

export const safeGameObject = <T extends _HasId>(
  target: T | Id<T>
): TickSafe<T> =>
  new Proxy(
    { id: typeof target === 'string' ? target : target.id },
    {
      get(target, name) {
        const object = Game.getObjectById(target.id);
        if (name === 'valid') {
          return object !== undefined;
        }
        if (!object) {
          throw new Error(
            `Game Object ${target.id} disappeared from safe object`
          );
        }

        return object[name as never];
      },
      getPrototypeOf(target) {
        const object = Game.getObjectById(target.id);
        if (!object) {
          return null;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return Object.getPrototypeOf(object);
      },
    }
  );

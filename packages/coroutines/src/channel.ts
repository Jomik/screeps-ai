import { Future } from './Future';

interface Channel<T> {
  get(): Future<T>;
  send(value: T): Future<void>;
}

export const make = <T>(capacity = 0): Channel<T> => {
  const consumers: Array<(value: T) => void> = [];
  const producers: Array<{ value: T; resolve?: () => void }> = [];

  return {
    get() {
      const producer = producers.shift();
      if (producer) {
        producer.resolve?.();

        if (capacity > 0) {
          const unblocked = producers[capacity - 1];
          if (unblocked) {
            unblocked.resolve?.();
            delete unblocked.resolve;
          }
        }

        return Future.resolve(producer.value);
      }

      return new Future<T>((resolve) => {
        consumers.push(resolve);
      });
    },

    send(value) {
      const consumer = consumers.shift();
      if (consumer) {
        consumer(value);
        return Future.resolve<void>(undefined);
      }

      if (producers.length < capacity) {
        producers.push({ value });
        return Future.resolve<void>(undefined);
      }

      return new Future<void>((resolve) => {
        producers.push({
          value,
          resolve,
        });
      });
    },
  };
};

import { make } from './channel';
import { Future } from './Future';
import { go, run } from './runner';

describe('runner', () => {
  it('executes routines till done', () => {
    let uut = '';
    go(function* () {
      for (let i = 0; i < 3; ++i) {
        uut += 'A';
        yield;
      }
    });

    while (run()) {
      // Execute
    }

    expect(uut).toBe('AAA');
  });

  it('accepts args', () => {
    let uut = '';
    go(function* (arg) {
      for (let i = 0; i < 3; ++i) {
        uut += arg;
        yield;
      }
    }, 'A');

    while (run()) {
      // Execute
    }

    expect(uut).toBe('AAA');
  });

  describe('scheduling', () => {
    it('starts with newest', () => {
      let uut = '';
      go(function* () {
        uut += 'A';
      });
      go(function* () {
        uut += 'B';
      });

      while (run()) {
        // Execute
      }

      expect(uut).toBe('BA');
    });

    it('interleaves executions', () => {
      let uut = '';
      go(function* () {
        for (let i = 0; i < 3; ++i) {
          uut += 'A';
          yield;
        }
      });
      go(function* () {
        for (let i = 0; i < 3; ++i) {
          uut += 'B';
          yield;
        }
      });

      while (run()) {
        // Execute
      }

      expect(uut).toBe('BABABA');
    });
  });

  describe('futures', () => {
    it('waits for future', () => {
      const res = jest.fn();
      const fut = new Future(() => {
        // Ignore
      });

      go(function* () {
        yield fut;
        res();
      });

      while (run()) {
        // Execute
      }

      expect(res).toBeCalledTimes(0);
    });

    it('executes after future', () => {
      const res = jest.fn();
      const resolver = jest.fn();
      const fut = new Future((resolve) => resolver.mockImplementation(resolve));

      go(function* () {
        yield fut;
        res();
      });

      while (run()) {
        // Execute
      }

      resolver();

      while (run()) {
        // Execute
      }

      expect(res).toBeCalledTimes(1);
    });

    it('runs other routines', () => {
      let res = '';
      const resolver = jest.fn();
      const fut = new Future((resolve) => resolver.mockImplementation(resolve));

      go(function* () {
        res += 'A';
        yield* fut;
        res += 'A';
      });
      go(function* () {
        for (let i = 0; i < 3; ++i) {
          res += 'B';
          yield;
        }
      });

      while (run()) {
        // Execute
      }

      resolver();

      while (run()) {
        // Execute
      }

      expect(res).toBe('BABBA');
    });

    it('gets result from future', () => {
      let res = '';
      const resolver = jest.fn<void, [string]>();
      const fut = new Future<string>((resolve) =>
        resolver.mockImplementation(resolve)
      );

      go(function* () {
        res += yield* fut;
      });

      while (run()) {
        // Execute
      }

      resolver('F');

      while (run()) {
        // Execute
      }

      expect(res).toBe('F');
    });

    it('can be used as a simple sleep', () => {
      let res = '';
      let resolveSleep = () => {
        //Nothing
      };
      const sleepPromiseFactory = () =>
        new Future<void>((resolve) => {
          resolveSleep = () => {
            resolve();
            sleepPromise = sleepPromiseFactory();
          };
        });
      let sleepPromise = sleepPromiseFactory();
      const sleep = () => sleepPromise;

      go(function* () {
        for (;;) {
          yield sleep();
          res += 'A';
        }
      });

      while (run()) {
        // Execute
      }
      resolveSleep();
      while (run()) {
        // Execute
      }
      resolveSleep();
      while (run()) {
        // Execute
      }
      resolveSleep();
      while (run()) {
        // Execute
      }

      expect(res).toBe('AAA');
    });
  });

  describe('channels', () => {
    it('allows coroutine communication', () => {
      const channel = make<string>();
      const expectedMessages: string[] = ['A', 'B', 'C'];
      const receivedMessages: string[] = [];

      go(function* consumer() {
        while (receivedMessages.length < expectedMessages.length) {
          const message = yield* channel.get();
          receivedMessages.push(message);
        }
      });

      go(function* producer(messages) {
        for (const message of messages) {
          yield channel.send(message);
        }
      }, expectedMessages.slice(0));

      while (run()) {
        // Execute
      }

      expect(receivedMessages).toEqual(expectedMessages);
    });

    it('blocks producer until a consumer is ready', () => {
      const channel = make<string>();
      const fn = jest.fn();

      go(function* () {
        yield channel.send('data');
        fn();
      });

      while (run()) {
        // Execute
      }

      expect(fn).toBeCalledTimes(0);
    });

    it('blocks consumer until a producer is ready', () => {
      const channel = make<string>();
      const fn = jest.fn();

      go(function* () {
        yield channel.get();
        fn();
      });

      while (run()) {
        // Execute
      }

      expect(fn).toBeCalledTimes(0);
    });
  });
});
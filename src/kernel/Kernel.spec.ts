import { fork, hibernate, sleep } from 'kernel/sys-calls';
import { Kernel } from './Kernel';
import { Process, Thread } from './Process';
import { fakeROMFactory, SilentLogger } from 'test/utils';
import { RoundRobinScheduler } from './schedulers/RoundRobinScheduler';

describe('Kernel', () => {
  describe('init', () => {
    it('spawns Init', () => {
      const thread = jest.fn();
      class Init extends Process<undefined> {
        *run(): Thread {
          thread();
        }
      }
      const uut = new Kernel({
        Init,
        processes: [],
        rom: fakeROMFactory(),
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();

      expect(thread).toHaveBeenCalledTimes(1);
    });

    it('does not spawn multiple Init threads on reboot', () => {
      const thread = jest.fn();
      const rom = fakeROMFactory();
      class Init extends Process<undefined> {
        *run(): Thread {
          thread();
        }
      }
      const kernel = new Kernel({
        Init,
        processes: [],
        rom,
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });
      kernel.run();

      // Should not spawn Init, as Tron should exist.
      const uut = new Kernel({
        Init,
        processes: [],
        rom,
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });
      uut.run();

      expect(thread).toHaveBeenCalledTimes(1);
    });
  });

  describe('yield', () => {
    it('runs again after yielding', () => {
      const thread = jest.fn();
      class Init extends Process<undefined> {
        *run(): Thread {
          thread();
          yield;
          thread();
        }
      }
      const uut = new Kernel({
        Init,
        processes: [],
        rom: fakeROMFactory(),
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();

      expect(thread).toHaveBeenCalledTimes(2);
    });
  });

  describe('sleep', () => {
    it('sleeps till next run', () => {
      const thread = jest.fn();
      class Init extends Process<undefined> {
        *run(): Thread {
          thread();
          yield* sleep();
          thread();
        }
      }
      const uut = new Kernel({
        Init,
        processes: [],
        rom: fakeROMFactory(),
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();

      expect(thread).toHaveBeenCalledTimes(1);
    });
    it('sleeps till next run, and continues', () => {
      const thread = jest.fn();
      class Init extends Process<undefined> {
        *run(): Thread {
          thread(1);
          yield* sleep();
          thread(2);
        }
      }
      const uut = new Kernel({
        Init,
        processes: [],
        rom: fakeROMFactory(),
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();
      uut.run();

      expect(thread).toHaveBeenCalledTimes(2);
      expect(thread).toHaveBeenNthCalledWith(1, 1);
      expect(thread).toHaveBeenNthCalledWith(2, 2);
    });
  });

  describe('fork', () => {
    it('forks a child', () => {
      const thread = jest.fn();
      class Init extends Process<undefined> {
        *run(): Thread {
          yield* fork(Thread1, undefined);
          yield* hibernate();
        }
      }
      class Thread1 extends Process<undefined> {
        *run(): Thread {
          thread();
          yield* hibernate();
        }
      }
      const uut = new Kernel({
        Init,
        processes: [Thread1],
        rom: fakeROMFactory(),
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();
      uut.run();

      expect(thread).toHaveBeenCalledTimes(1);
    });
  });

  describe('children', () => {
    it('kills children when parent dies', () => {
      const thread = jest.fn();
      class Init extends Process<undefined> {
        *run(): Thread {
          yield* fork(Thread1, undefined);
          yield* sleep();
        }
      }
      class Thread1 extends Process<undefined> {
        *run(): Thread {
          yield* sleep();
          thread();
        }
      }
      const uut = new Kernel({
        Init,
        processes: [Thread1],
        rom: fakeROMFactory(),
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();
      uut.run();
      uut.run();

      expect(thread).not.toHaveBeenCalled();
    });
    it('should expose children pids', () => {
      const thread = jest.fn();
      class Init extends Process<undefined> {
        *run(): Thread {
          yield* fork(Thread1, undefined);
          yield* fork(Thread1, undefined);
          thread(this.children);
        }
      }
      class Thread1 extends Process<undefined> {
        *run(): Thread {
          yield* sleep();
        }
      }
      const uut = new Kernel({
        Init,
        processes: [Thread1],
        rom: fakeROMFactory(),
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();

      expect(thread).toHaveBeenCalledWith(Array(2).fill(expect.anything()));
    });
  });

  describe('memory', () => {
    it('persists across reboots', () => {
      const thread = jest.fn();
      const rom = fakeROMFactory();
      const expected = 42;
      class Init extends Process<undefined> {
        *run(): Thread {
          yield* fork(Thread1, {});
          yield* hibernate();
        }
      }
      class Thread1 extends Process<{ value?: number }> {
        *run(): Thread {
          if (this.memory.value) {
            thread(this.memory.value);
          }
          this.memory.value = expected;
          yield* hibernate();
        }
      }
      const kernel = new Kernel({
        Init,
        processes: [Thread1],
        rom,
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });
      kernel.run();
      kernel.run();

      const uut = new Kernel({
        Init,
        processes: [Thread1],
        rom,
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });
      uut.run();

      expect(thread).toHaveBeenCalledWith(expected);
    });
  });
});

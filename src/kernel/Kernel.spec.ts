/* eslint-disable require-yield */
import {
  fork,
  getChildren,
  hibernate,
  kill,
  Process,
  sleep,
  Thread,
} from 'system';
import { Kernel, PID } from './Kernel';
import { CallbackLogger, SilentLogger } from 'test/utils';
import { RoundRobinScheduler } from '../schedulers/RoundRobinScheduler';
import { mockGlobal } from 'screeps-jest';
import { registry } from 'processes';
jest.mock('processes');

const registerProcess = <Args extends JSONValue[]>(
  name: string,
  process: Process<Args>
) => {
  jest.mocked(registry)[name as keyof typeof registry] = jest
    .fn()
    .mockImplementation(process);
  return (...args: Args) => fork(name as never, ...args);
};

describe('Kernel', () => {
  const init = jest.fn<Thread, []>(function* () {
    // Do nothing
  });
  beforeEach(() => {
    mockGlobal<Game>('Game', {
      cpu: {
        getUsed: jest.fn().mockReturnValue(1),
      },
      time: 0,
    });
    jest.mocked(registry.init).mockImplementation(() => init());
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('init', () => {
    it('spawns init', () => {
      const thread = jest.fn();
      init.mockImplementation(function* () {
        thread();
      });
      const uut = new Kernel({
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();

      expect(thread).toHaveBeenCalledTimes(1);
    });

    it('does not spawn multiple init threads on reboot', () => {
      const thread = jest.fn();
      jest.mocked(registry.init).mockImplementation(function* () {
        thread();
      });

      const kernel = new Kernel({
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });
      kernel.run();

      // Should not spawn init, as tron should exist.
      const uut = new Kernel({
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });
      uut.run();

      expect(thread).toHaveBeenCalledTimes(1);
    });
  });

  describe('errors', () => {
    it('handles thread errors', () => {
      const logger = jest.fn();
      const expected = 'Error in thread';
      init.mockImplementation(function* () {
        throw new Error(expected);
      });

      const uut = new Kernel({
        loggerFactory: () => new CallbackLogger(logger),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();

      expect(
        logger.mock.calls
          .map(([message]) => message as string)
          .some((x) => x.includes(expected))
      ).toBe(true);
    });
  });

  describe('memory', () => {
    // it('persists across reboots', () => {
    //   const thread = jest.fn();
    //   const expected = 42;
    //   class Init extends Process {
    //     *run(): Thread {
    //       yield* fork(Thread1, {});
    //     }
    //   }
    //   class Thread1 extends Process<{ value?: number }> {
    //     *run(): Thread {
    //       if (this.memory.value) {
    //         thread(this.memory.value);
    //       }
    //       this.memory.value = expected;
    //       yield* hibernate();
    //     }
    //   }
    //   const kernel = new Kernel(Init, {
    //     processes: [Thread1],
    //     loggerFactory: () => new SilentLogger(''),
    //     scheduler: new RoundRobinScheduler(() => 1),
    //   });
    //   kernel.run();
    //   kernel.run();
    //   const uut = new Kernel(Init, {
    //     processes: [Thread1],
    //     loggerFactory: () => new SilentLogger(''),
    //     scheduler: new RoundRobinScheduler(() => 1),
    //   });
    //   uut.run();
    //   expect(thread).toHaveBeenCalledWith(expected);
    // });
  });

  describe('yield', () => {
    it('runs again after yielding', () => {
      const thread = jest.fn();
      init.mockImplementation(function* () {
        thread();
        yield;
        thread();
      });
      const uut = new Kernel({
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
      init.mockImplementation(function* () {
        thread();
        yield* sleep();
        thread();
      });
      const uut = new Kernel({
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();

      expect(thread).toHaveBeenCalledTimes(1);
    });
    it('continues', () => {
      const thread = jest.fn();
      init.mockImplementation(function* () {
        thread(1);
        yield* sleep();
        thread(2);
      });
      const uut = new Kernel({
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
      const forkTest1 = registerProcess('test1', function* () {
        thread();
        yield* hibernate();
      });
      init.mockImplementation(function* () {
        yield* forkTest1();
        yield* hibernate();
      });

      const uut = new Kernel({
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();
      uut.run();

      expect(thread).toHaveBeenCalledTimes(1);
    });
    describe('children', () => {
      it('kills children when parent dies', () => {
        const thread = jest.fn();
        const forkTest1 = registerProcess('test1', function* () {
          yield* sleep();
          thread();
          yield* hibernate();
        });
        init.mockImplementation(function* () {
          yield* forkTest1();
        });
        const uut = new Kernel({
          loggerFactory: () => new SilentLogger(''),
          scheduler: new RoundRobinScheduler(() => 1),
        });

        uut.run();
        uut.run();
        uut.run();

        expect(thread).toHaveBeenCalledTimes(0);
      });
      it('should return child pid', () => {
        const thread = jest.fn();
        const forkTest1 = registerProcess('test1', function* () {
          yield* hibernate();
        });
        init.mockImplementation(function* () {
          const pid = yield* forkTest1();
          thread(pid);
        });
        const uut = new Kernel({
          loggerFactory: () => new SilentLogger(''),
          scheduler: new RoundRobinScheduler(() => 1),
        });

        uut.run();

        expect(thread).toHaveBeenCalledWith(expect.any(Number));
      });
    });

    describe('kill', () => {
      it('kills a child', () => {
        const thread = jest.fn();
        const forkTest1 = registerProcess('test1', function* () {
          yield* hibernate();
        });
        init.mockImplementation(function* () {
          const pid = yield* forkTest1();
          yield* sleep();
          yield* kill(pid);
          const children = yield* getChildren();
          thread(Object.values(children).map(({ pid }) => pid));
        });
        const uut = new Kernel({
          loggerFactory: () => new SilentLogger(''),
          scheduler: new RoundRobinScheduler(() => 1),
        });

        uut.run();
        uut.run();

        expect(thread).toHaveBeenCalledWith([]);
      });
      it('cannot kill other processes', () => {
        let expected: PID = -1 as PID;
        const forkTest1 = registerProcess('test1', function* () {
          yield* hibernate();
        });
        const forkTest2 = registerProcess('test2', function* (pid: PID) {
          yield* kill(pid);
          yield* hibernate();
        });
        init.mockImplementation(function* () {
          expected = yield* forkTest1();
          yield* sleep();
          yield* forkTest2(expected);
          yield* hibernate();
        });
        const uut = new Kernel({
          loggerFactory: () => new SilentLogger(''),
          scheduler: new RoundRobinScheduler(() => 1),
        });

        uut.run();
        uut.run();
        uut.run();

        expect(uut.pids).toContain(expected);
      });
    });
  });
});

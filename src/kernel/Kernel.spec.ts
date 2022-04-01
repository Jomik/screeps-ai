/* eslint-disable require-yield */
import {
  fork,
  hibernate,
  kill,
  openFile,
  openSocket,
  read,
  sleep,
  write,
} from 'kernel/sys-calls';
import { Kernel, PID } from './Kernel';
import { Process, Thread } from './Process';
import { CallbackLogger, SilentLogger } from 'test/utils';
import { RoundRobinScheduler } from '../schedulers/RoundRobinScheduler';
import { mockGlobal } from 'screeps-jest';
import { FileOut, SocketOut } from './io';

describe('Kernel', () => {
  beforeEach(() => {
    mockGlobal<Game>('Game', {
      cpu: {
        getUsed: jest.fn().mockReturnValue(1),
      },
      time: 0,
    });
  });
  describe('init', () => {
    it('spawns Init', () => {
      const thread = jest.fn();
      class Init extends Process {
        *run(): Thread {
          thread();
        }
      }
      const uut = new Kernel(Init, {
        processes: [],
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();

      expect(thread).toHaveBeenCalledTimes(1);
    });

    it('does not spawn multiple Init threads on reboot', () => {
      const thread = jest.fn();
      class Init extends Process {
        *run(): Thread {
          thread();
        }
      }
      const kernel = new Kernel(Init, {
        processes: [],
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });
      kernel.run();

      // Should not spawn Init, as Tron should exist.
      const uut = new Kernel(Init, {
        processes: [],
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
      class Init extends Process {
        *run(): Thread {
          throw new Error(expected);
        }
      }

      const uut = new Kernel(Init, {
        processes: [],
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
    it('persists across reboots', () => {
      const thread = jest.fn();
      const expected = 42;
      class Init extends Process {
        *run(): Thread {
          yield* fork(Thread1, {});
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
      const kernel = new Kernel(Init, {
        processes: [Thread1],
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });
      kernel.run();
      kernel.run();

      const uut = new Kernel(Init, {
        processes: [Thread1],
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });
      uut.run();

      expect(thread).toHaveBeenCalledWith(expected);
    });
  });

  describe('yield', () => {
    it('runs again after yielding', () => {
      const thread = jest.fn();
      class Init extends Process {
        *run(): Thread {
          thread();
          yield;
          thread();
        }
      }
      const uut = new Kernel(Init, {
        processes: [],
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
      class Init extends Process {
        *run(): Thread {
          thread();
          yield* sleep();
          thread();
        }
      }
      const uut = new Kernel(Init, {
        processes: [],
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();

      expect(thread).toHaveBeenCalledTimes(1);
    });
    it('sleeps till next run, and continues', () => {
      const thread = jest.fn();
      class Init extends Process {
        *run(): Thread {
          thread(1);
          yield* sleep();
          thread(2);
        }
      }
      const uut = new Kernel(Init, {
        processes: [],
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
      class Init extends Process {
        *run(): Thread {
          yield* fork(Thread1, {});
        }
      }
      class Thread1 extends Process {
        *run(): Thread {
          thread();
          yield* hibernate();
        }
      }
      const uut = new Kernel(Init, {
        processes: [Thread1],
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();
      uut.run();

      expect(thread).toHaveBeenCalledTimes(1);
    });
    describe('children', () => {
      it('reparents children when parent die', () => {
        const thread = jest.fn();
        class Init extends Process {
          *run(): Thread {
            yield* fork(Thread1, {});
            yield* sleep();
          }
        }
        class Thread1 extends Process {
          *run(): Thread {
            yield* sleep();
            thread();
          }
        }
        const uut = new Kernel(Init, {
          processes: [Thread1],
          loggerFactory: () => new SilentLogger(''),
          scheduler: new RoundRobinScheduler(() => 1),
        });

        uut.run();
        uut.run();
        uut.run();

        expect(thread).toHaveBeenCalled();
      });
      it('should expose children pids', () => {
        const thread = jest.fn();
        class Init extends Process {
          *run(): Thread {
            yield* fork(Thread1, {});
            yield* fork(Thread1, {});
            thread(this.children);
          }
        }
        class Thread1 extends Process {
          *run(): Thread {
            yield* sleep();
          }
        }
        const uut = new Kernel(Init, {
          processes: [Thread1],
          loggerFactory: () => new SilentLogger(''),
          scheduler: new RoundRobinScheduler(() => 1),
        });

        uut.run();

        expect(thread).toHaveBeenCalledWith(Array(2).fill(expect.anything()));
      });
    });

    describe('kill', () => {
      it('kills a child', () => {
        const thread = jest.fn();
        class Init extends Process {
          *run(): Thread {
            yield* fork(Thread1, {});
            yield* sleep();
            yield* kill(this.children[0]?.pid ?? 0);
            thread(this.children);
          }
        }
        class Thread1 extends Process {
          *run(): Thread {
            yield* sleep();
          }
        }
        const uut = new Kernel(Init, {
          processes: [Thread1],
          loggerFactory: () => new SilentLogger(''),
          scheduler: new RoundRobinScheduler(() => 1),
        });

        uut.run();
        uut.run();
        uut.run();

        expect(thread).toHaveBeenCalledWith([]);
      });
      it('cannot kill other processes', () => {
        let expected: PID = -1;
        class Init extends Process {
          *run(): Thread {
            expected = yield* fork(Thread1, {});
            yield* sleep();
            yield* fork(Thread2, { pid: expected });
            yield* hibernate();
          }
        }
        class Thread1 extends Process {
          *run(): Thread {
            yield* hibernate();
          }
        }
        class Thread2 extends Process<{ pid: PID }> {
          *run(): Thread {
            yield* kill(this.memory.pid);
            yield* hibernate();
          }
        }
        const uut = new Kernel(Init, {
          processes: [Thread1, Thread2],
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

  describe('sockets', () => {
    it('communicates', () => {
      const init = jest.fn();
      const thread = jest.fn();
      const expected = 'message';
      class Init extends Process {
        *run(): Thread {
          const socket = yield* openSocket<string>('message');
          yield* fork(Thread1, { in: socket });
          yield* sleep();
          yield* write(socket, expected);
          yield* sleep();
          const data = yield* read(socket);
          init(...data);
        }
      }
      class Thread1 extends Process<{ in: SocketOut<string> }> {
        *run(): Thread {
          let message: [string, string] | [] = [];
          while ((message = yield* read(this.memory.in)).length === 0) {
            yield* sleep();
          }
          thread(...message);
        }
      }
      const uut = new Kernel(Init, {
        processes: [Thread1],
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();
      uut.run();
      uut.run();

      expect(thread).toHaveBeenCalledWith(expected, expect.anything());
      expect(init).toHaveBeenCalledWith();
    });
  });
  describe('files', () => {
    it('saves', () => {
      const init = jest.fn();
      const thread = jest.fn();
      const expected = 'data';
      class Init extends Process {
        *run(): Thread {
          const file = yield* openFile<string>('file');
          yield* fork(Thread1, { in: file });
          yield* sleep();
          yield* write(file, expected);
          yield* sleep();
          const data = yield* read(file);
          init(data);
        }
      }
      class Thread1 extends Process<{ in: FileOut<string> }> {
        *run(): Thread {
          let message: string | undefined = undefined;
          while (!(message = yield* read(this.memory.in))) {
            yield* sleep();
          }
          thread(message);
        }
      }
      const uut = new Kernel(Init, {
        processes: [Thread1],
        loggerFactory: () => new SilentLogger(''),
        scheduler: new RoundRobinScheduler(() => 1),
      });

      uut.run();
      uut.run();
      uut.run();

      expect(init).toHaveBeenCalledWith(expected);
      expect(thread).toHaveBeenCalledWith(expected);
    });
  });
});

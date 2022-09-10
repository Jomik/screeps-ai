import { Kernel, KernelLogger } from './Kernel';
import { PriorityScheduler } from './PriorityScheduler';
import { Priority } from './Scheduler';
import {
  createProcess,
  spawn,
  hibernate,
  kill,
  MemoryValue,
  PID,
  Process,
  requestPriority,
  sleep,
} from './system';

declare global {
  interface OSRegistry extends Record<string, Process<MemoryValue[]>> {}
}

const createKernel = <
  R extends Record<string, Process<never>> & { init: Process<[]> }
>(
  registry: R,
  data: Record<string, MemoryValue> = {}
) => {
  const clock = jest.fn<number, []>().mockReturnValue(1);
  const logger: Required<KernelLogger> = {
    onKernelError: jest.fn(),
    onProcessError: jest.fn(),
    onProcessExit: jest.fn(),
  };

  const kernel = new Kernel({
    registry: registry as never,
    scheduler: new PriorityScheduler(0 as Priority),
    clock,
    quota: jest.fn().mockReturnValue(1),
    getDataHandle: <T extends MemoryValue>(key: string, value: T) => {
      if (!(key in data)) {
        data[key] = value;
      }
      return {
        get() {
          return data[key] as T;
        },
        set(value) {
          return (data[key] = value);
        },
      };
    },
    logger,
  });

  return {
    run: () => {
      kernel.run();
      clock.mockReturnValue(clock() + 1);
    },
    logger,
    data,
    kernel,
  };
};

describe('Kernel', () => {
  describe('init', () => {
    it('spawns init', () => {
      const thread = jest.fn();
      const registry = {
        init: createProcess(function* () {
          thread();
          yield* hibernate();
        }),
      };

      const { run } = createKernel(registry);

      run();

      expect(thread).toHaveBeenCalledTimes(1);
    });
  });
  describe('error handling', () => {
    it('outputs thrown errors', () => {
      const registry = {
        init: createProcess(function* () {
          throw new Error('From thread');
        }),
      };

      const { run, logger } = createKernel(registry);

      run();

      expect(logger.onProcessError).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Error)
      );
    });
  });

  describe('yield', () => {
    it('runs again after yielding', () => {
      const thread = jest.fn();
      const registry = {
        init: createProcess(function* () {
          yield;
          thread();
          yield* hibernate();
        }),
      };

      const { run } = createKernel(registry);

      run();

      expect(thread).toHaveBeenCalledTimes(1);
    });
  });

  describe('sleep', () => {
    it('sleeps till next run', () => {
      const thread = jest.fn();
      const registry = {
        init: createProcess(function* () {
          thread();
          yield* sleep();
          thread();
          yield* hibernate();
        }),
      };

      const { run } = createKernel(registry);

      run();

      expect(thread).toHaveBeenCalledTimes(1);
    });
    it('continues after sleeping', () => {
      const thread = jest.fn();
      const registry = {
        init: createProcess(function* () {
          thread();
          yield* sleep();
          thread();
          yield* hibernate();
        }),
      };

      const { run } = createKernel(registry);

      run();
      run();

      expect(thread).toHaveBeenCalledTimes(2);
    });
  });

  describe('spawn', () => {
    it('forks a child', () => {
      const thread = jest.fn();
      const registry = {
        init: createProcess(function* () {
          yield* spawn('child');
          yield* hibernate();
        }),
        child: createProcess(function* () {
          thread();
          yield* hibernate();
        }),
      };

      const { run } = createKernel(registry);

      run();
      run();

      expect(thread).toHaveBeenCalledTimes(1);
    });
  });

  describe('priority', () => {
    it('allows changing priority', () => {
      const registry = {
        init: createProcess(function* () {
          yield* spawn('child');
          yield* hibernate();
        }),
        child: createProcess(function* () {
          yield* requestPriority(100 as Priority);
          yield* hibernate();
        }),
      };

      const { run, kernel } = createKernel(registry);

      run();
      run();

      const childInfo = kernel.ps().find(({ type }) => type === 'child');
      expect(childInfo?.priority).toBe(100);
    });
  });

  describe('children', () => {
    it('kills children when parent dies', () => {
      const thread = jest.fn();
      const registry = {
        init: createProcess(function* () {
          yield* spawn('child');
          yield* hibernate();
        }),
        child: createProcess(function* () {
          yield* spawn('grandChild');
          yield* sleep();
        }),
        grandChild: createProcess(function* () {
          thread();
          yield* hibernate();
        }),
      };

      const { run } = createKernel(registry);

      run();
      run();
      run();

      expect(thread).toHaveBeenCalledTimes(0);
    });
  });

  describe('kill', () => {
    it('can kill its child', () => {
      const thread = jest.fn();
      const registry = {
        init: createProcess(function* () {
          const pid = yield* spawn('child');
          yield* sleep(2);
          yield* kill(pid);
          yield* hibernate();
        }),
        child: createProcess(function* () {
          thread();
          yield* sleep();
          thread();
          yield* hibernate();
        }),
      };

      const { run } = createKernel(registry);

      run();
      run();
      run();

      expect(thread).toHaveBeenCalledTimes(1);
    });
    it('cannot kill others children', () => {
      const thread = jest.fn();
      const registry = {
        init: createProcess(function* () {
          yield* spawn('child1');
          yield* spawn('child2');
          yield* hibernate();
        }),
        child1: createProcess(function* () {
          yield* sleep(2);
          thread();
          yield* hibernate();
        }),
        child2: createProcess(function* (pid: PID) {
          yield* kill(pid);
          yield* hibernate();
        }),
      };

      const { run } = createKernel(registry);

      run();
      run();
      run();
      run();

      expect(thread).toHaveBeenCalledTimes(1);
    });
  });
});

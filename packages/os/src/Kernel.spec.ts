import { Kernel, KernelLogger } from './Kernel';
import { PriorityScheduler } from './PriorityScheduler';
import {
  createProcess,
  fork,
  hibernate,
  kill,
  MemoryValue,
  PID,
  Process,
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
  const clock = jest.fn().mockReturnValue(1);
  const logger: Required<KernelLogger> = {
    onKernelError: jest.fn(),
    onThreadError: jest.fn(),
    onThreadExit: jest.fn(),
  };

  const kernel = new Kernel({
    registry: registry as never,
    scheduler: new PriorityScheduler(0),
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

      expect(logger.onThreadError).toHaveBeenCalledWith(
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

  describe('fork', () => {
    it('forks a child', () => {
      const thread = jest.fn();
      const registry = {
        init: createProcess(function* () {
          yield* fork('child');
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

  describe('children', () => {
    it('kills children when parent dies', () => {
      const thread = jest.fn();
      const registry = {
        init: createProcess(function* () {
          yield* fork('child');
          yield* hibernate();
        }),
        child: createProcess(function* () {
          yield* fork('grandChild');
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
          const pid = yield* fork('child');
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
          yield* fork('child1');
          yield* fork('child2');
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

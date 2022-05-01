import { Scheduler } from './Scheduler';
import { PID } from './system';

export const schedulerSpec = (factory: () => Scheduler) => {
  describe('run', () => {
    let scheduler: Scheduler;
    let quota: jest.Mock<number, []>;

    beforeEach(() => {
      scheduler = factory();
      quota = jest.fn(() => 1);
    });

    it('yields nothing', () => {
      expect(scheduler.run(quota)).toMatchYieldsExactly([]);
    });

    it('yields added pid', () => {
      const expected = 1 as PID;
      scheduler.add(expected, scheduler.defaultPriority);

      const res = scheduler.run(quota).next(true);

      expect(res.value).toBe(expected);
    });

    it('yields till thread done', () => {
      const expected = 1 as PID;
      const scheduler = factory();
      scheduler.add(expected, scheduler.defaultPriority);
      expect(scheduler.run(quota)).toMatchYieldsExactly([
        [expected, true],
        [expected, true],
        [expected, false],
      ]);
    });
    it('yields till all done', () => {
      const first = 1 as PID;
      const second = 2 as PID;
      scheduler.add(first, 0);
      scheduler.add(second, 0);

      expect(scheduler.run(quota)).toMatchYieldsExactly([
        [expect.any(Number), true],
        [expect.any(Number), false],
        [expect.any(Number), true],
        [expect.any(Number), false],
      ]);
    });

    it('yields till quota used', () => {
      const expected = 1 as PID;
      const scheduler = factory();
      scheduler.add(expected, scheduler.defaultPriority);
      expect(scheduler.run(quota)).toMatchYieldsExactly([
        [expected, true],
        [expected, true],
        [
          expected,
          () => {
            quota.mockReturnValue(0);
            return true;
          },
        ],
      ]);
    });

    it('handles removing while running', () => {
      const expected = 1 as PID;
      const scheduler = factory();
      scheduler.add(expected, scheduler.defaultPriority);
      expect(scheduler.run(quota)).toMatchYieldsExactly([
        [expected, true],
        [
          expected,
          () => {
            scheduler.remove(expected);
            return true;
          },
        ],
      ]);
    });

    it('does not include added process', () => {
      const expected = 1 as PID;
      const added = 2 as PID;
      const scheduler = factory();
      scheduler.add(expected, scheduler.defaultPriority);
      expect(scheduler.run(quota)).toMatchYieldsExactly([
        [expected, true],
        [
          expected,
          () => {
            scheduler.add(added, scheduler.defaultPriority);
            return true;
          },
        ],
        [expected, false],
      ]);
    });
  });
};

describe('Scheduler', () => {
  it('should be used for all schedulers', () => {
    // Nothing to do here
  });
});

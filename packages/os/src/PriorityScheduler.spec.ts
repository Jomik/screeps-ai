import { PriorityScheduler } from './PriorityScheduler';
import { schedulerSpec } from './Scheduler.spec';
import { PID } from './system';

describe('PriorityScheduler', () => {
  schedulerSpec(() => new PriorityScheduler(0));
  describe('ordering', () => {
    let scheduler: PriorityScheduler;
    let quota: jest.Mock<number, []>;

    beforeEach(() => {
      scheduler = new PriorityScheduler(0);
      quota = jest.fn(() => 1);
    });
    it('yields highest priority', () => {
      const low = 1 as PID;
      const high = 2 as PID;
      scheduler.add(low, 0);
      scheduler.add(high, 10);

      expect(scheduler.run(quota)).toMatchYieldsExactly([
        [high, true],
        [high, true],
        [high, false],
        [low, true],
        [low, false],
      ]);
    });
  });
});

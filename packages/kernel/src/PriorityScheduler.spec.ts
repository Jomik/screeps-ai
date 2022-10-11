import { PriorityScheduler } from './PriorityScheduler';
import { Priority } from './Scheduler';
import { schedulerSpec } from './Scheduler.spec';
import { PID } from './system';

describe('PriorityScheduler', () => {
  schedulerSpec(() => new PriorityScheduler(99 as Priority));
  describe('ordering', () => {
    let scheduler: PriorityScheduler;
    let quota: jest.Mock<number, []>;

    beforeEach(() => {
      scheduler = new PriorityScheduler(99 as Priority);
      quota = jest.fn(() => 1);
    });
    it('yields highest priority', () => {
      const low = 1;
      const high = 2;
      scheduler.add(high, 0 as Priority);
      scheduler.add(low, 10 as Priority);

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

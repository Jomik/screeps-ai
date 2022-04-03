import { RoundRobinScheduler } from './RoundRobinScheduler';
import { ScheduleGenerator, Scheduler } from './Scheduler';
import { PID } from 'kernel';

describe('RoundRobinScheduler', () => {
  let quota: jest.Mock<number, []>;
  let scheduler: Scheduler;
  beforeEach(() => {
    quota = jest.fn<number, []>().mockReturnValue(1);
    scheduler = new RoundRobinScheduler(quota);
  });

  it('yields nothing', () => {
    expect(scheduler.run()).toMatchYieldsExactly<ScheduleGenerator>([]);
  });

  it('yields a pid', () => {
    const expected = 42 as PID;
    scheduler.add(expected);

    expect(scheduler.run()).toMatchYields<ScheduleGenerator>([
      [expected, undefined],
    ]);
  });
  it('yields until done', () => {
    const expected = 42 as PID;
    scheduler.add(expected);

    expect(scheduler.run()).toMatchYieldsExactly<ScheduleGenerator>([
      [expected, undefined],
      [expected, undefined],
      [
        expected,
        () => {
          scheduler.remove(expected);
          return undefined;
        },
      ],
    ]);
  });
  it('yields until no quota', () => {
    const expected = 42 as PID;
    scheduler.add(expected);

    expect(scheduler.run()).toMatchYieldsExactly<ScheduleGenerator>([
      [expected, undefined],
      [
        expected,
        () => {
          quota.mockReturnValue(0);
          return undefined;
        },
      ],
    ]);
  });
  it('yields round robin', () => {
    scheduler.add(0 as PID);
    scheduler.add(1 as PID);

    expect(scheduler.run()).toMatchYields<ScheduleGenerator>([
      [0 as PID, undefined],
      [1 as PID, undefined],
      [0 as PID, undefined],
      [1 as PID, undefined],
    ]);
  });
  it('handles removing while running', () => {
    scheduler.add(0 as PID);
    scheduler.add(1 as PID);

    expect(scheduler.run()).toMatchYields<ScheduleGenerator>([
      [0 as PID, undefined],
      [1 as PID, undefined],
      [
        0 as PID,
        () => {
          scheduler.remove(1 as PID);
          return undefined;
        },
      ],
      [0 as PID, undefined],
    ]);
  });
});

import { RoundRobinScheduler } from './RoundRobinScheduler';
import { ScheduleGenerator, Scheduler } from './Scheduler';

describe('RoundRobinScheduler', () => {
  let quota: jest.Mock<number, []>;
  let scheduler: Scheduler;
  beforeEach(() => {
    quota = jest.fn().mockReturnValue(1);
    scheduler = new RoundRobinScheduler(quota);
  });

  it('yields nothing', () => {
    expect(scheduler.run()).toMatchYieldsExactly<ScheduleGenerator>([]);
  });

  it('yields a pid', () => {
    const expected = 42;
    scheduler.add(expected);

    expect(scheduler.run()).toMatchYields<ScheduleGenerator>([
      [expected, undefined],
    ]);
  });
  it('yields until done', () => {
    const expected = 42;
    scheduler.add(expected);

    expect(scheduler.run()).toMatchYieldsExactly<ScheduleGenerator>([
      [expected, undefined],
      [expected, undefined],
      [expected, { type: 'done' }],
    ]);
  });
  it('yields until no quota', () => {
    const expected = 42;
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
    scheduler.add(0);
    scheduler.add(1);

    expect(scheduler.run()).toMatchYields<ScheduleGenerator>([
      [0, undefined],
      [1, undefined],
      [0, undefined],
      [1, undefined],
    ]);
  });
  it('handles removing while running', () => {
    scheduler.add(0);
    scheduler.add(1);

    expect(scheduler.run()).toMatchYields<ScheduleGenerator>([
      [0, undefined],
      [1, undefined],
      [
        0,
        () => {
          scheduler.remove(1);
          return undefined;
        },
      ],
      [0, undefined],
    ]);
  });
});

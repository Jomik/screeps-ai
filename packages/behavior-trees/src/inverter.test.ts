import { action } from './action';
import { inverter } from './inverter';
import { Status } from './node';
import { behaviorTree } from './tree';

describe('inverter', () => {
  it('keeps running', () => {
    const tree = behaviorTree(
      inverter(
        'i',
        action('a', () => Status.Running)
      )
    );

    expect(tree.tick()).toBe(Status.Running);
  });
  (
    [
      [Status.Success, Status.Failure],
      [Status.Failure, Status.Success],
    ] as [status: Status, expected: Status][]
  ).map(([status, expected]) =>
    it(`converts ${status} to ${expected}`, () => {
      const tree = behaviorTree(
        inverter(
          'i',
          action('a', () => status)
        )
      );

      expect(tree.tick()).toBe(expected);
    })
  );
});

import { action } from './action';
import { Status } from './node';
import { behaviorTree } from './tree';

describe('action', () => {
  it('executes function', () => {
    const act = jest.fn<Status, []>().mockReturnValue(Status.Success);
    const tree = behaviorTree(action('a', act));

    tree.tick();

    expect(act).toHaveBeenCalledTimes(1);
  });
});

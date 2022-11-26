import { NodeCreator, Status } from './node';
import { parallel } from './parallel';
import { behaviorTree } from './tree';
import { action as actualAction } from './action';

const action = (status: Status) => {
  const act = jest.fn<Status, []>().mockReturnValue(status);
  const res: NodeCreator & { act: typeof act } = actualAction(
    'test',
    act
  ) as never;
  res.act = act;
  return res;
};

describe('parallel', () => {
  it('runs both', () => {
    const a = action(Status.Running);
    const b = action(Status.Running);
    const tree = behaviorTree(parallel('par', [a, b]));

    tree.tick();

    expect(a.act).toHaveBeenCalledTimes(1);
    expect(b.act).toHaveBeenCalledTimes(1);
  });
});

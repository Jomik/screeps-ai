import { NodeCreator, Status } from './node';
import { sequence } from './sequence';
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

describe('sequence', () => {
  it('runs first child', () => {
    const a = action(Status.Success);
    const tree = behaviorTree(sequence('seq', [a]));

    tree.tick();

    expect(a.act).toHaveBeenCalledTimes(1);
  });
  it('continues to second', () => {
    const b = action(Status.Success);
    const tree = behaviorTree(sequence('seq', [action(Status.Success), b]));

    tree.tick();

    expect(b.act).toHaveBeenCalledTimes(1);
  });
  [Status.Running, Status.Failure].map((status) =>
    it(`stops at ${status}`, () => {
      const b = action(Status.Success);
      const tree = behaviorTree(sequence('seq', [action(status), b]));

      tree.tick();

      expect(b.act).toHaveBeenCalledTimes(0);
    })
  );
  it('pauses at running', () => {
    const a = action(Status.Success);
    const b = action(Status.Running);
    const c = action(Status.Success);
    const tree = behaviorTree(sequence('seq', [a, b, c]));

    tree.tick();
    tree.tick();

    expect(a.act).toHaveBeenCalledTimes(1);
    expect(b.act).toHaveBeenCalledTimes(2);
    expect(c.act).toHaveBeenCalledTimes(0);
  });
  it('restarts at failure', () => {
    const a = action(Status.Success);
    const tree = behaviorTree(sequence('seq', [a, action(Status.Failure)]));

    tree.tick();
    tree.tick();

    expect(a.act).toHaveBeenCalledTimes(2);
  });
  it('restarts at all success', () => {
    const a = action(Status.Success);
    const b = action(Status.Success);
    const tree = behaviorTree(sequence('seq', [a, b]));

    tree.tick();
    tree.tick();

    expect(a.act).toHaveBeenCalledTimes(2);
    expect(b.act).toHaveBeenCalledTimes(2);
  });
});

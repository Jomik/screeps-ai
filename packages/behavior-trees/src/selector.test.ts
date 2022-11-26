import { NodeCreator, Status } from './node';
import { behaviorTree } from './tree';
import { action as actualAction } from './action';
import { selector } from './selector';

const action = (status: Status) => {
  const act = jest.fn<Status, []>().mockReturnValue(status);
  const res: NodeCreator & { act: typeof act } = actualAction(
    'test',
    act
  ) as never;
  res.act = act;
  return res;
};

describe('selector', () => {
  it('runs first child', () => {
    const a = action(Status.Success);
    const tree = behaviorTree(selector('sel', [a]));

    tree.tick();

    expect(a.act).toHaveBeenCalledTimes(1);
  });
  [Status.Running, Status.Success].map((status) =>
    it(`stops at ${status}`, () => {
      const b = action(Status.Success);
      const tree = behaviorTree(selector('sel', [action(Status.Success), b]));

      tree.tick();

      expect(b.act).toHaveBeenCalledTimes(0);
    })
  );
  it('continues at failure', () => {
    const b = action(Status.Success);
    const tree = behaviorTree(selector('sel', [action(Status.Failure), b]));

    tree.tick();

    expect(b.act).toHaveBeenCalledTimes(1);
  });
  it('pauses at running', () => {
    const a = action(Status.Failure);
    const b = action(Status.Running);
    const c = action(Status.Success);
    const tree = behaviorTree(selector('sel', [a, b, c]));

    tree.tick();
    tree.tick();

    expect(a.act).toHaveBeenCalledTimes(1);
    expect(b.act).toHaveBeenCalledTimes(2);
    expect(c.act).toHaveBeenCalledTimes(0);
  });
  it('restarts at all failure', () => {
    const a = action(Status.Failure);
    const b = action(Status.Failure);
    const tree = behaviorTree(selector('sel', [a, b]));

    tree.tick();
    tree.tick();

    expect(a.act).toHaveBeenCalledTimes(2);
    expect(b.act).toHaveBeenCalledTimes(2);
  });
});

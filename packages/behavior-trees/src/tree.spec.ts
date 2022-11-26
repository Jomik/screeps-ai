import { action } from './action';
import { Status } from './node';
import { behaviorTree } from './tree';

describe('tree', () => {
  it('builds', () => {
    const tree = behaviorTree(action('action', () => Status.Success));
    expect(tree.tick()).toBe(Status.Success);
  });
});

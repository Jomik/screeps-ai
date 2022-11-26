import { Node, Status } from './node';

class ActionNode extends Node {
  constructor(name: string, private readonly fn: () => Status) {
    super(name);
  }

  public tick(): Status {
    return this.fn();
  }
}

export const action = (name: string, fn: () => Status) => () =>
  new ActionNode(name, fn);

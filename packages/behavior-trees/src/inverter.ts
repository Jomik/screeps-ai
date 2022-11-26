import { Node, NodeCreator, Status } from './node';

class InverterNode extends Node {
  constructor(name: string, private readonly node: Node) {
    super(name);
  }

  public tick(): Status {
    const res = this.node.tick();
    switch (res) {
      case Status.Success:
        return Status.Failure;
      case Status.Running:
        return Status.Running;
      case Status.Failure:
        return Status.Success;
    }
  }
}

export const inverter = (name: string, node: NodeCreator) => () =>
  new InverterNode(name, node());

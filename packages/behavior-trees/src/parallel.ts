import { Node, Status, NodeCreator } from './node';

class ParallelNode extends Node {
  private entries: [Node, Status][];

  constructor(name: string, nodes: Node[]) {
    super(name);
    this.entries = nodes.map((node) => [node, Status.Running]);
  }

  public tick(): Status {
    this.entries = this.entries.map(([node, status]) => {
      if (status !== Status.Running) {
        return [node, status];
      }
      return [node, node.tick()];
    });

    if (this.entries.some(([, status]) => status === Status.Running)) {
      return Status.Running;
    }

    if (this.entries.some(([, status]) => status === Status.Failure)) {
      return Status.Failure;
    }

    return Status.Success;
  }
}

export const parallel = (name: string, nodes: NodeCreator[]) => () =>
  new ParallelNode(
    name,
    nodes.map((c) => c())
  );

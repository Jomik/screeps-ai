import { Node, Status, NodeCreator } from './node';

class SequenceNode extends Node {
  private current = 0;

  constructor(name: string, private readonly children: Node[]) {
    super(name);
  }

  public tick(): Status {
    const result = this.children[this.current]?.tick();
    if (result === undefined) {
      throw new Error('Invalid child');
    }

    if (result === Status.Success) {
      this.current = (this.current + 1) % this.children.length;
      // this.children[this.current]?.reset();
      if (this.current === 0) {
        return Status.Success;
      }

      return this.tick();
    }

    if (result === Status.Failure) {
      // this.children[this.current]?.reset();
      this.current = 0;
    }

    return result;
  }
}

export const sequence = (name: string, children: NodeCreator[]) => () =>
  new SequenceNode(
    name,
    children.map((c) => c())
  );

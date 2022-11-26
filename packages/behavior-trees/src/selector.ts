import { Node, Status, NodeCreator } from './node';

class SelectorNode extends Node {
  private current = 0;

  constructor(name: string, private readonly children: Node[]) {
    super(name);
  }

  public tick(): Status {
    const result = this.children[this.current]?.tick();
    if (result === undefined) {
      throw new Error('Invalid child');
    }

    if (result === Status.Failure) {
      this.current = (this.current + 1) % this.children.length;
      // this.children[this.current]?.reset();
      if (this.current === 0) {
        return Status.Failure;
      }

      return this.tick();
    }

    if (result === Status.Success) {
      // this.children[this.current]?.reset();
      this.current = 0;
    }

    return result;
  }
}

export const selector = (name: string, children: NodeCreator[]) => () =>
  new SelectorNode(
    name,
    children.map((c) => c())
  );

import { Coordinates, coordinatesEquals, Edge } from './coordinates';

export class RegionNode {
  type?: 'choke' | 'region' = undefined;

  get id() {
    return this.coordinates.join(',');
  }

  private _children = new Map<string, RegionNode>();

  get size() {
    return this._children.size;
  }

  get children() {
    return this._children.values();
  }

  constructor(public coordinates: Coordinates) {}

  public add(node: RegionNode) {
    this._children.set(node.id, node);
  }
  public delete(node: RegionNode) {
    this._children.delete(node.id);
  }
}

export class RegionGraph {
  // private readonly adjacencyList: Map<string, Map<string, RegionNode>>;
  private readonly nodes = new Map<string, RegionNode>();
  constructor(edges: Edge[]) {
    edges.forEach((edge) => {
      if (coordinatesEquals(...edge)) {
        return;
      }
      this.addEdge(edge);
    });
  }

  public addEdge([p, q]: Edge) {
    const pNode = this.get(p);
    const qNode = this.get(q);
    pNode.add(qNode);
    qNode.add(pNode);
  }

  public get(p: Coordinates): RegionNode {
    const temp = new RegionNode(p);
    const node = this.nodes.get(temp.id) ?? temp;

    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, node);
    }

    return node;
  }

  public delete(p: Coordinates | RegionNode) {
    const node = p instanceof RegionNode ? p : this.get(p);
    this.nodes.delete(node.id);
    for (const child of node.children) {
      child.delete(node);
    }
  }

  *[Symbol.iterator](): IterableIterator<RegionNode> {
    for (const [, node] of this.nodes) {
      yield node;
    }
  }
}

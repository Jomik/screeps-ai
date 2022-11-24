/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import RBush, { BBox } from 'rbush';
import { Coordinates } from './coordinates';
import Queue from 'tinyqueue';

type Node<T> = (
  | {
      children: Node<T>[];
      height: number;
      leaf: false;
    }
  | {
      children: T[];
      height: number;
      leaf: true;
    }
) &
  BBox;

export class RTree extends RBush<Coordinates> {
  toBBox([x, y]: Coordinates) {
    return { minX: x, minY: y, maxX: x, maxY: y };
  }
  compareMinX([ax]: Coordinates, [bx]: Coordinates) {
    return ax - bx;
  }
  compareMinY([, ay]: Coordinates, [, by]: Coordinates) {
    return ay - by;
  }

  // TODO: Clean this up, probably recurse.
  public nearestNeighbour([x, y]: Coordinates): {
    point: Coordinates;
    distance: number;
  } | null {
    let node = (this as unknown as { data: Node<Coordinates> }).data;
    const queue = new Queue<
      { dist: number } & (
        | { node: Node<Coordinates>; isItem: false }
        | { node: Coordinates; isItem: true }
      )
    >([], (a, b) => a.dist - b.dist);

    // Yeah this is scary..
    for (;;) {
      if (node.leaf) {
        for (const child of node.children) {
          const dist = boxDist(x, y, this.toBBox(child));
          queue.push({
            dist,
            isItem: true,
            node: child,
          });
        }
      } else {
        for (const child of node.children) {
          const dist = boxDist(x, y, child);
          queue.push({
            dist,
            isItem: false,
            node: child,
          });
        }
      }
      const next = queue.pop();
      if (!next) {
        throw new Error('No item in queue');
      }
      if (next.isItem) {
        return { distance: next.dist, point: next.node };
      }
      node = next.node;
    }
  }
}

const boxDist = (x: number, y: number, box: BBox) => {
  const dx = axisDist(x, box.minX, box.maxX),
    dy = axisDist(y, box.minY, box.maxY);
  return dx * dx + dy * dy;
};

const axisDist = (k: number, min: number, max: number) => {
  return k < min ? min - k : k <= max ? 0 : k - max;
};

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import RBush, { BBox } from 'rbush';
import { Coordinates, Edge } from './coordinates';
import { createLogger } from './logger';

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

export class RTree extends RBush<Edge> {
  override toBBox([[px, py], [qx, qy]]: Edge) {
    return {
      minX: Math.min(px, qx),
      minY: Math.min(py, qy),
      maxX: Math.max(px, qx),
      maxY: Math.max(py, qy),
    };
  }
  override compareMinX([[a1], [a2]]: Edge, [[b1], [b2]]: Edge) {
    return Math.min(a1, a2) - Math.min(b1, b2);
  }
  override compareMinY([[, a1], [, a2]]: Edge, [[, b1], [, b2]]: Edge) {
    return Math.min(a1, a2) - Math.min(b1, b2);
  }

  // TODO: Clean this up, probably recurse.
  public nearestNeighbour([x, y]: Coordinates): {
    edge: Edge;
    distance: number;
  } | null {
    let node = (this as unknown as { data: Node<Edge> }).data;

    // Yeah this is scary..
    for (;;) {
      if (node.leaf) {
        let closest: Edge = [
          [Infinity, Infinity],
          [Infinity, Infinity],
        ];
        let closestDist = Infinity;
        for (const child of node.children) {
          const dist = boxDist(x, y, this.toBBox(child));
          if (dist < closestDist) {
            closest = child;
            closestDist = dist;
          }
        }
        return { edge: closest, distance: closestDist };
      }

      let closestDist = Infinity;
      for (const child of node.children) {
        const dist = boxDist(x, y, child);
        if (dist < closestDist) {
          node = child;
          closestDist = dist;
        }
      }
      if (closestDist === Infinity) {
        return null;
      }
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

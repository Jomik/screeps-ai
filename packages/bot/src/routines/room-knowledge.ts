import { SubRoutine } from 'coroutines';
import {
  CoordinateAdjacencyList,
  Coordinates,
  coordinatesEquals,
  CoordinateSet,
  createLogger,
  Edge,
} from '../library';
import { sleep } from '../library/sleep';
import { go } from '../runner';
import Delaunator from 'delaunator';
import { max } from '../utils';
import { getVoronoiEdges } from '../library/delaunay';
import { RTree } from '../library/rtree';
import { RegionGraph, RegionNode } from '../library/region-graph';

const MinDistanceToWall = 1;

const roundTo2Decimals = (num: number) =>
  Math.round((num + Number.EPSILON) * 100) / 100;

export const overlayRectangleArray = (
  costMatrix: RectangleArray,
  interpolate: (value: number) => number = (value) => value / 255
) => {
  const visual = new RoomVisual('dummy');

  for (let x = 0; x <= 49; ++x) {
    for (let y = 0; y <= 49; ++y) {
      const value = costMatrix.get(x, y);
      if (value === undefined || value === 0) {
        continue;
      }
      visual.text(value.toString(), x, y + 0.25);
      visual.rect(x - 0.5, y - 0.5, 1, 1, {
        fill: `hsl(${(1.0 - interpolate(value)) * 240}, 100%, 60%)`,
        opacity: 0.4,
      });
    }
  }
  const visuals = visual.export();
  visual.clear();

  return visuals;
};

class RectangleArray {
  constructor(
    public readonly width: number,
    public readonly height: number,
    private bits = new Int8Array(width * height)
  ) {}

  public set(x: number, y: number, val: number) {
    this.bits[x * 50 + y] = Math.min(Math.max(-128, val), 127);
  }

  public get(x: number, y: number): number | undefined {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return undefined;
    }
    return this.bits[x * 50 + y];
  }

  public clone(): RectangleArray {
    return new RectangleArray(
      this.width,
      this.height,
      new Int8Array(this.bits)
    );
  }
  public toCostMatrix(): CostMatrix {
    const cm = new PathFinder.CostMatrix() as CostMatrix & {
      _bits: Uint8Array;
    };
    cm._bits = new Uint8Array(this.bits);

    return cm;
  }
}

function collect<T>(generator: Generator<T, void, undefined>): T[] {
  const res: T[] = [];
  for (const next of generator) {
    res.push(next);
  }

  return res;
}

function* map<T, U>(
  values: T[],
  generator: (value: T) => SubRoutine<U>
): SubRoutine<U[]> {
  const res: U[] = [];
  for (const value of values) {
    res.push(yield* generator(value));
  }
  return res;
}

type Contour = Coordinates[];

const neighbourIndex: Coordinates[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

const translateInDirection = (
  [x, y]: Coordinates,
  direction: number
): Coordinates => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const [dx, dy] = neighbourIndex[direction % 8]!;
  return [x + dx, y + dy];
};

const logger = createLogger('room-knowledge');

const distanceFromPointToLine = (
  [x, y]: Coordinates,
  [[x1, y1], [x2, y2]]: Edge
): number =>
  Math.abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y)) /
  Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

const startDouglasPecker = (epsilon: number) =>
  function* douglasPecker(line: Coordinates[]): SubRoutine<Coordinates[]> {
    yield;
    const start = line[0];
    const end = line[line.length - 1];
    if (start === undefined || end === undefined) {
      logger.error('douglas pecker: undefined start or end');
      return [];
    }
    // Find the point with the maximum distance
    const maxPoint = max(line.slice(1, -1), (p) =>
      distanceFromPointToLine(p, [start, end])
    );
    // If max distance is greater than epsilon, recursively simplify
    // if (dmax > epsilon) {
    //     # Recursive call
    //     recResults1[] = DouglasPeucker(PointList[1...index], epsilon)
    //     recResults2[] = DouglasPeucker(PointList[index...end], epsilon)
    //     # Build the result list
    //     ResultList[] = {recResults1[1...length(recResults1) - 1], recResults2[1...length(recResults2)]}
    if (
      maxPoint !== null &&
      distanceFromPointToLine(maxPoint, [start, end]) > epsilon
    ) {
      const index = line.indexOf(maxPoint);
      const left = yield* douglasPecker(line.slice(0, index + 1));
      const right = yield* douglasPecker(line.slice(index));
      return left.slice(0, -1).concat(right);
    }
    // } else {
    //     ResultList[] = {PointList[1], PointList[end]}
    // }
    // # Return the result
    // return ResultList[]
    return [start, end];
  };

// Component labelling
const isRoomEdge = (x: number, y: number): boolean =>
  x === 0 || y === 0 || x === 49 || y === 49;
const isBlack = (x: number, y: number, terrain: RoomTerrain): boolean =>
  !!(terrain.get(x, y) & TERRAIN_MASK_WALL);
const isWhite = (x: number, y: number, terrain: RoomTerrain): boolean =>
  !isBlack(x, y, terrain);
const isOutOfBounds = (x: number, y: number): boolean =>
  x < 0 || x >= 50 || y < 0 || y >= 50;

const tracer = (
  origin: Coordinates,
  direction: number,
  terrain: RoomTerrain,
  labelMap: RectangleArray
): [direction: number, point: Coordinates] => {
  for (let i = 0; i < 7; ++i) {
    const point = translateInDirection(origin, direction + i);
    if (isOutOfBounds(...point)) {
      continue;
    }

    if (!isWhite(...point, terrain)) {
      return [direction + i, point];
    }
    labelMap.set(...point, -1);
  }
  return [-1, origin];
};

function* contourTracing(
  S: Coordinates,
  label: number,
  external: boolean,
  terrain: RoomTerrain,
  labelMap: RectangleArray
): SubRoutine<Contour> {
  const contour = [S];

  let direction = external ? 7 : 3;

  const [dx, T] = tracer(S, direction, terrain, labelMap);
  if (T === undefined || coordinatesEquals(S, T)) {
    return contour;
  }
  contour.push(T);

  let previous = T;
  // Position of previous for next search
  direction = dx + 4;

  for (;;) {
    yield;
    direction = (direction + 2) % 8;
    labelMap.set(...previous, label);
    const [dx, next] = tracer(previous, direction, terrain, labelMap);
    direction = dx + 4;
    if (coordinatesEquals(next, T) && coordinatesEquals(previous, S)) {
      break;
    }
    contour.push(next);
    previous = next;
  }
  return contour;
}

/**
 * https://www.iis.sinica.edu.tw/~fchang/paper/component_labeling_cviu.pdf
 */
function* labelComponents(
  terrain: RoomTerrain,
  labelMap: RectangleArray
): SubRoutine<Contour[]> {
  const contours: Contour[] = [];
  let C = 1;

  for (let y = 0; y < 49; ++y) {
    for (let x = 0; x < 49; ++x) {
      yield;
      if (isWhite(x, y, terrain)) {
        continue;
      }
      // P = [x,y]
      const labelP = labelMap.get(x, y) ?? 0;
      // Step 1
      if (labelP === 0 && isWhite(x, y - 1, terrain)) {
        // External contour
        labelMap.set(x, y, C);
        const contour = yield* contourTracing(
          [x, y],
          C,
          true,
          terrain,
          labelMap
        );
        contours.push(contour);
        ++C;
        // Step 2
      } else if (labelMap.get(x, y + 1) === 0 && isWhite(x, y + 1, terrain)) {
        if (labelP === 0) {
          // Internal contour
          const labelN = labelMap.get(x - 1, y) ?? 0;
          labelMap.set(x, y, labelN);
          const contour = yield* contourTracing(
            [x, y],
            labelN,
            false,
            terrain,
            labelMap
          );
          contours.push(contour);
        }
        // Step 3
      } else if (labelP === 0) {
        const labelN = labelMap.get(x - 1, y) ?? 0;
        labelMap.set(x, y, labelN);
      }
    }
  }
  return contours;
}

function* pruneMedials(graph: RegionGraph, rtree: RTree): SubRoutine<void> {
  const candidates = new Set(
    Array.from(graph).filter(({ size }) => size === 1)
  );
  for (const p of candidates) {
    yield;
    const dist = rtree.nearestNeighbour(p.coordinates)?.distance ?? 0;
    const [parent] = p.children;
    if (
      dist < MinDistanceToWall ||
      !parent ||
      dist <= (rtree.nearestNeighbour(parent.coordinates)?.distance ?? Infinity)
    ) {
      graph.delete(p);
      if (parent && parent.size === 1) {
        candidates.add(parent);
      }
    }
  }
}

function* identifyNodes(graph: RegionGraph, rtree: RTree): SubRoutine<void> {
  const visited = new Set<RegionNode>();
  const candidates = new Set(
    Array.from(graph).filter(({ size }) => size === 1)
  );
  for (const node of candidates) {
    yield;
    visited.add(node);

    for (const child of node.children) {
      if (!visited.has(child)) {
        candidates.add(child);
      }
    }

    if (node.size !== 2) {
      node.type = 'region';
      continue;
    }

    const nodeRadius = rtree.nearestNeighbour(node.coordinates)?.distance ?? 0;
    let isLocalMinima = true;
    let isLocalMaxima = true;
    let parentChoke: RegionNode | undefined = undefined;
    let parentChokeRadius = Infinity;
    let parentRegion: RegionNode | undefined = undefined;
    let parentRegionRadius = 0;

    for (const child of node.children) {
      const childRadius =
        rtree.nearestNeighbour(child.coordinates)?.distance ?? 0;
      if (childRadius < nodeRadius) {
        isLocalMinima = false;
      }
      if (childRadius > nodeRadius) {
        isLocalMaxima = false;
      }
      if (child.type === 'choke') {
        parentChoke = child;
        parentChokeRadius = Math.min(parentChokeRadius, childRadius);
      }
      if (child.type === 'region') {
        parentRegion = child;
        parentRegionRadius = Math.max(parentRegionRadius, childRadius);
      }
    }
    if (isLocalMinima) {
      node.type = 'choke';
      if (parentChoke) {
        if (parentChokeRadius < nodeRadius) {
          node.type = undefined;
        } else {
          parentChoke.type = undefined;
        }
      }
    } else if (isLocalMaxima) {
      node.type = 'region';
      if (parentRegion) {
        if (parentRegionRadius > nodeRadius) {
          node.type = undefined;
        } else {
          parentRegion.type = undefined;
        }
      }
    }
  }

  for (const node of graph) {
    if (!node.type) {
      graph.delete(node);
      if (node.size <= 1) {
        return;
      }
      const children = Array.from(node.children);
      const edges = children.slice(0, -1).map(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        (cur, i) => [cur.coordinates, children[i + 1]!.coordinates] as Edge
      );
      edges.forEach((edge) => graph.addEdge(edge));
    }
  }
}

export function* roomKnowledge(roomName: string) {
  const terrain = Game.map.getRoomTerrain(roomName);

  const labelMap = new RectangleArray(50, 50);

  // go(function* obstacleMap() {
  //   for (;;) {
  //     new RoomVisual(roomName).import(
  //       overlayRectangleArray(labelMap, (value) => value / 16)
  //     );
  //     yield sleep();
  //   }
  // });

  // TODO: Potentially simplify with douglas pecker
  const contours = yield* labelComponents(terrain, labelMap);

  go(function* contourVisuals() {
    const visuals = new RoomVisual('dummy');
    contours.forEach((c) => visuals.poly(c, { stroke: 'red' }));
    const exported = visuals.export();
    for (;;) {
      new RoomVisual(roomName).import(exported);
      yield sleep();
    }
  });

  const points = contours.flat();
  const delaunay = new Delaunator(new Uint8Array(points.flat()));
  yield;
  const edges = collect(getVoronoiEdges(points, delaunay))
    .map(([p, q]) => [p.map(roundTo2Decimals), q.map(roundTo2Decimals)] as Edge)
    .filter(
      ([p, q]) =>
        !(
          (labelMap.get(...(p.map(Math.round) as Coordinates)) ?? 0) > 0 ||
          (labelMap.get(...(q.map(Math.round) as Coordinates)) ?? 0) > 0
        )
    );
  yield;

  // go(function* voronoiVisuals() {
  //   const visuals = new RoomVisual('dummy');
  //   edges.forEach(([p, q]) => {
  //     visuals.line(...p, ...q, { opacity: 0.3 });
  //   });
  //   const exported = visuals.export();
  //   for (;;) {
  //     new RoomVisual(roomName).import(exported);
  //     yield sleep();
  //   }
  // });

  const graph = new RegionGraph(edges);
  yield;

  const rtree = new RTree();
  rtree.load(
    contours.flatMap((contour) =>
      // Since we skip the last element, this should be fine.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      contour.slice(0, -1).map((cur, i) => [cur, contour[i + 1]!])
    )
  );
  yield;

  go(function* visualiseGraph() {
    for (;;) {
      const visuals = new RoomVisual(roomName);

      const seen = new Set<RegionNode>();
      for (const node of graph) {
        seen.add(node);
        visuals.circle(...node.coordinates, {
          fill: {
            choke: 'red',
            region: 'green',
            unmarked: 'grey',
          }[node.type ?? 'unmarked'],
        });
        for (const n of node.children) {
          if (seen.has(n)) {
            continue;
          }
          visuals.line(...node.coordinates, ...n.coordinates, {
            color: 'blue',
            opacity: 1,
          });
        }
      }
      yield sleep();
    }
  });

  yield* pruneMedials(graph, rtree);

  yield* identifyNodes(graph, rtree);
}

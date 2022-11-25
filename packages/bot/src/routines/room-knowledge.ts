import { SubRoutine } from 'coroutines';
import Delaunator from 'delaunator';
import {
  Coordinates,
  coordinatesEquals,
  createLogger,
  Edge,
  getEdges,
  RectangleArray,
  RTree,
  sleep,
} from '../library';
import { RegionGraph, RegionNode } from '../library';
import { go } from '../runner';
import { clamp, max } from '../utils';

const MinDistanceToWall = 0;

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
        child.parent = node;
        candidates.add(child);
      }
    }

    if (node.size !== 2) {
      node.type = 'region';
      continue;
    }

    if (!node.parent) {
      logger.warn('node without parent');
      continue;
    }

    const nodeRadius = rtree.nearestNeighbour(node.coordinates)?.distance ?? 0;
    const parentRadius =
      rtree.nearestNeighbour(node.parent.coordinates)?.distance ?? 0;
    const localMinimal = [...node.children].every(
      (n) =>
        (rtree.nearestNeighbour(n.coordinates)?.distance ?? 0) >= nodeRadius
    );
    if (localMinimal) {
      if (node.parent.type !== 'region') {
        if (nodeRadius < parentRadius) {
          node.type = 'choke';
          node.parent.type = undefined;
        }
      } else {
        node.type = 'choke';
      }
    } else {
      const localMaximal = [...node.children].every(
        (n) =>
          (rtree.nearestNeighbour(n.coordinates)?.distance ?? 0) <= nodeRadius
      );
      if (localMaximal) {
        node.type = 'region';
      }
    }
  }
}

function* simplifyGraph(graph: RegionGraph, rtree: RTree): SubRoutine<void> {
  for (const node of graph) {
    yield;
    if (!node.type) {
      graph.delete(node);
      const children = Array.from(node.children);
      const [c1, c2] = children;
      if (children.length !== 2) {
        throw new Error(
          `Unmarked node with degree ${node.size}, ${node.coordinates.join(
            ','
          )}`
        );
      }
      if (c1 === undefined || c2 === undefined) {
        continue;
      }
      graph.addEdge([c1.coordinates, c2.coordinates]);
    }
  }

  for (const node of graph) {
    if (node.size === 1 && node.type === 'choke') {
      graph.delete(node);
    }
  }

  for (const node of graph) {
    if (node.type !== 'region') {
      continue;
    }
    const child = [...node.children].find(({ type }) => type === 'region');

    if (!child) {
      continue;
    }
    yield;
    const childRadius =
      rtree.nearestNeighbour(child.coordinates)?.distance ?? 0;
    const nodeRadius = rtree.nearestNeighbour(node.coordinates)?.distance ?? 0;
    if (childRadius > nodeRadius) {
      graph.delete(node);
      const children = Array.from(node.children);
      const edges = children
        .filter((c) => !coordinatesEquals(c.coordinates, child.coordinates))
        .map((c) => [child.coordinates, c.coordinates] as Edge);
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

  // go(function* contourVisuals() {
  //   const visuals = new RoomVisual('dummy');
  //   contours.forEach((c) => visuals.poly(c, { stroke: 'red' }));
  //   const exported = visuals.export();
  //   for (;;) {
  //     new RoomVisual(roomName).import(exported);
  //     yield sleep();
  //   }
  // });

  const points = contours.flatMap((c) => c.slice(0, -1));
  const delaunay = new Delaunator(new Uint8Array(points.flat()));
  yield;
  const edges = collect(getEdges(points, contours, delaunay))
    .map(
      ([p, q]) =>
        [
          p.map(clamp(0, 49)).map(roundTo2Decimals),
          q.map(clamp(0, 49)).map(roundTo2Decimals),
        ] as Edge
    )
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
  //     visuals.line(...p, ...q, { color: 'blue' });
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
  rtree.load(contours.flatMap((contour) => contour));
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

  // go(function* radiusVisuals() {
  //   for (;;) {
  //     yield sleep();
  //     const visuals = new RoomVisual(roomName);
  //     for (const p of graph) {
  //       const nearest = rtree.nearestNeighbour(p.coordinates);
  //       if (!nearest) {
  //         continue;
  //       }
  //       visuals.text(nearest.distance.toString(), ...p.coordinates);
  //       visuals.line(...p.coordinates, ...nearest.point);
  //     }
  //   }
  // });

  yield* identifyNodes(graph, rtree);
  yield;
  yield* simplifyGraph(graph, rtree);
}

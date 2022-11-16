import { SubRoutine } from 'coroutines';
import { Coordinates, coordinatesEquals, createLogger } from '../library';
import { sleep } from '../library/sleep';
import { go } from '../runner';

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

const isWhite = (x: number, y: number, terrain: RoomTerrain) =>
  !(terrain.get(x, y) & TERRAIN_MASK_WALL);
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

export function* roomKnowledge(roomName: string) {
  const terrain = Game.map.getRoomTerrain(roomName);

  const labelMap = new RectangleArray(50, 50);

  go(function* obstacleMap() {
    for (;;) {
      new RoomVisual(roomName).import(
        overlayRectangleArray(labelMap, (value) => value / 16)
      );
      yield sleep();
    }
  });

  const contours = yield* labelComponents(terrain, labelMap);
  logger.info(`done ${contours.length}`);
}

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

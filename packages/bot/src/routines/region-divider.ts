import { Routine } from 'coroutines';
import { createLogger, dist } from '../library';
import { sleep } from '../library/sleep';
import { overlayCostMatrix } from '../library/visualize-cost-matrix';
import { go } from '../runner';
import { isDefined } from '../utils';

const rounding = 10 ** 10;
const round = (num: number) =>
  Math.round((num + Number.EPSILON) * rounding) / rounding;

interface Vector {
  x: number;
  y: number;
}

interface RayCastResult {
  tile: Vector;
  intersection: Vector;
}

type Ray = RayCastResult[];

const logger = createLogger('region-divider');

/**
 * @param angle in degrees
 */
const angleToDirection = (angle: number): Vector => {
  const radians = angle * (Math.PI / 180);
  const sinTheta = Math.sin(radians);
  const cosTheta = Math.cos(radians);

  return { x: -sinTheta, y: cosTheta };
};

function collect<T>(generator: Generator<T, void, undefined>): T[] {
  const res: T[] = [];
  for (const next of generator) {
    res.push(next);
  }

  return res;
}

/**
 * https://github.com/Guillaume-Docquier/Sajuuk-SC2/blob/master/Bot/RayCasting.cs
 * @param angle in degrees
 */
function* castRay(
  terrain: RoomTerrain,
  origin: Vector,
  angle: number
): Generator<RayCastResult, void, undefined> {
  const { x: dx, y: dy } = angleToDirection(angle);
  const dxdy = dy == 0 ? 0 : dx / dy;
  const dydx = dx == 0 ? 0 : dy / dx;

  // If delta X is 0, we set the rayLength to a big one so that the Y ray is always chosen (we're moving straight up or straight down)
  const rayLengthWhenMovingInX =
    dx !== 0 ? round(Math.sqrt(1 + dydx * dydx)) : 50;

  // If delta Y is 0, we set the rayLength to a big one so that the X ray is always chosen (we're moving straight left or straight right)
  const rayLengthWhenMovingInY =
    dy !== 0 ? round(Math.sqrt(1 + dxdy * dxdy)) : 50;

  // Edge case, if deltaX is 0, stepXDistance can be 0, making the first ray 0, thus it's going to be picked
  // We want to avoid that so we set it to 1
  let stepX = 1;
  let stepXDistance = 1;
  if (dx > 0) {
    // Moving right
    stepX = 1;
    stepXDistance = 0.5;
  } else if (dx < 0) {
    // Moving left
    stepX = -1;
    stepXDistance = 0.5;
  }

  // Edge case, if deltaY is 0, stepYDistance can be 0, making the first ray 0, thus it's going to be picked
  // We want to avoid that so we set it to 1
  let stepY = 1;
  let stepYDistance = 1;
  if (dy > 0) {
    // Moving down
    stepY = 1;
    stepYDistance = 0.5;
  } else if (dy < 0) {
    // Moving up
    stepY = -1;
    stepYDistance = 0.5;
  }

  let xRayLength = round(rayLengthWhenMovingInX * stepXDistance);
  let yRayLength = round(rayLengthWhenMovingInY * stepYDistance);

  yield {
    tile: origin,
    intersection: { x: origin.x, y: origin.y },
  };
  let currentX = origin.x;
  let currentY = origin.y;
  let lastIntersectionX = origin.x;
  let lastIntersectionY = origin.y;
  while (
    currentX > 0 &&
    currentX < 49 &&
    currentY > 0 &&
    currentY < 49 &&
    !(terrain.get(currentX, currentY) & TERRAIN_MASK_WALL)
  ) {
    if (xRayLength < yRayLength) {
      // Step in X, reduce Y ray
      yRayLength -= xRayLength;

      // Move to the cell on the left or right
      currentX += stepX;
      lastIntersectionX += dx * xRayLength;
      lastIntersectionY += dy * xRayLength;

      // Reset X ray
      xRayLength = rayLengthWhenMovingInX;
    } else if (yRayLength < xRayLength) {
      // Step in Y, reduce X ray
      xRayLength -= yRayLength;

      // Move to the cell on the bottom or top
      currentY += stepY;
      lastIntersectionX += dx * yRayLength;
      lastIntersectionY += dy * yRayLength;

      // Reset Y ray
      yRayLength = rayLengthWhenMovingInY;
    } else {
      // Both rays are the same, means we landed exactly on a corner
      currentX += stepX; // Move to the left/right
      currentY += stepY; // And up/down

      // xRayLength and yRayLength are the same, doesn't matter which one we pick
      lastIntersectionX += dx * yRayLength;
      lastIntersectionY += dy * yRayLength;

      // Reset all rays
      xRayLength = rayLengthWhenMovingInX;
      yRayLength = rayLengthWhenMovingInY;
    }

    yield {
      tile: { x: currentX, y: currentY },
      intersection: { x: lastIntersectionX, y: lastIntersectionY },
    };
  }
}

const getVisionLine = (terrain: RoomTerrain, origin: Vector, angle: number) => {
  const ray1 = collect(castRay(terrain, origin, angle));
  const ray2 = collect(castRay(terrain, origin, angle + 180));
  return [...ray1].reverse().concat(ray2.slice(1));
};

const isTileExit = (terrain: RoomTerrain, { x, y }: Vector) =>
  (x === 0 || y === 0 || x === 49 || y === 49) &&
  !(terrain.get(x, y) & TERRAIN_MASK_WALL);

const getLineLength = (
  terrain: RoomTerrain,
  line: RayCastResult[],
  exitDistance = Infinity
): number => {
  const start = line[0];
  const end = line[line.length - 1];
  if (!isDefined(start) || !isDefined(end)) {
    return 0;
  }

  const d = dist([start.tile.x, start.tile.y], [end.tile.x, end.tile.y]);
  if (isTileExit(terrain, end.tile) || isTileExit(terrain, start.tile)) {
    return Math.max(d, exitDistance);
  }
  return d;
};

export function* regionDivider(roomName: string): Routine {
  const terrain = Game.map.getRoomTerrain(roomName);
  const allWalkableTiles: Vector[] = [];
  for (let y = 1; y < 49; ++y) {
    for (let x = 1; x < 49; ++x) {
      if (!(terrain.get(x, y) & TERRAIN_MASK_WALL)) {
        allWalkableTiles.push({ x, y });
      }
    }
  }
  yield;

  const scores = new PathFinder.CostMatrix();
  go(function* currentVisual() {
    for (;;) {
      new RoomVisual(roomName).import(
        overlayCostMatrix(scores, (value) => value / 30)
      );

      yield sleep();
    }
  });

  for (const origin of allWalkableTiles) {
    const interval = 10;
    for (let degrees = 0; degrees < 175; degrees += interval) {
      const potentialChoke = getVisionLine(terrain, origin, degrees);
      const chokeLength = getLineLength(terrain, potentialChoke);
      if (chokeLength === Infinity) {
        continue;
      }

      const perpendicularDegrees = (degrees + 90) % 180;
      const perpendicularLine1 = collect(
        castRay(terrain, origin, perpendicularDegrees)
      );
      const perpendicularLine2 = collect(
        castRay(terrain, origin, perpendicularDegrees + 180)
      );

      const perpendicularLine1Length = getLineLength(
        terrain,
        perpendicularLine1,
        10
      );
      const perpendicularLine2Length = getLineLength(
        terrain,
        perpendicularLine2,
        10
      );

      const shortestHalfDistance = Math.min(
        perpendicularLine1Length,
        perpendicularLine2Length
      );
      const clampedHalfDistance = Math.min(Infinity, shortestHalfDistance);

      const score =
        chokeLength === 0 ? 0 : (clampedHalfDistance / chokeLength) * 2;
      scores.set(
        origin.x,
        origin.y,
        Math.max(scores.get(origin.x, origin.y), Math.min(score ** 2, 30))
      );
      yield;
    }
  }

  // logger.info(`done ${rays.length}`);
}

const getVisuals = (rays: Ray[]): string => {
  const visuals = new RoomVisual();
  for (const ray of rays) {
    const start = ray[0];
    const end = ray[ray.length - 1];
    if (start === undefined || end === undefined) {
      continue;
    }
    visuals.line(
      start.intersection.x,
      start.intersection.y,
      end.intersection.x,
      end.intersection.y,
      {
        color: 'green',
        opacity: 0.5,
      }
    );
    visuals.rect(end.tile.x - 0.5, end.tile.y - 0.5, 1, 1, {
      stroke: 'red',
      fill: 'transparent',
      opacity: 1,
    });
    ray.forEach(({ tile: { x, y } }) =>
      visuals.rect(x - 0.5, y - 0.5, 1, 1, {
        fill: 'transparent',
        stroke: 'blue',
      })
    );
    ray.forEach(({ intersection: { x, y } }) =>
      visuals.circle(x, y, { radius: 0.1, stroke: 'blue' })
    );
  }
  const res = visuals.export();
  visuals.clear();
  return res;
};

import { Routine, SubRoutine } from 'coroutines';
import { createLogger } from '../library';
import { sleep } from '../library/sleep';
import { go } from '../runner';

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

function* collect<T>(
  generator: Generator<T, void, undefined>
): SubRoutine<T[]> {
  const res: T[] = [];
  for (const next of generator) {
    res.push(next);
    yield;
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

export function* regionDivider(roomName: string): Routine {
  const terrain = Game.map.getRoomTerrain(roomName);
  const allWalkableTiles: Vector[] = [];
  for (let y = 0; y < 49; ++y) {
    for (let x = 0; x < 49; ++x) {
      if (!(terrain.get(x, y) & TERRAIN_MASK_WALL)) {
        allWalkableTiles.push({ x, y });
      }
    }
  }
  yield;

  let visuals = '';
  go(function* rayVisuals() {
    for (;;) {
      new RoomVisual(roomName).import(visuals);
      yield sleep();
    }
  });

  for (const origin of allWalkableTiles) {
    const rays: Ray[] = [];
    const interval = 5;
    for (let degrees = 0; degrees < 360; degrees += interval) {
      const ray = yield* collect(castRay(terrain, origin, degrees));
      rays.push(ray);
    }
    visuals = getVisuals(rays);
    yield sleep();
  }
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
    // ray.forEach(({ tile: { x, y } }) =>
    //   visuals.rect(x - 0.5, y - 0.5, 1, 1, {
    //     fill: 'transparent',
    //     stroke: 'blue',
    //   })
    // );
    // ray.forEach(({ intersection: { x, y } }) =>
    //   visuals.circle(x, y, { radius: 0.1, stroke: 'blue' })
    // );
  }
  const res = visuals.export();
  visuals.clear();
  return res;
};

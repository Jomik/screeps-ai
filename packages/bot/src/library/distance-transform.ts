import { Thread } from 'kernel';

// prettier-ignore
const forwardMask = [
    [-1,-1], [0,-1], [1,-1],
    [-1,0], /*[0,0],*/ /*[1,0],*/
    [-1,1], /*[0,1],*/ /*[1,1],*/
  ] as const;
// prettier-ignore
const backwardMask = [
    /*[-1,-1],*/ /*[0,-1],*/ [1,-1],
    /*[-1,0],*/ /*[0,0],*/ [1,0],
    [-1,1], [0,1], [1,1],
  ] as const;

const updateCM = (
  x: number,
  y: number,
  costMatrix: CostMatrix,
  mask: ReadonlyArray<readonly [number, number]>
) => {
  const neighbours = mask.map(
    ([dx, dy]) => costMatrix.get(x + dx, y + dy) ?? 0
  );
  costMatrix.set(
    x,
    y,
    Math.min(Math.min(...neighbours) + 1, costMatrix.get(x, y) ?? 0)
  );
};

export function* distanceTransform(
  bounds: { x: [number, number]; y: [number, number] },
  base: CostMatrix
): Thread<CostMatrix> {
  const {
    x: [xMin, xMax],
    y: [yMin, yMax],
  } = bounds;

  const costMatrix = base.clone();
  yield;

  for (let x = xMin; x <= xMax; ++x) {
    for (let y = yMin; y <= yMax; ++y) {
      updateCM(x, y, costMatrix, forwardMask);
    }
  }
  yield;

  for (let x = xMax; x >= xMin; --x) {
    for (let y = yMax; y >= yMin; --y) {
      updateCM(x, y, costMatrix, backwardMask);
    }
  }

  return costMatrix;
}

/**
 * Convert a plan from https://screeps.admon.dev/building-planner
 * to a 2d matrix
 */
const plan = {};

const xCoordinates = Object.values(plan.buildings)
  .flatMap((x) => x.pos)
  .map(({ x }) => x);
const minX = Math.min(...xCoordinates);
const maxX = Math.max(...xCoordinates);
const width = maxX - minX + 1;

const yCoordinates = Object.values(plan.buildings)
  .flatMap(({ pos }) => pos)
  .map(({ y }) => y);
const minY = Math.min(...yCoordinates);
const maxY = Math.max(...yCoordinates);
const height = maxY - minY + 1;

console.log({ width, height });

const matrix = Array.from({ length: height }, () =>
  Array.from({ length: width }, () => null)
);

for (const [structureType, { pos }] of Object.entries(plan.buildings)) {
  for (const { x, y } of pos) {
    // @ts-ignore
    matrix[y - minY][x - minX] = `STRUCTURE_${structureType.toUpperCase()}`;
  }
}

console.log(JSON.stringify(matrix).replace(/"/g, ''));

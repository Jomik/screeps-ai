export type Coordinates = [x: number, y: number];
export const coordinatesEquals = (a: Coordinates, b: Coordinates): boolean =>
  a[0] === b[0] && a[1] === b[1];

export const coordinatesToNumber = ([x, y]: Coordinates): number => x + y * 50;
export const numberToCoordinates = (coordinates: number): Coordinates => {
  const x = coordinates % 50;
  return [x, (coordinates - x) / 50];
};

export const dist = ([ax, ay]: Coordinates, [bx, by]: Coordinates): number =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

// prettier-ignore
const outline = [
  [1,1], [0,1], [-1,1],
  [1,0], /*[0,0],*/ [-1,0],
  [1,-1], [0,-1], [-1,-1],
] as const;

const corners = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
] as const;
// prettier-ignore
const ortogonal = [
  /*[1,1],*/ [0,1], /*[-1,1],*/
  [1,0], /*[0,0],*/ [-1,0],
  /*[1,-1],*/ [0,-1], /*[-1,-1],*/
] as const;

export const expandPosition = (pos: Coordinates): Coordinates[] =>
  outline
    .map<Coordinates>(([x, y]) => [x + pos[0], y + pos[1]])
    .filter(([x, y]) => x >= 0 && x <= 49 && y >= 0 && y <= 49);
export const expandOrtogonally = (pos: Coordinates): Coordinates[] =>
  ortogonal
    .map<Coordinates>(([x, y]) => [x + pos[0], y + pos[1]])
    .filter(([x, y]) => x >= 0 && x <= 49 && y >= 0 && y <= 49);
export const expandCorners = (pos: Coordinates): Coordinates[] =>
  corners
    .map<Coordinates>(([x, y]) => [x + pos[0], y + pos[1]])
    .filter(([x, y]) => x >= 0 && x <= 49 && y >= 0 && y <= 49);

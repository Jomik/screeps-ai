import Delaunator from 'delaunator';
import { Coordinates } from './coordinates';

const circumcenter = (
  a: Coordinates,
  b: Coordinates,
  c: Coordinates
): Coordinates => {
  const ad = a[0] * a[0] + a[1] * a[1];
  const bd = b[0] * b[0] + b[1] * b[1];
  const cd = c[0] * c[0] + c[1] * c[1];
  const D =
    2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  return [
    (1 / D) * (ad * (b[1] - c[1]) + bd * (c[1] - a[1]) + cd * (a[1] - b[1])),
    (1 / D) * (ad * (c[0] - b[0]) + bd * (a[0] - c[0]) + cd * (b[0] - a[0])),
  ];
};
const edgesOfTriangle = (t: number): [number, number, number] => {
  return [3 * t, 3 * t + 1, 3 * t + 2];
};
const pointsOfTriangle = (
  delaunay: Delaunator<unknown>,
  t: number
): [number, number, number] => {
  return edgesOfTriangle(t).map((e) => delaunay.triangles[e]) as [
    number,
    number,
    number
  ];
};

const triangleCenter = (
  points: Coordinates[],
  delaunay: Delaunator<unknown>,
  t: number
): Coordinates => {
  const vertices = pointsOfTriangle(delaunay, t).map((p) => points[p]) as [
    Coordinates,
    Coordinates,
    Coordinates
  ];
  return circumcenter(vertices[0], vertices[1], vertices[2]);
};

const triangleOfEdge = (e: number): number => {
  return Math.floor(e / 3);
};

export function* getVoronoiEdges(
  points: Coordinates[],
  delaunay: Delaunator<unknown>
): Generator<[p: Coordinates, q: Coordinates], void, undefined> {
  for (let e = 0; e < delaunay.triangles.length; e++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (e < delaunay.halfedges[e]!) {
      const p = triangleCenter(points, delaunay, triangleOfEdge(e));
      const q = triangleCenter(
        points,
        delaunay,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        triangleOfEdge(delaunay.halfedges[e]!)
      );
      yield [p, q];
    }
  }
}

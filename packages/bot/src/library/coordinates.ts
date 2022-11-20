export type Coordinates = [x: number, y: number];
export const coordinatesEquals = (a: Coordinates, b: Coordinates): boolean =>
  a[0] === b[0] && a[1] === b[1];

export type Edge = [p: Coordinates, q: Coordinates];

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

export class CoordinateSet {
  constructor(private backingSet = new Set<string>()) {}

  public add(p: Coordinates): CoordinateSet {
    this.backingSet.add(this.hash(p));
    return this;
  }
  public delete(p: Coordinates): boolean {
    return this.backingSet.delete(this.hash(p));
  }
  public has(p: Coordinates): boolean {
    return this.backingSet.has(this.hash(p));
  }

  public static from(coordinates: Coordinates[]): CoordinateSet {
    return new CoordinateSet(new Set(coordinates.map((p) => this.hash(p))));
  }

  public get size(): number {
    return this.backingSet.size;
  }

  private static hash(p: Coordinates): string {
    return p.join(',');
  }
  private hash(p: Coordinates): string {
    return CoordinateSet.hash(p);
  }

  private unhash(p: string): Coordinates {
    return p.split(',').map(Number.parseFloat) as Coordinates;
  }

  *[Symbol.iterator](): IterableIterator<Coordinates> {
    for (const point of this.backingSet) {
      yield this.unhash(point);
    }
  }
}

export class CoordinateAdjacencyList {
  private adjacencyList = new Map<string, CoordinateSet>();

  constructor(edges: Edge[]) {
    edges.forEach((edge) => {
      if (coordinatesEquals(...edge)) {
        return;
      }
      this.addEdge(edge);
    });
  }

  *[Symbol.iterator](): IterableIterator<
    [origin: Coordinates, neighbours: CoordinateSet]
  > {
    for (const [origin, neighbours] of this.adjacencyList) {
      yield [this.unhash(origin), neighbours];
    }
  }

  public addEdge([p, q]: Edge): CoordinateAdjacencyList {
    this.get(p).add(q);
    this.get(q).add(p);
    return this;
  }

  public delete(p: Coordinates): CoordinateAdjacencyList {
    const neighbours = this.get(p);
    this.adjacencyList.delete(this.hash(p));
    for (const n of neighbours) {
      this.get(n)?.delete(p);
    }

    return this;
  }

  private hash(p: Coordinates): string {
    return p.join(',');
  }

  private unhash(p: string): Coordinates {
    return p.split(',').map(Number.parseFloat) as Coordinates;
  }

  public get(p: Coordinates): CoordinateSet {
    const hash = this.hash(p);
    const set = this.adjacencyList.get(hash) ?? new CoordinateSet();
    if (!this.adjacencyList.has(hash)) {
      this.adjacencyList.set(hash, set);
    }
    return set;
  }
}

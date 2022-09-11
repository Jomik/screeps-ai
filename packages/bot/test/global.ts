declare const global: Record<string, any>;

class CostMatrix {
  constructor(public _bits = new Uint8Array(2500)) {}

  public set(xx: number, yy: number, val: number) {
    xx = xx | 0;
    yy = yy | 0;
    this._bits[xx * 50 + yy] = Math.min(Math.max(0, val), 255);
  }

  public get(xx: number, yy: number): number | undefined {
    xx = xx | 0;
    yy = yy | 0;
    return this._bits[xx * 50 + yy];
  }

  public clone(): CostMatrix {
    return new CostMatrix(new Uint8Array(this._bits));
  }

  public serialize(): number[] {
    return Array.prototype.slice.apply(
      new Uint32Array(this._bits.buffer)
    ) as number[];
  }

  public deserialize(data: number[]): CostMatrix {
    return new CostMatrix(new Uint8Array(new Uint32Array(data).buffer));
  }
}

global.PathFinder = {
  CostMatrix: CostMatrix,
};

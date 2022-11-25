export class RectangleArray {
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

export const overlayCostMatrix = (
  costMatrix: CostMatrix,
  interpolate: (value: number) => number = (value) => value / 255
) => {
  const visual = new RoomVisual('dummy');

  for (let x = 0; x <= 49; ++x) {
    for (let y = 0; y <= 49; ++y) {
      const value = costMatrix.get(x, y);
      if (value === 0) {
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

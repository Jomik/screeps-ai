export const rotateClockWise = <T>(matrix: T[][], empty: T): T[][] =>
  matrix[0]?.map((_, index) =>
    matrix.map((row) => row[index] ?? empty).reverse()
  ) ?? [];

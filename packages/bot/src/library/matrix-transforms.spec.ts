import { rotateClockWise } from './matrix-transforms';

describe('matrix transforms', () => {
  describe('rotate', () => {
    it('rotates a NxN matrix clockwise', () => {
      const uut = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];
      const expected = [
        [7, 4, 1],
        [8, 5, 2],
        [9, 6, 3],
      ];

      expect(rotateClockWise(uut, undefined)).toEqual(expected);
    });
    it('rotates a NxM matrix clockwise', () => {
      const uut = [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
      ];
      const expected = [
        [9, 5, 1],
        [10, 6, 2],
        [11, 7, 3],
        [12, 8, 4],
      ];

      expect(rotateClockWise(uut, undefined)).toEqual(expected);
    });
    it('rotates a MxN matrix clockwise', () => {
      const uut = [
        [9, 5, 1],
        [10, 6, 2],
        [11, 7, 3],
        [12, 8, 4],
      ];
      const expected = [
        [12, 11, 10, 9],
        [8, 7, 6, 5],
        [4, 3, 2, 1],
      ];

      expect(rotateClockWise(uut, undefined)).toEqual(expected);
    });
  });
});

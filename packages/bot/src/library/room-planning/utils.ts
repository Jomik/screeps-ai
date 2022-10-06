import { expandPosition } from '../../utils';
import { Coordinates, RoomPlan } from './plan';

export const coordinatesToNumber = ([x, y]: Coordinates): number => x + y * 50;
export const numberToCoordinates = (coordinates: number): Coordinates => {
  const x = coordinates % 50;
  return [x, (coordinates - x) / 50];
};

export const isNextToRoad = (pos: Coordinates, plan: RoomPlan): boolean =>
  expandPosition(pos).some(([x, y]) => plan.base.get(x, y) === 1);

export const dist = ([ax, ay]: Coordinates, [bx, by]: Coordinates): number =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

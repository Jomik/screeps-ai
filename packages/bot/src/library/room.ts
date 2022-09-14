export type Coordinates = [x: number, y: number];

export type RoomPlan = {
  roomName: string;
  state: 'initial' | 'invalid' | 'done';
  structures: Partial<Record<StructureConstant, Coordinates[]>>;
  base: CostMatrix;
  distanceTransform: CostMatrix;
  lastChange: number;
};

const plans = new Map<string, RoomPlan>();

export const getRoomPlan = (roomName: string): RoomPlan =>
  plans.get(roomName) ?? {
    roomName,
    state: 'initial',
    structures: {},
    distanceTransform: new PathFinder.CostMatrix(),
    base: new PathFinder.CostMatrix(),
    lastChange: 0,
  };

export const saveRoomPlan = (
  plan: RoomPlan,
  state: RoomPlan['state']
): void => {
  plans.set(plan.roomName, { ...plan, state, lastChange: Game.time });
};

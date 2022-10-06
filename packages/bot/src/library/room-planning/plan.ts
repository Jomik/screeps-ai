export type Coordinates = [x: number, y: number];

export type RoomPlan = {
  roomName: string;
  state: 'initial' | 'invalid' | 'done';
  structures: [BuildableStructureConstant, ...Coordinates][];
  base: CostMatrix;
  buildingSpace: CostMatrix;
  lastChange: number;
};

const plans = new Map<string, RoomPlan>();

export const getRoomPlan = (roomName: string): RoomPlan => {
  let plan = plans.get(roomName);
  if (!plan) {
    plan = {
      roomName,
      state: 'initial',
      structures: [],
      buildingSpace: new PathFinder.CostMatrix(),
      base: new PathFinder.CostMatrix(),
      lastChange: 0,
    };
    saveRoomPlan(plan, 'initial');
  }
  return plan;
};

export const saveRoomPlan = (
  plan: RoomPlan,
  state: RoomPlan['state']
): void => {
  plans.set(plan.roomName, { ...plan, state, lastChange: Game.time });
};

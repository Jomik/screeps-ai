// prettier-ignore
const outline = [
  [1,1], [0,1], [-1,1],
  [1,0], /*[0,0],*/ [-1,0],
  [1,-1], [0,-1], [-1,-1],
] as const;

export const expandPosition = (pos: RoomPosition): RoomPosition[] =>
  outline.map(([x, y]) => new RoomPosition(x + pos.x, y + pos.y, pos.roomName));

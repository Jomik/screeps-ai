import { createProcess, sleep } from 'kernel';
import { ensureChild, exit } from '../library';

const getRoom = (roomName: string): Room => {
  const room = Game.rooms[roomName];

  if (room === undefined) {
    return exit(`Room ${roomName} not found`);
  }

  return room;
};

export const RoomManager = createProcess(function* (roomName: string) {
  const spawns = getRoom(roomName).find(FIND_MY_SPAWNS);

  if (spawns.length === 0) {
    // TODO: We should recreate the base here.
    return;
  }

  for (;;) {
    yield* ensureChild('RoomPlanner', undefined, roomName);
    yield* sleep(500);
  }
});

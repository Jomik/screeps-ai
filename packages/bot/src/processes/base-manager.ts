import { createProcess, exit, sleep } from 'kernel';
import { createLogger, ensureChild } from '../library';

const getRoom = (roomName: string): Room => {
  const room = Game.rooms[roomName];

  if (room === undefined) {
    return exit(`Room ${roomName} not found`);
  }

  return room;
};

const logger = createLogger('base-manager');

export const baseManager = createProcess(function* (roomName: string) {
  const spawns = getRoom(roomName).find(FIND_MY_SPAWNS);

  if (spawns.length === 0) {
    // TODO: We should recreate the base here.
    return;
  }

  for (;;) {
    yield* ensureChild('roomPlanner', undefined, roomName);
    yield* sleep(500);
  }
});

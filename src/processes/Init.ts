import { createProcess, fork } from 'system';

export const init = createProcess(function* () {
  yield* fork('creepManager');
  yield* fork('spawnManager');

  for (const room of Object.values(Game.rooms)) {
    if (room.find(FIND_MY_SPAWNS).length > 0) {
      yield* fork('roomPlanner', room.name);
    }
  }
});

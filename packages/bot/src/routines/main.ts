import { go } from 'runner';
import { creepManager } from './creep-manager';
import { planRoom } from './plan-room';
import { spawnManager } from './spawn-manager';

export function* main() {
  go(creepManager);
  go(spawnManager);

  for (const room of Object.values(Game.rooms)) {
    const spawns = room.find(FIND_MY_SPAWNS);

    if (spawns.length > 0) {
      go(planRoom, room.name);
    }
  }
}

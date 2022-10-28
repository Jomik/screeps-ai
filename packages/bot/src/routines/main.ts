import { go } from '../runner';
import { creepManager } from './creep-manager';
import { planRoom } from './plan-room';
import { spawnManager } from './spawn-manager';
import { towerManager } from './tower-manager';

export function* main() {
  go(towerManager);
  go(creepManager);
  go(spawnManager);

  for (const room of Object.values(Game.rooms)) {
    if (room.controller?.my) {
      go(planRoom, room.name);
    }
  }
}

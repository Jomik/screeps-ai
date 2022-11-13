import { safeRoom } from '../library/safe';
import { spawnRequestVisualiser } from '../library/spawn';
import { go } from '../runner';
import { creepManager } from './creep-manager';
import { intelManager } from './intel-manager';
import { linkManager } from './link-manager';
import { planRoom } from './plan-room';
import { spawnManager } from './spawn-manager';
import { spawnQueue } from './spawn-queue';
import { towerManager } from './tower-manager';

export function* main() {
  go(towerManager);
  go(creepManager);
  go(spawnManager);
  go(intelManager);
  go(spawnRequestVisualiser, 4);

  for (const unsafeRoom of Object.values(Game.rooms)) {
    const room = safeRoom(unsafeRoom);
    if (room.controller?.my) {
      go(spawnQueue, room);
      go(planRoom, room.name);
      go(linkManager, room.name);
    }
  }
}

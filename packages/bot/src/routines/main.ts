import { go } from '../runner';
import { creepManager } from './creep-manager';
import { intelManager } from './intel-manager';
import { linkManager } from './link-manager';
import { planRoom } from './plan-room';
import { regionDivider } from './region-divider';
import { spawnManager } from './spawn-manager';
import { towerManager } from './tower-manager';

export function* main() {
  go(towerManager);
  go(creepManager);
  go(spawnManager);
  go(intelManager);
  go(regionDivider, 'W8N8');

  for (const room of Object.values(Game.rooms)) {
    if (room.controller?.my) {
      // go(regionDivider, room.name);
      go(planRoom, room.name);
      go(linkManager, room.name);
    }
  }
}

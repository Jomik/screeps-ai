import { sleep } from '../library/sleep';
import { isStructureType } from '../utils';

export function* towerManager() {
  for (;;) {
    yield sleep();
    for (const room of Object.values(Game.rooms)) {
      const hostiles = room.find(FIND_HOSTILE_CREEPS);
      if (hostiles.length === 0) {
        continue;
      }

      const towers = room
        .find(FIND_STRUCTURES)
        .filter(isStructureType(STRUCTURE_TOWER));
      for (const tower of towers) {
        tower.attack(_.min(hostiles, 'hits'));
      }
    }
  }
}

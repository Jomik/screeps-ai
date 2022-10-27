import { sleep } from '../library/sleep';
import { isStructureType, min } from '../utils';

export function* towerManager() {
  for (;;) {
    yield sleep();
    for (const room of Object.values(Game.rooms)) {
      const target = min(room.find(FIND_HOSTILE_CREEPS), (v) => v.hits);
      if (!target) {
        continue;
      }

      const towers = room
        .find(FIND_STRUCTURES)
        .filter(isStructureType(STRUCTURE_TOWER));
      for (const tower of towers) {
        tower.attack(target);
      }
    }
  }
}

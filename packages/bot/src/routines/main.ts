import { go } from '../runner';
import { planRoom } from './plan-room';

export function* main() {

  for (const room of Object.values(Game.rooms)) {
    if (room.controller?.my) {
      go(planRoom, room.name);
    }
  }
}

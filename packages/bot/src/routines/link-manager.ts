import { createLogger } from '../library';
import { sleep } from '../library/sleep';
import { isStructureType, min } from '../utils';

const logger = createLogger('link-manager');

export function* linkManager(roomName: string) {
  const room = Game.rooms[roomName];
  if (!room?.controller) {
    return;
    // return exit(`No vision in room ${roomName}`);
  }

  while (
    (CONTROLLER_STRUCTURES[STRUCTURE_LINK][
      Game.rooms[roomName]?.controller?.level ?? 0
    ] ?? 0) <= 0
  ) {
    yield sleep();
  }

  for (;;) {
    yield sleep();
    const room = Game.rooms[roomName];
    if (!room || !room.controller) {
      return;
    }

    const { storage, controller } = room;
    const links = room
      .find(FIND_MY_STRUCTURES)
      .filter(isStructureType(STRUCTURE_LINK));

    if (links.length === 0 || !storage) {
      continue;
    }

    const source = min(links, (link) => storage.pos.getRangeTo(link));
    const target = links.find((link) => link.pos.getRangeTo(controller) <= 3);

    if (!source || !target) {
      continue;
    }

    if (
      source.cooldown > 0 ||
      source.store.getUsedCapacity(RESOURCE_ENERGY) === 0 ||
      target.store.getFreeCapacity(RESOURCE_ENERGY) <
        target.store.getCapacity(RESOURCE_ENERGY) * 0.5
    ) {
      continue;
    }

    source.transferEnergy(target);
  }
}

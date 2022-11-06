import { Coordinates, createLogger, getMemoryRef } from '../library';
import { sleep } from '../library/sleep';

const logger = createLogger('intel-manager');

interface RoomIntel {
  remotes: Coordinates[];
  hostile: boolean;
}

type Intel = Record<string, RoomIntel>;

export const intelRef = getMemoryRef<Intel>('intel', {});

export function* intelManager() {
  const intel = intelRef.get();
  const originPos = Game.spawns['Spawn1']?.pos;
  if (!originPos) {
    return;
  }

  for (;;) {
    yield sleep();
    for (const room of Object.values(Game.rooms)) {
      if (room.name in intel) {
        continue;
      }

      logger.info(`Intel on ${room.name}`);

      const remotes = room
        .find(FIND_SOURCES)
        .map(({ pos: { x, y } }) => [x, y] as Coordinates)
        .filter(([x, y]) => {
          const { incomplete, cost } = PathFinder.search(originPos, {
            pos: new RoomPosition(x, y, room.name),
            range: 1,
          });
          logger.info(`${room.name} : ${cost}`);
          return !incomplete && cost < 50;
        });
      const hostile =
        room.find(FIND_HOSTILE_CREEPS).length > 0 ||
        room.find(FIND_HOSTILE_STRUCTURES).length > 0;

      intel[room.name] = {
        remotes,
        hostile,
      };
    }
  }
}

import { Coordinates, createLogger, getMemoryRef } from '../library';
import { sleep } from '../library/sleep';
import { createSpawnRequest } from '../library/spawn';
import { go } from '../runner';

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

  go(function* scoutRequester() {
    for (;;) {
      yield sleep();
      const adjacentRooms = Object.values(
        Game.map.describeExits(originPos.roomName)
      ).filter(
        (roomName) => Game.map.getRoomStatus(roomName).status === 'normal'
      );

      if (
        adjacentRooms.some((roomName) => !(roomName in intel)) &&
        Object.keys(Game.creeps).every((name) => !name.startsWith('scout'))
      ) {
        logger.info(`Creating spawn request`);
        const creep = yield* createSpawnRequest({
          memory: { home: originPos.roomName },
          priority: 99,
          roomName: originPos.roomName,
          type: 'scout',
          *bodyFactory() {
            yield [MOVE];
            yield [TOUGH];
          },
        });
        logger.info(`Got scout ${creep.name}`);
      }
    }
  });

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
          const { incomplete } = PathFinder.search(originPos, {
            pos: new RoomPosition(x, y, room.name),
            range: 1,
          });
          return !incomplete;
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

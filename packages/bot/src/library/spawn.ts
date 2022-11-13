import { Future } from 'coroutines';
import { CreepTypes } from '../routines/creep-manager';
import { groupByKey, min } from '../utils';
import { safeGameObject, TickSafe } from './safe';
import { sleep } from './sleep';

interface SpawnRequest {
  roomName: string;
  memory: CreepMemory;
  type: CreepTypes;
  priority: number;
  bodyFactory: () => IterableIterator<BodyPartConstant[]>;
}

interface RegisteredSpawnRequest {
  request: SpawnRequest;
  resolve: (id: Id<Creep>) => void;
}

const spawnRequests: Array<RegisteredSpawnRequest> = [];
export function* spawnRequestVisualiser(offset: number) {
  for (;;) {
    const requestsByRoom = groupByKey(
      spawnRequests.map(({ request }) => request),
      'roomName'
    );
    for (const [roomName, requests] of Object.entries(requestsByRoom)) {
      requests?.sort((a, b) => a.priority - b.priority);
      const visuals = new RoomVisual(roomName);
      visuals.text(`Spawn queue:`, 0, offset + 1.2, {
        font: 0.7,
        align: 'left',
      });
      requests?.forEach(({ type, priority }, index) => {
        visuals.text(`${priority}: ${type}`, 0, offset + index + 2.2, {
          font: 0.7,
          align: 'left',
        });
      });
    }
    yield sleep();
  }
}

const spawnListeners: Array<{
  roomName: string;
  resolve: (request: RegisteredSpawnRequest) => void;
}> = [];

export const waitForSpawnRequest = (
  roomName: string
): Future<RegisteredSpawnRequest> => {
  const request = min(
    spawnRequests.filter(({ request }) => request.roomName === roomName),
    ({ request }) => request.priority
  );
  if (request) {
    spawnRequests.splice(spawnRequests.indexOf(request), 1);
    return Future.resolve(request);
  }

  return new Future<RegisteredSpawnRequest>((resolve) => {
    spawnListeners.push({
      roomName,
      resolve,
    });
  });
};

export const createSpawnRequest = (
  request: SpawnRequest
): Future<TickSafe<Creep>> => {
  return new Future<Id<Creep>>((resolve) => {
    const registeredRequest = { request, resolve };
    const listener = spawnListeners.find(
      ({ roomName }) => roomName === request.roomName
    );

    if (!listener) {
      spawnRequests.push(registeredRequest);
      return;
    }

    spawnListeners.splice(spawnListeners.indexOf(listener), 1);
    listener.resolve(registeredRequest);
  }).then(safeGameObject);
};

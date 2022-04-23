import { PID } from 'os';
import {
  getChildren,
  createProcess,
  fork,
  sleep,
  ArgsForProcess,
  ProcessInfo,
} from 'os';
import type { Registry } from '../registry';
import { creepManager } from './creep-manager';
import { roomPlanner } from './room-planner';
import { spawnManager } from './spawn-manager';

export const init = createProcess(function* () {
  for (;;) {
    const children = yield* getChildren();
    const childMap = Object.values(children).reduce<{
      [Type in keyof Registry]?: Array<{
        type: Type;
        pid: PID;
        args: ArgsForProcess<Registry[Type]>;
      }>;
    }>((acc, cur) => {
      return {
        ...acc,
        [cur.type]: (
          acc[cur.type as keyof Registry] ?? ([] as ProcessInfo[])
        ).concat(cur),
      };
    }, {});

    if (
      childMap.creepManager === undefined ||
      childMap.creepManager.length === 0
    ) {
      yield* fork(creepManager);
    }
    if (
      childMap.spawnManager === undefined ||
      childMap.spawnManager.length === 0
    ) {
      yield* fork(spawnManager);
    }
    for (const room of Object.values(Game.rooms)) {
      if (
        !childMap.roomPlanner?.some(
          ({ args: [roomName] }) => roomName === room.name
        ) &&
        room.find(FIND_MY_SPAWNS).length > 0
      ) {
        yield* fork(roomPlanner, room.name);
      }
    }

    yield* sleep(50);
  }
});

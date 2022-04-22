import { PID } from 'kernel';
import { Registry } from 'processes';
import {
  getChildren,
  createProcess,
  fork,
  sleep,
  ArgsForProcess,
  ProcessInfo,
} from 'system';

export const init = createProcess(function* () {
  for (;;) {
    const children = yield* getChildren();
    const childMap = Object.values(children).reduce<{
      [Type in keyof Registry]?: Array<{
        type: Type;
        pid: PID;
        args: ArgsForProcess<Type>;
      }>;
    }>((acc, cur) => {
      return {
        ...acc,
        [cur.type]: (acc[cur.type] ?? ([] as ProcessInfo[])).concat(cur),
      };
    }, {});

    if (
      childMap.creepManager === undefined ||
      childMap.creepManager.length === 0
    ) {
      yield* fork('creepManager');
    }
    if (
      childMap.spawnManager === undefined ||
      childMap.spawnManager.length === 0
    ) {
      yield* fork('spawnManager');
    }
    for (const room of Object.values(Game.rooms)) {
      if (
        !childMap.roomPlanner?.some(
          ({ args: [roomName] }) => roomName === room.name
        ) &&
        room.find(FIND_MY_SPAWNS).length > 0
      ) {
        yield* fork('roomPlanner', room.name);
      }
    }

    yield* sleep(50);
  }
});

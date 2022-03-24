import { fork } from 'kernel/sys-calls';
import { Process, Thread } from '../kernel/Process';
import { RoomPlanner } from './RoomPlanner';
import { CreepManager } from './CreepManager';
import { SpawnManager } from './SpawnManager';
import { ColonyManager } from './ColonyManager';

const InitProcesses = [SpawnManager, CreepManager, RoomPlanner];

export class Init extends Process {
  *run(): Thread {
    for (const type of InitProcesses) {
      yield* fork(type, {});
    }
    yield* fork(ColonyManager, { room: 'W5N8' });
  }
}

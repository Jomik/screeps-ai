import { fork } from 'kernel/sys-calls';
import { Process, Thread } from '../kernel/Process';
import { RoomPlanner } from './RoomPlanner';
import { CreepManager } from './CreepManager';
import { SpawnManager } from './SpawnManager';

const InitProcesses = [SpawnManager, CreepManager, RoomPlanner];

export class Init extends Process<undefined> {
  *run(): Thread {
    const spawnedProcesses = this.children.map((v) => v.type);
    for (const type of InitProcesses) {
      if (!spawnedProcesses.includes(type)) {
        yield* fork(type, undefined);
      }
    }
  }
}

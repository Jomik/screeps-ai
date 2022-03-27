import { Process, Thread, fork } from 'kernel';
import { RoomPlanner } from './RoomPlanner';
import { CreepManager } from './CreepManager';
import { SpawnManager } from './SpawnManager';

const InitProcesses = [SpawnManager, CreepManager, RoomPlanner];

export class Init extends Process {
  *run(): Thread {
    for (const type of InitProcesses) {
      yield* fork(type, {});
    }
  }
}

import { hibernate, fork } from 'kernel/sys-calls';
import { Process, Thread } from '../kernel/Process';
import { BasePlanner } from './BasePlanner';
import { CreepManager } from './CreepManager';
import { SpawnManager } from './SpawnManager';

const InitProcesses = [SpawnManager, CreepManager, BasePlanner];

export class Init extends Process<undefined> {
  *run(): Thread {
    const spawnedProcesses = this.children.map((v) => v.type);
    for (const type of InitProcesses) {
      if (!spawnedProcesses.includes(type)) {
        const pid = yield* fork(type, undefined);
        this.logger.info(`spawned ${type.name} with pid ${pid}`);
      }
    }
    yield* hibernate();
  }
}

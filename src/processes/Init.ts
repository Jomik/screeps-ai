import { hibernate, fork } from 'kernel/sys-calls';
import { Process, Thread } from '../kernel/Process';
import { BasePlanner } from './BasePlanner';
import { CreepManager } from './CreepManager';
import { SpawnManager } from './SpawnManager';

export class Init extends Process<undefined> {
  *run(): Thread {
    const smPID = yield* fork(SpawnManager, undefined);
    const cmPID = yield* fork(CreepManager, undefined);
    const bpPID = yield* fork(BasePlanner, undefined);
    yield* hibernate();
  }
}

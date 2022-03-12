import { Process, Thread } from '../kernel/Process';
import { fork, hibernate } from '../kernel/sys-calls';
import { Init } from './Init';

export class Tron extends Process<undefined> {
  *run(): Thread {
    this.logger.alert('Global reset');
    if (!this.hasChildOfType(Init)) {
      this.logger.info('Initialising...');
      yield* fork(Init, undefined);
    }
    yield* hibernate();
  }
}

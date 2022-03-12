import { Process, Thread } from '../kernel/Process';
import { hibernate } from '../kernel/sys-calls';

export class Tron extends Process<undefined> {
  *run(): Thread {
    yield* hibernate();
  }
}

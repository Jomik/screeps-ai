import { Scheduler, Routine } from '../runner';

export class FIFOScheduler implements Scheduler {
  private routines: Routine[] = [];
  canRun() {
    return this.routines.length > 0;
  }

  schedule(routine: Routine) {
    this.routines.unshift(routine);
  }

  next() {
    const r = this.routines.pop();
    if (!r) {
      throw new Error('No routine found');
    }
    return r;
  }

  remove(routine: Routine) {
    const index = this.routines.indexOf(routine);
    if (index !== -1) {
      this.routines.splice(index, 1);
    }
  }
}

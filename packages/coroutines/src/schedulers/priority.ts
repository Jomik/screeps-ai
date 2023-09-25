import { Routine, Scheduler } from '../runner';

export class PriorityScheduler implements Scheduler {
  private routines: Routine[] = [];
  private priorities = new Map<Routine, number>();

  setPriority(routine: Routine, priority: number) {
    this.priorities.set(routine, priority);
  }

  canRun(): boolean {
    return this.routines.length > 0;
  }

  next(): Routine {
    let routine = undefined;
    let priority = Infinity;
    for (const candidate of this.routines) {
      const candidatePriority = this.priorities.get(candidate) ?? 0;
      if (candidatePriority < priority) {
        routine = candidate;
        priority = candidatePriority;
      }
    }
    if (!routine) {
      throw new Error('No routine found');
    }
    const index = this.routines.indexOf(routine);
    this.routines.splice(index, 1);
    return routine;
  }

  schedule(routine: Routine): void {
    this.routines.push(routine);
  }

  remove(routine: Routine): void {
    this.priorities.delete(routine);
    const index = this.routines.indexOf(routine);
    if (index !== -1) {
      this.routines.splice(index, 1);
    }
  }
}

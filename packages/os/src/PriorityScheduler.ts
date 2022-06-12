import type { PID } from './system';
import type { Scheduler, Priority, ScheduleGenerator } from './Scheduler';

/**
 * Priority based scheduler
 * Will yield highest priority thread first, untill done.
 * Lower number means higher priority, modelled after Linux system priorities.
 */
export class PriorityScheduler implements Scheduler {
  private pids = new Map<PID, Priority>();

  constructor(readonly defaultPriority: Priority) {}

  clampPriority(requestedPriority: Priority): Priority {
    return Math.min(139, Math.max(requestedPriority, 0)) as Priority;
  }

  add(pid: PID, priority: Priority | null): void {
    this.pids.set(pid, priority ?? this.defaultPriority);
  }

  remove(pid: PID): void {
    this.pids.delete(pid);
  }

  *run(quota: () => number): ScheduleGenerator {
    const pidsToRun = [...this.pids]
      .sort((a, b) => a[1] - b[1])
      .map(([pid]) => pid);

    for (const pid of pidsToRun) {
      while (quota() > 0) {
        if (!this.pids.has(pid)) {
          break;
        }

        const runAgain = yield pid;
        if (!runAgain) {
          break;
        }
      }
    }
  }
}

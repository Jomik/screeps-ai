import { PID } from './system';
import { Scheduler, Priority, ScheduleGenerator } from './Scheduler';

export class PriorityScheduler implements Scheduler {
  private pids = new Map<PID, Priority>();

  constructor(readonly defaultPriority: Priority) {}

  clampPriority(requestedPriority: Priority): Priority {
    return requestedPriority;
  }

  add(pid: PID, priority: Priority): void {
    this.pids.set(pid, priority);
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

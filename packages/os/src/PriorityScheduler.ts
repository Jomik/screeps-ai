import { PID } from './system';
import { Scheduler, Priority, ScheduleGenerator } from './Scheduler';

export class PriorityScheduler implements Scheduler {
  private pids = new Map<PID, Priority>();
  private sleeping = new Map<PID, number>();

  constructor(
    readonly defaultPriority: Priority,
    private readonly config: { quota(): number; clock(): number }
  ) {}

  clampPriority(requestedPriority: Priority): Priority {
    return requestedPriority;
  }

  add(pid: PID, priority: Priority): void {
    this.pids.set(pid, priority);
  }

  remove(pid: PID): void {
    this.pids.delete(pid);
    this.sleeping.delete(pid);
  }

  *run(): ScheduleGenerator {
    const tick = this.config.clock();
    for (const [pid, wakeTime] of this.sleeping) {
      if (tick >= wakeTime) {
        this.sleeping.delete(pid);
      }
    }

    const pidsToRun = [...this.pids]
      .sort((a, b) => a[1] - b[1])
      .map(([pid]) => pid);

    for (const pid of pidsToRun) {
      while (this.config.quota() > 0) {
        if (!this.pids.has(pid) || this.sleeping.has(pid)) {
          break;
        }

        const res = yield pid;
        if (!res) {
          continue;
        }

        if (res.type === 'sleep') {
          if (res.ticks > 1) {
            this.sleeping.set(pid, tick + res.ticks);
          }
          break;
        }
      }
    }
  }
}

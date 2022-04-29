import { PID, Priority, Scheduler, SchedulerThreadReturn } from 'os';

export class RoundRobinScheduler implements Scheduler {
  private pids: PID[] = [];

  constructor(private readonly quota: () => number) {}
  defaultPriority: Priority = 0;
  clampPriority(requestedPriority: Priority): Priority {
    return Math.max(Math.min(10, requestedPriority), 0);
  }

  add(pid: PID, priority: Priority): void {
    if (this.pids.includes(pid)) {
      return;
    }
    this.pids.push(pid);
  }

  remove(pid: PID): void {
    const index = this.pids.indexOf(pid);
    if (index === -1) {
      return;
    }
    this.pids.splice(index, 1);
  }

  *run(): Generator<PID, void, SchedulerThreadReturn> {
    let pidsToRun = [...this.pids];
    do {
      const round = [...pidsToRun];
      pidsToRun = [];
      for (const pid of round) {
        if (!this.pids.includes(pid)) {
          continue;
        }

        const res = yield pid;
        if (!res) {
          pidsToRun.push(pid);
          continue;
        }

        if (res.type === 'sleep') {
          // TODO: Handle sleeping
        }
      }
    } while (pidsToRun.length > 0 && this.quota() > 0);
  }
}

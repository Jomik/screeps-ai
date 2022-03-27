import { PID } from 'kernel';
import { RBTreeIndex } from 'scl';
import { ResolveAction } from 'scl/lib/util';
import { Scheduler, SchedulerThreadReturn } from './Scheduler';

type ThreadMeta = {
  pid: PID;
  startTick: number;
  cpuSpent?: number;
};

class RedBlackTree extends RBTreeIndex<ThreadMeta, PID> {
  constructor() {
    super({
      getKey: (meta) => meta.cpuSpent ?? 0,
      compareKeys: (a, b) => a < b,
      isEqual: (a, b) => a.pid === b.pid,
      onDuplicateKeys: ResolveAction.Insert,
      onDuplicateElements: ResolveAction.Ignore,
    });
  }
}

export class CFS implements Scheduler {
  private sleepingThreads: Record<PID, ThreadMeta> = {};
  private timeline = new RedBlackTree();
  private deletions = new Set<PID>();

  constructor(
    private readonly clock: () => number,
    private readonly quota: () => number
  ) {}

  add(pid: PID) {
    if (this.timeline.has({ pid, startTick: 0 })) {
      return;
    }
    this.sleepingThreads[pid] = {
      ...this.sleepingThreads[pid],
      pid,
      startTick: this.clock(),
    };
  }

  remove(pid: PID) {
    delete this.sleepingThreads[pid];
    this.deletions.add(pid);
  }

  *run(): Generator<PID, void, SchedulerThreadReturn> {
    this.doDeletions();
    const tick = this.clock();

    const minCpuSpent = this.timeline.begin()?.value.cpuSpent ?? 0;
    Object.values(this.sleepingThreads).forEach((meta) => {
      if (meta.startTick > tick) {
        return;
      }

      this.timeline.add({ ...meta, cpuSpent: minCpuSpent });
      delete this.sleepingThreads[meta.pid];
    });

    const availableCpu = this.quota();
    const cpuPerTask = availableCpu / this.timeline.size;

    for (const meta of this.timeline) {
      const startCpu = this.quota();
      while (
        startCpu - this.quota() < cpuPerTask &&
        !this.deletions.has(meta.pid)
      ) {
        const res = yield meta.pid;

        if (!res) {
          continue;
        }

        if (res.type === 'sleep') {
          this.sleepingThreads[meta.pid] = {
            ...meta,
            startTick: tick + res.ticks,
          };
          this.deletions.add(meta.pid);
          break;
        }
      }
    }

    this.doDeletions();
  }

  private doDeletions() {
    this.deletions.forEach((pid) =>
      this.timeline.delete({ pid, startTick: 0 })
    );
    this.deletions.clear();
  }
}

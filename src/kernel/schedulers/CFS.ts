import { PID } from 'kernel/Kernel';
import { Thread } from 'kernel/Process';
import { SysCall } from 'kernel/sys-calls';
import { RBTreeIndex } from 'scl';
import { ResolveAction } from 'scl/lib/util';

type ThreadMeta = {
  pid: number;
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

export class CFS {
  private sleepingThreads: Record<PID, ThreadMeta> = {};
  private timeline = new RedBlackTree();

  add(pid: PID, startTick = Game.time) {
    if (this.timeline.has({ pid, startTick })) {
      return;
    }
    this.sleepingThreads[pid] = {
      ...this.sleepingThreads[pid],
      pid,
      startTick,
    };
  }

  remove(pid: PID) {
    // TODO: Can we delete while running?
    delete this.sleepingThreads[pid];
    this.timeline.delete({ pid, startTick: 0 });
  }

  *run(): Generator<number, void, ReturnType<Thread['next']>> {
    const tick = Game.time;

    const minCpuSpent = this.timeline.begin()?.value.cpuSpent ?? 0;
    Object.values(this.sleepingThreads).forEach((meta) => {
      if (meta.startTick > tick) {
        return;
      }

      this.timeline.add({ ...meta, cpuSpent: minCpuSpent });
      delete this.sleepingThreads[meta.pid];
    });

    const availableCpu = Game.cpu.tickLimit * 0.8 - Game.cpu.getUsed();
    const cpuPerTask = availableCpu / this.timeline.size;

    const deletedThreads: ThreadMeta[] = [];

    for (const meta of this.timeline) {
      const startCpu = Game.cpu.getUsed();
      while (Game.cpu.getUsed() - startCpu < cpuPerTask) {
        const sysCall = yield meta.pid;

        if (sysCall.done) {
          deletedThreads.push(meta);
          break;
        }

        if (sysCall.value?.type === 'sleep') {
          this.sleepingThreads[meta.pid] = {
            ...meta,
            startTick: tick + sysCall.value.ticks,
          };
          deletedThreads.push(meta);
          break;
        }
      }
    }

    deletedThreads.forEach((meta) => this.timeline.delete(meta));
  }
}

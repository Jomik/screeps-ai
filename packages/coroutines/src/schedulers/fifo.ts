import { Scheduler, Routine } from '../runner';

export const fifo = (): Scheduler & { canRun(): boolean } => {
  const list: Routine[] = [];
  return {
    canRun() {
      return list.length > 0;
    },
    schedule(routine) {
      list.unshift(routine);
    },
    next() {
      const r = list.pop();
      if (!r) {
        throw new Error('Not ready to run');
      }
      return r;
    },
    remove() {
      // do nothing
    },
  };
};

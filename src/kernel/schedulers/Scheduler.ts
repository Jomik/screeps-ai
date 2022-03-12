import { PID } from 'kernel/Kernel';

export type SchedulerThreadReturn =
  | { type: 'done' }
  | { type: 'sleep'; ticks: number }
  | undefined;

export interface Scheduler {
  add(pid: PID): void;
  remove(pid: PID): void;
  run(): Generator<PID, void, SchedulerThreadReturn>;
}

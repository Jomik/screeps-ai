import { PID } from 'kernel/Kernel';

export type SchedulerThreadReturn =
  | { type: 'done' }
  | { type: 'sleep'; ticks: number }
  | undefined;

export type ScheduleGenerator = Generator<PID, void, SchedulerThreadReturn>;

export interface Scheduler {
  add(pid: PID): void;
  remove(pid: PID): void;
  run(): ScheduleGenerator;
}

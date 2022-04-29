import { PID, sleep } from './system';

export type SchedulerThreadReturn =
  | { type: 'sleep'; ticks: number }
  | undefined;

export type ScheduleGenerator = Generator<PID, void, SchedulerThreadReturn>;
export type Priority = number;

export interface Scheduler {
  readonly defaultPriority: Priority;
  clampPriority(requestedPriority: Priority): Priority;

  /**
   * Adds or updates a process to the scheduler
   */
  add(pid: PID, priority: Priority): void;
  remove(pid: PID): void;
  run(): ScheduleGenerator;
}

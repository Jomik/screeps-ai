import type { PID } from './system';

export type ScheduleGenerator = Generator<PID, void, boolean>;
export type Priority = number;

export interface Scheduler {
  readonly defaultPriority: Priority;
  clampPriority(requestedPriority: Priority): Priority;

  /**
   * Adds or updates a process to the scheduler
   */
  add(pid: PID, priority: Priority): void;
  remove(pid: PID): void;
  // Receives `true` if the thread wants to run again, false otherwise
  run(quota: () => number): ScheduleGenerator;
}

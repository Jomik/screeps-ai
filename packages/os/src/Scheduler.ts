import type { PID } from './system';

export type ScheduleGenerator = Generator<PID, void, boolean>;
declare const PrioritySymbol: unique symbol;
export type Priority = number & { [PrioritySymbol]: 'Priority' };

export interface Scheduler {
  readonly defaultPriority: Priority;
  clampPriority(requestedPriority: Priority): Priority;

  /**
   * Adds or updates a process to the scheduler
   */
  add(pid: PID, priority: Priority | null): void;
  remove(pid: PID): void;
  // Receives `true` if the thread wants to run again, false otherwise
  run(quota: () => number): ScheduleGenerator;
}

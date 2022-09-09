import { allocate, MemoryValue, Thread } from './system';

export const isProcessType =
  <Type extends keyof OSRegistry>(type: Type) =>
  (info: { type: keyof OSRegistry }): info is { type: Type } =>
    info.type === type;

export function* runOnce<T extends MemoryValue>(
  fn: (() => Thread<T>) & { name: string }
): Thread<T> {
  const ref = yield* allocate<{ ran: false } | { ran: true; result: T }>(
    fn.name,
    { ran: false }
  );
  if (!ref.value.ran) {
    const result = yield* fn();
    ref.value = { ran: true, result };
  }

  return ref.value.result;
}
export const isDefined = <T>(value: T | undefined | null): value is T =>
  value !== undefined && value !== null;

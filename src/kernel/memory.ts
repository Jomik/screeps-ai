import { ROM, ROMHandle } from './Kernel';

export const getMemoryRef = <T extends Record<string, unknown>>(
  key: string,
  defaultValue: T
): T => {
  if (!(key in Memory)) {
    Memory[key] = defaultValue;
  }

  return Memory[key] as never;
};

export const ScreepsROM: ROM = {
  getHandle<T>(key: string, defaultValue: T): ROMHandle<T> {
    if (!(key in Memory)) {
      Memory[key] = defaultValue;
    }

    return {
      get() {
        return Memory[key] as never;
      },
      set(value) {
        Memory[key] = value;
      },
    };
  },
};

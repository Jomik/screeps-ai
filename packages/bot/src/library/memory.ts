export const getMemoryRef = <T>(
  key: string,
  defaultValue: T
): { get(): T; set(value: T): void } => {
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
};

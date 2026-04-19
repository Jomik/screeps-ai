declare global {
  interface Memory extends Record<string, unknown> {}
}

export const getMemoryRef = <T>(
  key: string,
  defaultValue: T
): { get(): T; set(value: T): void } => {
  if (!(key in Memory)) {
    Memory[key] = defaultValue;
  }

  return {
    get() {
      // eslint-disable-next-line typescript/no-unsafe-type-assertion -- intentional type erasure for dynamic memory access
      return Memory[key] as never;
    },
    set(value) {
      Memory[key] = value;
    },
  };
};

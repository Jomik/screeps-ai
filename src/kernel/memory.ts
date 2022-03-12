export const getMemoryRef = <T extends Record<string, unknown>>(
  key: string,
  defaultValue: T
): T => {
  if (!(key in Memory)) {
    Memory[key] = defaultValue;
  }

  return Memory[key] as never;
};

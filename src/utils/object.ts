type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

export const entries = <T extends Record<string, unknown>>(
  obj: T
): Entries<T> => Object.entries(obj) as never;

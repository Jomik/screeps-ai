declare const global: Record<string, any>;

export class InvalidArgumentsError extends Error {
  constructor(
    public readonly expected: string,
    public readonly actual: unknown
  ) {
    super(`Expected ${expected} got ${typeof actual}`);
  }
}

export const registerCommand = (
  command: string,
  fn: (...args: unknown[]) => string | undefined
) => {
  if (command in global) {
    throw new Error(`Command ${command} has already been registered`);
  }

  global[command] = (...args: unknown[]) => {
    try {
      return fn(...args) ?? 'OK';
    } catch (err: unknown) {
      return err;
    }
  };
};

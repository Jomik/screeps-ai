declare const global: Record<string, unknown>;

export class InvalidArgumentError extends Error {
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
  global[command] = (...args: unknown[]) => {
    try {
      return fn(...args) ?? 'OK';
    } catch (err: unknown) {
      return err;
    }
  };
};

import { ROM } from 'kernel/Kernel';
import { Logger } from 'Logger';

export class SilentLogger extends Logger {
  protected log(): void {}
}

export const FakeROM = (): ROM & { data: Record<string, unknown> } => {
  const data: Record<string, any> = {};
  return {
    data,
    getHandle(key, defaultValue) {
      if (!(key in data)) {
        data[key] = defaultValue;
      }
      return {
        get() {
          return data[key];
        },
        set(value) {
          data[key] = value;
        },
      };
    },
  };
};

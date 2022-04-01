declare const SocketInSymbol: unique symbol;
declare const SocketOutSymbol: unique symbol;
declare const FileInSymbol: unique symbol;
declare const FileOutSymbol: unique symbol;

export type SocketPath = `sock://${string}`;
export type SocketIn<T = unknown> = SocketPath & {
  [SocketInSymbol]: T;
};
export type SocketOut<T = unknown> = SocketPath & {
  [SocketOutSymbol]: T;
};
export type Socket<T = unknown> = SocketIn<T> & SocketOut<T>;

export type FilePath = `file://${string}`;
export type FileIn<T = unknown> = FilePath & {
  [FileInSymbol]: T;
};
export type FileOut<T = unknown> = FilePath & {
  [FileOutSymbol]: T;
};
export type File<T = unknown> = FileIn<T> & FileOut<T>;

export interface IOHandle<T> {
  read(): { data: T } | undefined;
  write(value: T): void;
}

export class SocketHandle<T> implements IOHandle<T> {
  private queue: T[] = [];

  read(): { data: T } | undefined {
    if (this.queue.length > 0) {
      return { data: this.queue.shift() as T };
    }
    return undefined;
  }
  write(value: T): void {
    this.queue.push(value);
  }
  size(): number {
    return this.queue.length;
  }
}

export class FileHandle<T> implements IOHandle<T> {
  private written = false;
  private value: T | undefined = undefined;

  read(): { data: T } | undefined {
    if (!this.written) {
      return undefined;
    }
    return { data: this.value as T };
  }
  write(value: T): void {
    this.written = true;
    this.value = value;
  }
}

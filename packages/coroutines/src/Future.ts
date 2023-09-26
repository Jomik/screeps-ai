const NotResolved = Symbol('NotResolved');

export class Future<T> {
  private value: T | typeof NotResolved = NotResolved;
  private listeners: Array<(value: T) => void> = [];
  constructor(resolver: (resolve: (value: T) => void) => void) {
    resolver(this.resolve.bind(this));
  }

  // Implementation specific to `run`.
  [Symbol.iterator](): Iterator<Future<T>, T, T> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return (function* () {
      const res = yield self;
      return res;
    })();
  }

  static resolve<T>(value: T): Future<T> {
    return new Future<T>((resolve) => resolve(value));
  }

  static defer<T>(): [future: Future<T>, resolve: (value: T) => void] {
    let resolve: (value: T) => void;
    const future = new Future<T>((r) => {
      resolve = r;
    });
    // Depends on constructor immediately calling the resolver.
    return [future, resolve!];
  }

  private resolve(value: T): void {
    if (this.value !== NotResolved) {
      throw new Error('Future already resolved');
    }
    this.value = value;
    this.listeners.forEach((resolve) => resolve(value));
  }

  public then<U>(fn: (value: T) => U): Future<U> {
    if (this.value !== NotResolved) {
      return Future.resolve(fn(this.value));
    }

    const resolver = (resolve: (value: U) => void) =>
      this.listeners.push((value) => resolve(fn(value)));

    return new Future(resolver);
  }
}

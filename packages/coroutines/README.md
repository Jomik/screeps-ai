# My coroutine library

Heavily inspired by [Go's goroutines](https://go.dev/tour/concurrency).
Uses generator functions to enable cooperative scheduling.

## Getting started

Set up your routines with `go` in the outer scope. Then execute `run` in the loop for as long as we have CPU to spend.

```ts
go(function* main() {
  // Do things
  // Spawn other routines
  go(function* planRooms() {
    // Start planning.
    yield; // yield control to our runner for cooperative scheduling
  });
});

export const loop = () => {
  while (Game.cpu.tickLimit * 0.8 > Game.cpu.getUsed()) {
    if (!run()) {
      break;
    }
  }
};
```

### Future

This library implements a `Promise`-like construct called `Future`. If we yield a `Future` from our routine, the routine will wait for it to resolve.

We can create a `Future` similar to how you would create a `Promise`.

```ts
go(function* () {
  const future = new Future<number>((resolve) => {
    resolve(Math.random() * 42);
  });

  // Wait for the future to resolve.
  const randomNumber = yield* future;

  console.log(randomNumber);
});
```

Usually we want to pass a future on and then resolve it later.
There is a method available that supports this idea.

```ts
const [result, resolve] = Future.defer<string>();
go(function* (thing: Future<string>) {
  // Do stuff
  yield;
  // Wait for the thing
  const result = yield* thing;
  console.log(result);
});

// Do stuff
resolve('thing');
```

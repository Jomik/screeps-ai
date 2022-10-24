# My coroutine library
Heavily inspired by Go's goroutines

## Getting started
Set up your routines with `go` in the outer scope. Then execute `run` in the loop for as long as we have CPU to spend.

```ts
go(function* main() {
  // Do things
  // Spawn other routines
  go(function* planRooms() {
    // Start planning.
  });
});

export const loop = () => {
  while (Game.cpu.tickLimit * 0.8 > Game.cpu.getUsed()) {
    if (!run()) {
      break;
    }
  }
}
```

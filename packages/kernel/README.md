# My Screeps OS

## Getting started

We have to write some initial boilerplate to provide the process typings to our system calls.

Assuming that the `./processes` module exports all your processes as a record,
we extend the global `OSRegistry` type with those, so that our Kernel knows about them.

```ts
import { MemoryValue, Process } from 'os';
import * as registry from './processes';

// Verify that registry has the correct type.
registry as Record<string, Process<MemoryValue[]>>;
// We must export an init process to get started.
registry['init'] as Process<[]>;

type Registry = typeof registry;
declare global {
  interface OSRegistry extends Registry {}
}

export { registry };

```

We can now instantiate our `Kernel` and run it in the loop.
```ts
const kernel = new Kernel(
  registry,
  new RoundRobinScheduler(() => Game.cpu.tickLimit * 0.8 - Game.cpu.getUsed()),
  (key, value) => getMemoryRef(`kernel:${key}`, value),
);

export const loop = () => {
  kernel.run();
}
```

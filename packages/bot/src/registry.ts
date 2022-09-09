import { MemoryValue, Process } from 'kernel';
import * as registry from './processes';

// Verify that registry has the correct type.
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
registry as Record<string, Process<MemoryValue[]>>;
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
registry['init'] as Process<[]>;

type Registry = typeof registry;
declare global {
  interface OSRegistry extends Registry {}
}

export { registry };

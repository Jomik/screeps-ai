import { MemoryValue, Process } from 'os';
import * as registry from './processes';

// Verify that registry has the correct type.
registry as Record<string, Process<MemoryValue[]>>;
registry['init'] as Process<[]>;

type Registry = typeof registry;
declare global {
  interface OSRegistry extends Registry {}
}

export { registry };

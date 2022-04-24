import * as registry from './processes';

type Registry = typeof registry;
declare global {
  interface OSRegistry extends Registry {}
}

export { registry };

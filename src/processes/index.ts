import * as registryMap from './registry';
export type Registry = typeof registry;
export type ProcessNames = keyof Registry;

export const registry = registryMap;

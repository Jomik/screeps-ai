const isGenerator = (obj: Record<string, unknown>) =>
  'function' === typeof obj.next && 'function' === typeof obj.throw;

export const isGeneratorFunction = <R, T extends Generator>(
  obj: (() => R) | (() => T)
): obj is () => T => {
  const ctor = obj.constructor as Function & { displayName: string };
  if (!ctor) {
    return false;
  }

  return (
    'GeneratorFunction' === ctor.name ||
    'GeneratorFunction' === ctor.displayName ||
    isGenerator(ctor.prototype)
  );
};

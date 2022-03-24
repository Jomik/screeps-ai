interface CreepMemory {
  slot: [number, number];
}

interface Memory extends Record<string, unknown> {}

interface ProxyConstructor {
  new <TSource extends object, TTarget extends object>(
    target: TSource,
    handler: ProxyHandler<TSource>
  ): TTarget;
}

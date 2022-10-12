declare namespace jest {
  interface Matchers<R, T> {
    toMatchYields(
      expected: Array<
        | [T extends Iterator<infer Return, unknown, unknown> ? Return : never]
        | [
            T extends Iterator<infer Return, unknown, unknown> ? Return : never,
            T extends Iterator<unknown, unknown, infer Next>
              ? Next | (() => Next)
              : never
          ]
      >
    ): R;
    toMatchYieldsExactly(
      expected: Array<
        | [T extends Iterator<infer Return, unknown, unknown> ? Return : never]
        | [
            T extends Iterator<infer Return, unknown, unknown> ? Return : never,
            T extends Iterator<unknown, unknown, infer Next>
              ? Next | (() => Next)
              : never
          ]
      >
    ): R;
  }
}

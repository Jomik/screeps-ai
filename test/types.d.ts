declare namespace jest {
  interface Matchers<R> {
    toMatchYields<I extends Iterator<unknown>>(
      expected: Array<
        [
          I extends Iterator<infer T> ? T : never,
          I extends Iterator<any, any, infer N> ? N | (() => N) : never
        ]
      >
    ): R;
    toMatchYieldsExactly<I extends Iterator<unknown>>(
      expected: Array<
        [
          I extends Iterator<infer T> ? T : never,
          I extends Iterator<any, any, infer N> ? N | (() => N) : never
        ]
      >
    ): R;
  }
}

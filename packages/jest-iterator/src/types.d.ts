declare namespace jest {
  interface Matchers<R, T> {
    toMatchYields(
      expected: Array<
        | [T extends Iterator<infer Return, any, any> ? Return : never]
        | [
            T extends Iterator<infer Return, any, any> ? Return : never,
            T extends Iterator<any, any, infer Next>
              ? Next | (() => Next)
              : never
          ]
      >
    ): R;
    toMatchYieldsExactly(
      expected: Array<
        | [T extends Iterator<infer Return, any, any> ? Return : never]
        | [
            T extends Iterator<infer Return, any, any> ? Return : never,
            T extends Iterator<any, any, infer Next>
              ? Next | (() => Next)
              : never
          ]
      >
    ): R;
  }
}

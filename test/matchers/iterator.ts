// istanbul ignore file
function matchYields<Y, N>(
  this: jest.MatcherContext,
  iterator: Iterator<Y, unknown, N>,
  yieldValues: Array<[Y, N | (() => N)]>
) {
  let yieldIndex = 0;
  let pass = true;
  let received: unknown;
  let expected: Y | undefined;
  let iteratorValue: IteratorResult<Y, unknown> | undefined;
  const itemsYielded: unknown[] = [];

  do {
    const [expectedYieldValue] = yieldValues[yieldIndex] ?? [];
    const [, argumentForYieldThunk] = yieldValues[yieldIndex - 1] ?? [];
    const argumentForYield =
      typeof argumentForYieldThunk === 'function'
        ? (argumentForYieldThunk as () => N)()
        : argumentForYieldThunk;

    if (argumentForYield instanceof Error) {
      iteratorValue = iterator.throw?.(argumentForYield);
    } else {
      iteratorValue = iterator.next(argumentForYield);
    }

    const yieldedValue = iteratorValue?.value;
    itemsYielded.push(yieldedValue);
    const isYieldValueSameAsExpected = this.equals(
      yieldedValue,
      expectedYieldValue
    );

    if (!isYieldValueSameAsExpected && yieldIndex < yieldValues.length) {
      expected = expectedYieldValue;
      received = yieldedValue;
      pass = false;
      break;
    }

    yieldIndex++;
  } while (!iteratorValue?.done && yieldIndex - 1 < yieldValues.length);

  return {
    pass,
    expected,
    received,
    done: iteratorValue?.done ?? false,
    itemsYielded,
  };
}

export function toMatchYields<Y, N>(
  this: jest.MatcherContext,
  iterator: Iterator<Y, any, N>,
  yieldValues: Array<[Y, N | (() => N)]>
): jest.CustomMatcherResult {
  const { pass, received, expected } = matchYields.bind(this)(
    iterator,
    yieldValues
  );

  return {
    pass,
    message: () => `
    Expected iterator to match with: \n
      ${this.utils.printExpected(expected)}
    Received:\n
      ${this.utils.printReceived(received)}
  `,
  };
}

export function toMatchYieldsExactly<Y, N>(
  this: jest.MatcherContext,
  iterator: Iterator<Y, any, N>,
  yieldValues: Array<[Y, N | (() => N)]>
): jest.CustomMatcherResult {
  const { pass, received, expected, done, itemsYielded } = matchYields.bind(
    this
  )(iterator, yieldValues);

  if (pass && (!done || itemsYielded.length < yieldValues.length)) {
    return {
      pass: false,
      message: () => `
    Expected iterator to yield items: \n
      ${this.utils.printExpected(yieldValues.map(([item]) => item))}
    Received:\n
      ${this.utils.printReceived(itemsYielded)}
  `,
    };
  }
  return {
    pass,
    message: () => `
    Expected iterator to match with: \n
      ${this.utils.printExpected(expected)}
    Received:\n
      ${this.utils.printReceived(received)}
  `,
  };
}

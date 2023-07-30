import { Future } from './Future';

describe('Future', () => {
  it('calls then', () => {
    let res = '';
    const expected = 'foo';
    const resolver = jest.fn();

    const uut = new Future<string>((resolve) =>
      resolver.mockImplementation(resolve)
    );
    uut.then((value) => (res = value));
    resolver(expected);

    expect(res).toBe(expected);
  });

  it('calls then if already resolved', () => {
    let res = '';
    const expected = 'foo';
    const resolver = jest.fn();

    const uut = new Future<string>((resolve) =>
      resolver.mockImplementation(resolve)
    );
    resolver(expected);
    uut.then((value) => (res = value));

    expect(res).toBe(expected);
  });
});

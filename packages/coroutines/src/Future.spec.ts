import { Future } from './Future';

describe('Future', () => {
  it('calls then', () => {
    let res = '';
    const expected = 'foo';
    let resolver: (value: string) => void;

    const uut = new Future<string>((resolve) => (resolver = resolve));
    uut.then((value) => (res = value));
    // @ts-ignore it is assigned
    resolver?.(expected);

    expect(res).toBe(expected);
  });

  it('calls then on resolved', () => {
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

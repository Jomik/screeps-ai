import { Future } from './Future';

describe('Future', () => {
  it('calls then', () => {
    let res = '';
    const expected = 'foo';
    const [uut, resolver] = Future.defer<string>();

    uut.then((value) => (res = value));
    resolver(expected);

    expect(res).toBe(expected);
  });

  it('calls then if already resolved', () => {
    let res = '';
    const expected = 'foo';
    const [uut, resolver] = Future.defer<string>();

    resolver(expected);
    uut.then((value) => (res = value));

    expect(res).toBe(expected);
  });
});

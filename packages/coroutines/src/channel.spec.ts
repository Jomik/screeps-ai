import { make } from './channel';

describe('channel', () => {
  describe('get', () => {
    it('waits for a value', () => {
      const channel = make<string>();
      const fn = jest.fn<void, [string]>();
      const uut = channel.get();

      uut.then(fn);

      expect(fn).toBeCalledTimes(0);
    });

    it('gets a value', () => {
      const expected = 'foo';
      const channel = make<string>();
      const fn = jest.fn<void, [string]>();
      const uut = channel.get();
      channel.send(expected);

      uut.then(fn);

      expect(fn).toBeCalledWith(expected);
    });

    it('gets multiple', () => {
      const channel = make<string>();
      const fn = jest.fn<void, [string]>();
      const uut1 = channel.get();
      const uut2 = channel.get();

      uut1.then(fn);
      uut2.then(fn);
      channel.send('1');
      channel.send('2');

      expect(fn).toBeCalledWith('1');
      expect(fn).toBeCalledWith('2');
    });
  });

  describe('send', () => {
    it('waits for consumer', () => {
      const channel = make<void>();
      const fn = jest.fn<void, []>();
      const uut = channel.send();

      uut.then(fn);

      expect(fn).toBeCalledTimes(0);
    });

    it('resolves on consumer', () => {
      const channel = make<void>();
      const fn = jest.fn<void, []>();
      const uut = channel.send();
      uut.then(fn);
      channel.get();

      expect(fn).toBeCalledTimes(1);
    });

    it('sends multiple', () => {
      const channel = make<void>();
      const fn = jest.fn<void, []>();
      const uut1 = channel.send();
      const uut2 = channel.send();

      uut1.then(fn);
      uut2.then(fn);
      channel.get();
      channel.get();

      expect(fn).toBeCalledTimes(2);
    });

    it('resolves immediately if capacity not full', () => {
      const channel = make<void>(1);
      const fn = jest.fn<void, []>();
      const uut = channel.send();

      uut.then(fn);

      expect(fn).toBeCalledTimes(1);
    });

    it('unblocks if consumed below capacity', () => {
      const channel = make<void>(1);
      const fn = jest.fn<void, []>();
      channel.send();
      const uut = channel.send();

      uut.then(fn);
      channel.get();

      expect(fn).toBeCalledTimes(1);
    });
  });
});

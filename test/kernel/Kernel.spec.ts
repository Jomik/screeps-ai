import { expect } from 'chai';
import { fork, hibernate, sleep } from 'kernel/sys-calls';
import * as sinon from 'sinon';
import { Kernel } from '../../src/kernel/Kernel';
import { Process, Thread } from '../../src/kernel/Process';
import { FakeROM, SilentLogger } from '../utils';

describe('Kernel', () => {
  describe('init', () => {
    it('spawns Init', () => {
      const thread = sinon.fake();
      class Init extends Process<undefined> {
        *run(): Thread {
          thread();
        }
      }
      const uut = new Kernel({
        Init,
        processes: [],
        rom: FakeROM(),
        loggerFactory: () => new SilentLogger(''),
      });

      uut.run();

      expect(thread).to.be.calledOnce;
    });

    it('does not spawn multiple Init threads on reboot', () => {
      const thread = sinon.fake();
      const rom = FakeROM();
      class Init extends Process<undefined> {
        *run(): Thread {
          thread();
        }
      }
      const kernel = new Kernel({
        Init,
        processes: [],
        rom,
        loggerFactory: () => new SilentLogger(''),
      });
      kernel.run();

      // Should not spawn Init, as Tron should exist.
      const uut = new Kernel({
        Init,
        processes: [],
        rom,
        loggerFactory: () => new SilentLogger(''),
      });
      uut.run();

      expect(thread).to.be.calledOnce;
    });
  });

  describe('sleep', () => {
    it('sleeps till next run', () => {
      const thread = sinon.fake();
      class Init extends Process<undefined> {
        *run(): Thread {
          thread();
          yield* sleep();
          thread();
        }
      }
      const uut = new Kernel({
        Init,
        processes: [],
        rom: FakeROM(),
        loggerFactory: () => new SilentLogger(''),
      });

      uut.run();

      expect(thread).to.be.calledOnce;
    });
    it('sleeps till next run, and continues', () => {
      const thread = sinon.fake();
      class Init extends Process<undefined> {
        *run(): Thread {
          thread(1);
          yield* sleep();
          thread(2);
        }
      }
      const uut = new Kernel({
        Init,
        processes: [],
        rom: FakeROM(),
        loggerFactory: () => new SilentLogger(''),
      });

      uut.run();
      uut.run();

      expect(thread).to.be.calledTwice;
      expect(thread).to.be.calledWithExactly(1);
      expect(thread).to.be.calledWithExactly(2);
    });
  });

  describe('fork', () => {
    it('forks a child', () => {
      const thread = sinon.fake();
      class Init extends Process<undefined> {
        *run(): Thread {
          yield* fork(Thread1, undefined);
          yield* hibernate();
        }
      }
      class Thread1 extends Process<undefined> {
        *run(): Thread {
          thread();
          yield* hibernate();
        }
      }
      const uut = new Kernel({
        Init,
        processes: [Thread1],
        rom: FakeROM(),
        loggerFactory: () => new SilentLogger(''),
      });

      uut.run();
      uut.run();

      expect(thread).to.be.calledOnce;
    });
  });
});

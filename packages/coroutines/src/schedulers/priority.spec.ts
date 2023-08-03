import { createRunner } from '../runner';
import { PriorityScheduler } from './priority';

describe('runner', () => {
  let go: ReturnType<typeof createRunner>['go'];
  let scheduler: PriorityScheduler;
  let execute: () => void;

  beforeEach(() => {
    scheduler = new PriorityScheduler();
    const runner = createRunner(scheduler);
    go = runner.go;
    execute = () => {
      while (scheduler.canRun()) {
        runner.run();
      }
    };
  });

  it('executes routines till done', () => {
    let uut = '';
    go(function* () {
      for (let i = 0; i < 3; ++i) {
        uut += 'A';
        yield;
      }
    });

    execute();

    expect(uut).toBe('AAA');
  });
  it('runs lowest number priority first', () => {
    let uut = '';
    const a = go(function* () {
      for (let i = 0; i < 3; ++i) {
        uut += 'A';
        yield;
      }
    });
    const b = go(function* () {
      for (let i = 0; i < 3; ++i) {
        uut += 'B';
        yield;
      }
    });
    scheduler.setPriority(a, 100);
    scheduler.setPriority(b, -1);

    execute();

    expect(uut).toBe('BBBAAA');
  });
  it('interleaves same priority', () => {
    let uut = '';
    const a = go(function* () {
      for (let i = 0; i < 3; ++i) {
        uut += 'A';
        yield;
      }
    });
    const b = go(function* () {
      for (let i = 0; i < 3; ++i) {
        uut += 'B';
        yield;
      }
    });
    scheduler.setPriority(a, 100);
    scheduler.setPriority(b, 100);

    execute();

    expect(uut).toBe('ABABAB');
  });
  it('changes priority in routine', () => {
    let uut = '';
    const a = go(function* () {
      scheduler.setPriority(this, 100);
      yield;
      for (let i = 0; i < 3; ++i) {
        uut += 'B';
        yield;
      }
    });
    go(function* () {
      for (let i = 0; i < 3; ++i) {
        uut += 'A';
        yield;
      }
      scheduler.setPriority(a, -1);
      yield;
      for (let i = 0; i < 3; ++i) {
        uut += 'A';
        yield;
      }
    });

    execute();

    expect(uut).toBe('AAABBBAAA');
  });
});

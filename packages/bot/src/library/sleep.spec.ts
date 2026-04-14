import { resolveSleep, sleep } from './sleep';

describe('sleep', () => {
  it('should sleep for a tick', () => {
    let done = false;
    Game.time = 1;
    sleep().then(() => {
      done = true;
    });
    Game.time = 2;
    resolveSleep();
    expect(done).toBe(true);
  });
  it('should sleep for multiple ticks', () => {
    let done = false;
    Game.time = 1;
    sleep(2).then(() => {
      done = true;
    });
    Game.time = 3;
    resolveSleep();
    expect(done).toBe(true);
  });
  it('should not resolve early', () => {
    let done = false;
    Game.time = 1;
    sleep(2).then(() => {
      done = true;
    });
    Game.time = 2;
    resolveSleep();
    expect(done).toBe(false);
  });
  it('should handle multiple sleeps', () => {
    let done1 = false;
    let done2 = false;
    Game.time = 1;
    sleep(2).then(() => {
      done1 = true;
    });
    sleep(2).then(() => {
      done2 = true;
    });
    Game.time = 3;
    resolveSleep();
    expect(done1).toBe(true);
    expect(done2).toBe(true);
  });
});

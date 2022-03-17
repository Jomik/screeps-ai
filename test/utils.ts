import { Logger } from 'Logger';

export class SilentLogger extends Logger {
  protected log(): void {}
}

export class CallbackLogger extends Logger {
  constructor(readonly log: Logger['log']) {
    super('');
  }
}

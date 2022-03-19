import { Logger } from 'Logger';

export class SilentLogger extends Logger {
  protected log(): void {
    // Do nothing
  }
}

export class CallbackLogger extends Logger {
  constructor(readonly log: Logger['log']) {
    super('');
  }
}

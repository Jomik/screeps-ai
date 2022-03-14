import { Logger } from 'Logger';

export class SilentLogger extends Logger {
  protected log(): void {}
}

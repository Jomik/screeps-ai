import { createRunner, FIFOScheduler } from 'coroutines';
import { createLogger } from './library';

const logger = createLogger('coroutines');
export const scheduler = new FIFOScheduler();
export const { go, run } = createRunner(scheduler, (err) => {
  logger.error(err as Error);
});

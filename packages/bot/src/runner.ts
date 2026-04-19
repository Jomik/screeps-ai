import { createRunner, FIFOScheduler } from 'coroutines';
import { createLogger } from './library';

const logger = createLogger('coroutines');
export const scheduler = new FIFOScheduler();
export const { go, run } = createRunner(scheduler, (err) => {
  if (err instanceof Error) {
    logger.error(err);
  } else {
    logger.error(new Error(String(err)));
  }
});

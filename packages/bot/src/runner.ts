import { createRunner, fifo } from 'coroutines';
import { createLogger } from './library';

const logger = createLogger('coroutines');
const scheduler = fifo();
export const canRun = () => scheduler.canRun();
export const { go, run } = createRunner(scheduler, (err) => {
  logger.error(err as Error);
});

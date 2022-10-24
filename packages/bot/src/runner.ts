import { createRunner } from 'coroutines';
import { createLogger } from './library';

const logger = createLogger('coroutines');
export const { go, run } = createRunner((err) => {
  logger.error(err as Error);
});

import { Kernel, Priority, PriorityScheduler } from 'kernel';
import { getMemoryRef, createLogger } from './library';
import { registry } from './registry';

const kernelLogger = createLogger('kernel');
export const kernel = new Kernel({
  registry,
  scheduler: new PriorityScheduler(0 as Priority),
  getDataHandle: (key, value) => getMemoryRef(`kernel:${key}`, value),
  quota: () => Game.cpu.tickLimit * 1.8 - Game.cpu.getUsed(),
  clock: () => Game.time,
  logger: {
    onKernelError(message) {
      kernelLogger.alert(message);
    },
    onProcessExit({ type, pid }, reason) {
      kernelLogger.info(`${type}:${pid} exited: ${reason}`);
    },
    onProcessError({ type, pid }, error: Error) {
      kernelLogger.error(`${type}:${pid} errored:`, error);
    },
  },
});

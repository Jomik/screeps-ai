import { getMemoryRef } from 'kernel/memory';

type StatsRecord = {
  [k: string]: number | undefined | StatsRecord;
};

const statsRef = getMemoryRef<StatsRecord>('stats', {});

export const resetStats = () => {
  statsRef.set({
    time: Game.time,
  });
};

export const recordStats = (stats: StatsRecord) => {
  statsRef.set(
    _.merge(statsRef.get(), stats, (a, b) =>
      typeof a === 'number' ? a + b : undefined
    )
  );
};

export const recordRooms = () => {
  recordStats({
    rooms: _.mapValues(
      _.pick<Record<string, Room>, Record<string, Room>>(
        Game.rooms,
        (room) => room.controller?.my
      ),
      (room) => ({
        energyAvailable: room.energyAvailable,
        energyCapacityAvailable: room.energyCapacityAvailable,
        controllerProgress: room.controller?.progress,
        controllerProgressTotal: room.controller?.progressTotal,
        controllerLevel: room.controller?.level,
      })
    ),
  });
};

export const recordGCL = () => {
  recordStats({
    gcl: {
      progress: Game.gcl.progress,
      progressTotal: Game.gcl.progressTotal,
      level: Game.gcl.level,
    },
  });
};

export const recordCPU = () => {
  recordStats({
    cpu: {
      bucket: Game.cpu.bucket,
      limit: Game.cpu.limit,
      used: Game.cpu.getUsed(),
    },
  });
};

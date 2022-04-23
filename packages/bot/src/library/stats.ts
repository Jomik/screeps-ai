import { getMemoryRef } from './memory';

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
    _.merge(
      statsRef.get(),
      stats,
      (a: number | StatsRecord, b: StatsRecord | number) =>
        typeof a === 'number' && typeof b === 'number' ? a + b : undefined
    )
  );
};

export const recordGlobals = () => {
  const rooms = _.mapValues(
    _.pick<Record<string, Room>, Record<string, Room>>(
      Game.rooms,
      (room: Room) => room.controller?.my
    ),
    (room) => ({
      energyAvailable: room.energyAvailable,
      energyCapacityAvailable: room.energyCapacityAvailable,
      controllerProgress: room.controller?.progress,
      controllerProgressTotal: room.controller?.progressTotal,
      controllerLevel: room.controller?.level,
    })
  );
  const heap = Game.cpu.getHeapStatistics?.();

  recordStats({
    rooms,
    gcl: {
      progress: Game.gcl.progress,
      progressTotal: Game.gcl.progressTotal,
      level: Game.gcl.level,
    },
    cpu: {
      bucket: Game.cpu.bucket,
      limit: Game.cpu.limit,
      used: Game.cpu.getUsed(),
    },
    heap: {
      used: heap?.used_heap_size,
      limit: heap?.total_available_size,
    },
    memory: {
      used: RawMemory.get().length,
    },
  });
};

import { getMemoryRef } from 'kernel/memory';

export const updateStats = () => {
  const stats = getMemoryRef<{
    time: number;
    gcl: Record<string, number>;
    cpu: Record<string, number>;
    rooms: Record<string, Record<string, number | undefined>>;
  }>('stats', {
    time: 0,
    gcl: {},
    rooms: {},
    cpu: {},
  });
  stats.gcl = {};
  stats.cpu = {};
  stats.rooms = {};

  stats.time = Game.time;

  // Collect room stats
  for (let roomName in Game.rooms) {
    const room = Game.rooms[roomName];
    const isMyRoom = room.controller ? room.controller.my : false;
    if (isMyRoom) {
      stats.rooms[roomName] = {
        energyAvailable: room.energyAvailable,
        energyCapacityAvailable: room.energyCapacityAvailable,
        controllerProgress: room.controller?.progress,
        controllerProgressTotal: room.controller?.progressTotal,
        controllerLevel: room.controller?.level,
      };
    }
  }

  // Collect GCL stats
  stats.gcl = {
    progress: Game.gcl.progress,
    progressTotal: Game.gcl.progressTotal,
    level: Game.gcl.level,
  };

  // Collect CPU stats
  stats.cpu = {
    bucket: Game.cpu.bucket,
    limit: Game.cpu.limit,
    used: Game.cpu.getUsed(),
  };
};

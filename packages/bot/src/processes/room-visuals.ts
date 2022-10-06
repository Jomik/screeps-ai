import { createProcess, exit, malloc, sleep, Thread } from 'kernel';
import { registerCommand } from '../library/console';
import { getRoomPlan } from '../library/room-planning';
import { overlayCostMatrix } from '../library/visualize-cost-matrix';

type Opts = {
  show: boolean;
  dt: boolean;
  buildings: boolean;
};

function* getOpts(
  roomName: string
): Thread<[opts: Opts, extra: { rerender: boolean }]> {
  const { value: opts } = yield* malloc<Opts>('opts', {
    show: true,
    dt: false,
    buildings: true,
  });
  const extra = { rerender: true };

  registerCommand('toggleVisuals', () => {
    opts.show = !opts.show;

    extra.rerender = true;
    return `${opts.show ? 'Enabled' : 'Disabled'} room visuals for ${roomName}`;
  });

  registerCommand('toggleDT', () => {
    opts.dt = !opts.dt;
    if (opts.dt) {
      opts.show = true;
    }

    extra.rerender = true;
    return `${opts.dt ? 'Enabled' : 'Disabled'} DT visuals in ${roomName}`;
  });

  registerCommand('toggleBuildings', () => {
    opts.buildings = !opts.buildings;
    if (opts.buildings) {
      opts.show = true;
    }

    extra.rerender = true;
    return `${
      opts.buildings ? 'Enabled' : 'Disabled'
    } building visuals in ${roomName}`;
  });

  return [opts, extra];
}

export const roomVisuals = createProcess(function* (roomName: string) {
  const [opts, extra] = yield* getOpts(roomName);

  for (;;) {
    while (!opts.show) {
      yield* sleep();
    }
    const plan = getRoomPlan(roomName);
    if (plan.state !== 'done') {
      yield* sleep();
      continue;
    }
    const room = Game.rooms[roomName];
    if (!room) {
      return exit(`No vision on room ${roomName}`);
    }

    // DT visuals
    if (opts.dt) {
      room.visual.import(
        overlayCostMatrix(plan.buildingSpace, (value) => value / 13)
      );
    }

    if (opts.buildings) {
      for (const [type, x, y] of plan.structures) {
        room.visual.structure(x, y, type, { opacity: 0.5 });
      }
      room.visual.connectRoads();
    }
    const visuals = room.visual.export() ?? '';
    room.visual.clear();
    extra.rerender = false;

    yield* sleep();

    while (
      getRoomPlan(roomName).lastChange === plan.lastChange &&
      opts.show &&
      !extra.rerender
    ) {
      try {
        room.visual.import(visuals);
      } catch (err) {
        //ignore
      }

      yield* sleep();
    }
  }
});

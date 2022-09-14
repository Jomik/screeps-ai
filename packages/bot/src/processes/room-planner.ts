import { Thread, createProcess, exit } from 'kernel';
import { createLogger, distanceTransform } from '../library';
import {
  Coordinates,
  getRoomPlan,
  RoomPlan,
  saveRoomPlan,
} from '../library/room';
import { expandPosition } from '../utils';

const logger = createLogger('room-planner');

function* planStorage(plan: RoomPlan): Thread<void> {
  let candidates: Coordinates[] = [];
  let bestDistance = 0;
  for (let x = 0; x <= 49; ++x) {
    for (let y = 0; y <= 49; ++y) {
      const dist = plan.distanceTransform.get(x, y);
      if (bestDistance < dist) {
        candidates = [[x, y]];
        bestDistance = dist;
      } else if (bestDistance == dist) {
        candidates.push([x, y]);
      }
    }
  }
  yield;
  const room = Game.rooms[plan.roomName];
  if (!room) {
    return exit(`No vision in room ${plan.roomName}`);
  }
  const sources = room.find(FIND_SOURCES);

  let sourceCost = Infinity;
  let bestPos: Coordinates = [0, 0];
  for (const [x, y] of candidates) {
    const cost = sources.reduce(
      (acc, cur) =>
        acc +
        PathFinder.search(
          new RoomPosition(x, y, room.name),
          { pos: cur.pos, range: 1 },
          {
            swampCost: 10,
            plainCost: 2,
          }
        ).cost,
      0
    );
    if (cost < sourceCost) {
      sourceCost = cost;
      bestPos = [x, y];
    }
    yield;
  }

  plan.structures.storage = [bestPos];
  plan.base.set(bestPos[0], bestPos[1], Infinity);
}
function* planRoadsToPOI(plan: RoomPlan): Thread<void> {
  const center = plan.structures.storage?.[0];
  if (!center) {
    return exit(`No storage planned for ${plan.roomName}`);
  }
  const room = Game.rooms[plan.roomName];
  if (!room) {
    return exit(`No vision in room ${plan.roomName}`);
  }
  const [centerX, centerY] = center;
  const centerPos = new RoomPosition(centerX, centerY, plan.roomName);
  const { controller } = room;
  if (!controller) {
    return exit(`No controller in room ${plan.roomName}`);
  }

  const sources = room.find(FIND_SOURCES);
  const poi = [
    ...sources.map(({ pos }) => ({ pos, range: 1 })),
    { pos: controller.pos, range: 3 },
  ];

  const roads: Coordinates[] = expandPosition([centerX, centerY]).filter(
    ([x, y]) => plan.base.get(x, y) === 0
  );
  roads.forEach(([x, y]) => {
    plan.base.set(x, y, 1);
  });
  for (const target of poi) {
    const res = PathFinder.search(centerPos, target, {
      roomCallback: () => plan.base,
      maxRooms: 1,
      plainCost: 2,
      swampCost: 10,
    });
    if (res.incomplete) {
      logger.warn(`No path to ${JSON.stringify(target.pos)}`);
      continue;
    }
    roads.push(...res.path.map<Coordinates>(({ x, y }) => [x, y]));
    res.path.forEach((pos) => {
      plan.base.set(pos.x, pos.y, 1);
    });
  }

  plan.structures[STRUCTURE_ROAD] ??= [];
  plan.structures[STRUCTURE_ROAD]?.push(...roads);
}

function* planExtensions(plan: RoomPlan): Thread<void> {
  const center = plan.structures.storage?.[0];
  if (!center) {
    return exit(`No storage planned for ${plan.roomName}`);
  }
  const [centerX, centerY] = center;
  const room = Game.rooms[plan.roomName];
  if (!room) {
    return exit(`No vision in room ${plan.roomName}`);
  }
  const count = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][8] ?? 0;

  const dirX = 1;
  const dirY = -1;

  const seed: Coordinates = [centerX + dirX, centerY + dirY];

  const roads: Coordinates[] = [];
  const extensions: Coordinates[] = [];

  const planExtension = ([x, y]: Coordinates) => {
    if (plan.base.get(x, y) !== 0) {
      return;
    }
    extensions.push([x, y]);
  };

  let point = seed;
  let rows = 0;
  while (extensions.length < count) {
    point = [point[0] + dirX, point[1] + dirY];
    const [x, y] = point;
    if (plan.distanceTransform.get(x, y) <= 1) {
      rows += 3;
      point = [seed[0] + dirX * (rows - 1), seed[1] - dirY * rows];
      continue;
    }

    roads.push(point);

    planExtension([x + dirX, y]);
    planExtension([x, y + dirY]);
    planExtension([x + dirX, y - dirY]);
    planExtension([x - dirX, y + dirY]);
  }

  plan.structures[STRUCTURE_ROAD] ??= [];
  plan.structures[STRUCTURE_ROAD]?.push(...roads);
  plan.structures[STRUCTURE_EXTENSION] = extensions;
  saveRoomPlan(plan, 'done');
}

export const roomPlanner = createProcess(function* (roomName: string) {
  const room = Game.rooms[roomName];
  if (!room) {
    return exit(`No vision in room ${roomName}`);
  }

  const plan = getRoomPlan(roomName);
  const spawns = room.find(FIND_MY_SPAWNS);
  plan.structures[STRUCTURE_SPAWN] = spawns.map(({ pos }) => [pos.x, pos.y]);
  spawns.forEach(({ pos }) => plan.base.set(pos.x, pos.y, 255));
  saveRoomPlan(plan, 'initial');

  // Set up distance transform
  const terrain = room.getTerrain();

  for (let x = 0; x <= 49; ++x) {
    for (let y = 0; y <= 49; ++y) {
      plan.distanceTransform.set(
        x,
        y,
        terrain.get(x, y) & TERRAIN_MASK_WALL ? 0 : Infinity
      );
    }
  }

  yield* distanceTransform(
    {
      x: [0, 49],
      y: [0, 49],
    },
    plan.distanceTransform
  );
  saveRoomPlan(plan, 'done');

  yield* planStorage(plan);
  saveRoomPlan(plan, 'done');
  yield;

  yield* planRoadsToPOI(plan);
  yield;

  yield* planExtensions(plan);
  saveRoomPlan(plan, 'done');

  return;
});

// const roomPlannerOld = createProcess(function* (roomName: string) {
//   const costMatrix = new PathFinder.CostMatrix();
//   const room = (): Room => {
//     // TODO
//     // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
//     return Game.rooms[roomName]!;
//   };

//   // TODO
//   const center: RoomPosition =
//     room().find(FIND_MY_SPAWNS)[0]?.pos ?? new RoomPosition(25, 25, roomName);

//   const search = (
//     target: RoomPosition,
//     range: number,
//     costMatrix: CostMatrix
//   ): PathFinderPath => {
//     return PathFinder.search(
//       center,
//       { pos: target, range },
//       {
//         swampCost: 10,
//         plainCost: 2,
//         roomCallback: () => costMatrix,
//       }
//     );
//   };

//   const runPathsPlan = function* (
//     nodes: { pos: RoomPosition; range: number }[]
//   ): Thread<RoomPosition[][]> {
//     const costMatrix = new PathFinder.CostMatrix();

//     const finalPaths: RoomPosition[][] = [];
//     for (const node of nodes) {
//       const res = search(node.pos, node.range, costMatrix);
//       const flatPaths = finalPaths.flat();
//       const path = res.path.filter(
//         ({ x, y }) => !flatPaths.some((p) => p.x === x && p.y === y)
//       );
//       finalPaths.push(path);
//       path.forEach(({ x, y }) => costMatrix.set(x, y, 1));

//       yield;
//     }

//     return finalPaths;
//   };

//   const findSourceContainers = (
//     sources: RoomPosition[],
//     paths: RoomPosition[][]
//   ): Array<RoomPosition | null> => {
//     const terrain = room().getTerrain();
//     return sources.map((target) => {
//       const endPoint = target.findClosestByRange(paths.flat());
//       if (!endPoint) {
//         return null;
//       }

//       const spots = expandPosition(target).filter(
//         (pos) => terrain.get(pos.x, pos.y) ^ TERRAIN_MASK_WALL
//       );
//       return endPoint.findClosestByRange(spots);
//     });
//   };

//   const getControllerContainer = (
//     paths: RoomPosition[][]
//   ): RoomPosition | null => {
//     const target = room().controller?.pos;
//     if (!target) {
//       return null;
//     }

//     const endPoint = target.findClosestByRange(paths.flat());
//     if (!endPoint) {
//       return null;
//     }

//     const spots = expandPosition(endPoint);
//     return target.findClosestByRange(
//       spots.filter((spot) => spot.getRangeTo(target) >= 3)
//     );
//   };

//   const drawRoomVisuals = (
//     paths: RoomPosition[][],
//     containers: RoomPosition[],
//     dt: CostMatrix
//   ) => {
//     for (const { x, y } of paths.flat()) {
//       if (room().lookForAt(LOOK_STRUCTURES, x, y).length === 0) {
//         room().visual.structure(x, y, STRUCTURE_ROAD, { opacity: 0.3 });
//       }
//     }
//     room().visual.connectRoads({ opacity: 0.5 });

//     for (const { x, y } of containers) {
//       if (room().lookForAt(LOOK_STRUCTURES, x, y).length === 0) {
//         room().visual.structure(x, y, STRUCTURE_CONTAINER, { opacity: 0.5 });
//       }
//     }

//     // DT visuals
//     // for (let x = 0; x <= 49; ++x) {
//     //   for (let y = 0; y <= 49; ++y) {
//     //     room().visual.text(dt.get(x, y).toString(), x, y);
//     //     room().visual.rect(x - 0.5, y - 0.5, 1, 1, {
//     //       fill: `hsl(${200 + dt.get(x, y) * 10}, 100%, 60%)`,
//     //       opacity: 0.4,
//     //     });
//     //   }
//     // }
//   };

//   const sources = room()
//     .find(FIND_SOURCES)
//     .sort(
//       (a, b) =>
//         search(a.pos, 1, costMatrix).cost - search(b.pos, 1, costMatrix).cost
//     )
//     .map((s) => ({ pos: s.pos, range: 2 }));
//   const nodeRoom = room();
//   const nodes = sources.concat(
//     nodeRoom.controller ? { pos: nodeRoom.controller?.pos, range: 3 } : []
//   );
//   const prelimPaths = yield* runPathsPlan(nodes);

//   const containers = findSourceContainers(
//     sources.map(({ pos }) => pos),
//     prelimPaths
//   )
//     .concat(getControllerContainer(prelimPaths))
//     .filter(<T>(v: T | null): v is T => !!v);
//   yield;

//   const paths = yield* runPathsPlan(
//     containers.map((cont) => ({ pos: cont, range: 1 }))
//   );
//   yield;

//   const dt = yield* wallDistances(room());

//   for (;;) {
//     yield* sleep();
//     drawRoomVisuals(paths, containers, dt);

//     const containerSites = containers.filter(
//       (pos) => room().lookForAt(LOOK_STRUCTURES, pos).length === 0
//     );
//     if (containerSites.length > 0) {
//       containerSites.forEach((site) =>
//         room().createConstructionSite(site.x, site.y, STRUCTURE_CONTAINER)
//       );
//       continue;
//     }

//     if (room().find(FIND_CONSTRUCTION_SITES).length > 5) {
//       continue;
//     }

//     const path = paths
//       .flatMap((p) => p)
//       .find((pos) => room().lookForAt(LOOK_STRUCTURES, pos).length === 0);
//     if (path) {
//       room().createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
//       continue;
//     }
//   }
// });

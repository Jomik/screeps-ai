import { Thread, sleep, createProcess } from 'kernel';
import { distanceTransform } from '../library';
import { expandPosition } from '../utils';

// prettier-ignore
function* wallDistances(room: Room): Thread<CostMatrix> {
  const costMatrix = new PathFinder.CostMatrix();

  // Initialize terrain
  const terrain = room.getTerrain();
  for (let x = 0; x <= 49; ++x) {
    for (let y = 0; y <= 49; ++y) {
      costMatrix.set(
        x,
        y,
        terrain.get(x, y) & TERRAIN_MASK_WALL ? 0 : Infinity
      );
    }
  }

  return yield* distanceTransform({ x: [0, 49], y: [0, 49] }, costMatrix);
}

export const roomPlanner = createProcess(function* (roomName: string) {
  const costMatrix = new PathFinder.CostMatrix();
  const room = (): Room => {
    // TODO
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return Game.rooms[roomName]!;
  };

  // TODO
  const center: RoomPosition =
    room().find(FIND_MY_SPAWNS)[0]?.pos ?? new RoomPosition(25, 25, roomName);

  const search = (
    target: RoomPosition,
    range: number,
    costMatrix: CostMatrix
  ): PathFinderPath => {
    return PathFinder.search(
      center,
      { pos: target, range },
      {
        swampCost: 10,
        plainCost: 2,
        roomCallback: () => costMatrix,
      }
    );
  };

  const runPathsPlan = function* (
    nodes: { pos: RoomPosition; range: number }[]
  ): Thread<RoomPosition[][]> {
    const costMatrix = new PathFinder.CostMatrix();

    const finalPaths: RoomPosition[][] = [];
    for (const node of nodes) {
      const res = search(node.pos, node.range, costMatrix);
      const flatPaths = finalPaths.flat();
      const path = res.path.filter(
        ({ x, y }) => !flatPaths.some((p) => p.x === x && p.y === y)
      );
      finalPaths.push(path);
      path.forEach(({ x, y }) => costMatrix.set(x, y, 1));

      yield;
    }

    return finalPaths;
  };

  const findSourceContainers = (
    sources: RoomPosition[],
    paths: RoomPosition[][]
  ): Array<RoomPosition | null> => {
    const terrain = room().getTerrain();
    return sources.map((target) => {
      const endPoint = target.findClosestByRange(paths.flat());
      if (!endPoint) {
        return null;
      }

      const spots = expandPosition(target).filter(
        (pos) => terrain.get(pos.x, pos.y) ^ TERRAIN_MASK_WALL
      );
      return endPoint.findClosestByRange(spots);
    });
  };

  const getControllerContainer = (
    paths: RoomPosition[][]
  ): RoomPosition | null => {
    const target = room().controller?.pos;
    if (!target) {
      return null;
    }

    const endPoint = target.findClosestByRange(paths.flat());
    if (!endPoint) {
      return null;
    }

    const spots = expandPosition(endPoint);
    return target.findClosestByRange(
      spots.filter((spot) => spot.getRangeTo(target) >= 3)
    );
  };

  const drawRoomVisuals = (
    paths: RoomPosition[][],
    containers: RoomPosition[],
    dt: CostMatrix
  ) => {
    for (const { x, y } of paths.flat()) {
      if (room().lookForAt(LOOK_STRUCTURES, x, y).length === 0) {
        room().visual.structure(x, y, STRUCTURE_ROAD, { opacity: 0.3 });
      }
    }
    room().visual.connectRoads({ opacity: 0.5 });

    for (const { x, y } of containers) {
      if (room().lookForAt(LOOK_STRUCTURES, x, y).length === 0) {
        room().visual.structure(x, y, STRUCTURE_CONTAINER, { opacity: 0.5 });
      }
    }

    // DT visuals
    // for (let x = 0; x <= 49; ++x) {
    //   for (let y = 0; y <= 49; ++y) {
    //     room().visual.text(dt.get(x, y).toString(), x, y);
    //     room().visual.rect(x - 0.5, y - 0.5, 1, 1, {
    //       fill: `hsl(${200 + dt.get(x, y) * 10}, 100%, 60%)`,
    //       opacity: 0.4,
    //     });
    //   }
    // }
  };

  const sources = room()
    .find(FIND_SOURCES)
    .sort(
      (a, b) =>
        search(a.pos, 1, costMatrix).cost - search(b.pos, 1, costMatrix).cost
    )
    .map((s) => ({ pos: s.pos, range: 2 }));
  const nodeRoom = room();
  const nodes = sources.concat(
    nodeRoom.controller ? { pos: nodeRoom.controller?.pos, range: 3 } : []
  );
  const prelimPaths = yield* runPathsPlan(nodes);

  const containers = findSourceContainers(
    sources.map(({ pos }) => pos),
    prelimPaths
  )
    .concat(getControllerContainer(prelimPaths))
    .filter(<T>(v: T | null): v is T => !!v);
  yield;

  const paths = yield* runPathsPlan(
    containers.map((cont) => ({ pos: cont, range: 1 }))
  );
  yield;

  const dt = yield* wallDistances(room());

  for (;;) {
    yield* sleep();
    drawRoomVisuals(paths, containers, dt);

    const containerSites = containers.filter(
      (pos) => room().lookForAt(LOOK_STRUCTURES, pos).length === 0
    );
    if (containerSites.length > 0) {
      containerSites.forEach((site) =>
        room().createConstructionSite(site.x, site.y, STRUCTURE_CONTAINER)
      );
      continue;
    }

    if (room().find(FIND_CONSTRUCTION_SITES).length > 5) {
      continue;
    }

    const path = paths
      .flatMap((p) => p)
      .find((pos) => room().lookForAt(LOOK_STRUCTURES, pos).length === 0);
    if (path) {
      room().createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
      continue;
    }
  }
});

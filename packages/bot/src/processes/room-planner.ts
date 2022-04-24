import { Thread, sleep, createProcess } from 'os';
import { expandPosition } from '../utils';

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
      if (!node.pos) {
        continue;
      }
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
    containers: RoomPosition[]
  ) => {
    for (const { x, y } of paths.flat()) {
      room().visual.structure(x, y, STRUCTURE_ROAD, { opacity: 0.3 });
    }
    room().visual.connectRoads({ opacity: 0.5 });

    for (const { x, y } of containers) {
      room().visual.structure(x, y, STRUCTURE_CONTAINER, { opacity: 0.5 });
    }
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
  const paths = yield* runPathsPlan(nodes);

  const containers = findSourceContainers(
    sources.map(({ pos }) => pos),
    paths
  )
    .concat(getControllerContainer(paths))
    .filter(<T>(v: T | null): v is T => !!v);
  yield;

  for (;;) {
    yield* sleep();
    drawRoomVisuals(paths, containers);

    const containerSites = containers.filter(
      (pos) => room().lookForAt(LOOK_STRUCTURES, pos).length === 0
    );
    if (containerSites.length > 0) {
      containerSites.forEach((site) =>
        room().createConstructionSite(site.x, site.y, STRUCTURE_CONTAINER)
      );
      continue;
    }

    if (room().find(FIND_CONSTRUCTION_SITES).length > 0) {
      continue;
    }

    const path = containers.find(
      (pos) => room().lookForAt(LOOK_STRUCTURES, pos).length === 0
    );
    if (path) {
      room().createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
      continue;
    }
  }
});

import { Process, Thread, sleep } from 'kernel';
import { expandPosition } from 'utils/position';

export class RoomPlanner extends Process {
  private get center(): RoomPosition {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return Game.spawns['Spawn1']!.pos;
  }

  private get room(): Room {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return Game.rooms[this.center.roomName]!;
  }

  private search(
    target: RoomPosition,
    range: number,
    costMatrix: CostMatrix
  ): PathFinderPath {
    return PathFinder.search(
      this.center,
      { pos: target, range },
      {
        swampCost: 10,
        plainCost: 2,
        roomCallback: () => costMatrix,
      }
    );
  }

  private *runPathsPlan(
    nodes: { pos: RoomPosition; range: number }[]
  ): Thread<RoomPosition[][]> {
    const costMatrix = new PathFinder.CostMatrix();

    const finalPaths: RoomPosition[][] = [];
    for (const node of nodes) {
      if (!node.pos) {
        continue;
      }
      const res = this.search(node.pos, node.range, costMatrix);
      const flatPaths = finalPaths.flat();
      const path = res.path.filter(
        ({ x, y }) => !flatPaths.some((p) => p.x === x && p.y === y)
      );
      finalPaths.push(path);
      path.forEach(({ x, y }) => costMatrix.set(x, y, 1));

      yield;
    }
    return finalPaths;
  }

  private findSourceContainers(
    sources: RoomPosition[],
    paths: RoomPosition[][]
  ): Array<RoomPosition | null> {
    const terrain = this.room.getTerrain();
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
  }

  private getControllerContainer(paths: RoomPosition[][]): RoomPosition | null {
    const target = this.room.controller?.pos;
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
  }

  private drawRoomVisuals(paths: RoomPosition[][], containers: RoomPosition[]) {
    for (const { x, y } of paths.flat()) {
      this.room.visual.structure(x, y, STRUCTURE_ROAD, { opacity: 0.3 });
    }
    this.room.visual.connectRoads({ opacity: 0.5 });

    for (const { x, y } of containers) {
      this.room.visual.structure(x, y, STRUCTURE_CONTAINER, { opacity: 0.5 });
    }
  }

  *run(): Thread {
    const costMatrix = new PathFinder.CostMatrix();

    const sources = this.room
      .find(FIND_SOURCES)
      .sort(
        (a, b) =>
          this.search(a.pos, 1, costMatrix).cost -
          this.search(b.pos, 1, costMatrix).cost
      )
      .map((s) => ({ pos: s.pos, range: 2 }));
    const nodes = sources.concat(
      this.room.controller ? { pos: this.room.controller.pos, range: 3 } : []
    );
    const paths = yield* this.runPathsPlan(nodes);

    const containers = this.findSourceContainers(
      sources.map(({ pos }) => pos),
      paths
    )
      .concat(this.getControllerContainer(paths))
      .filter(<T>(v: T | null): v is T => !!v);
    yield;

    for (;;) {
      yield* sleep();
      this.drawRoomVisuals(paths, containers);

      const containerSites = containers.filter(
        (pos) => this.room.lookForAt(LOOK_STRUCTURES, pos).length === 0
      );
      if (containerSites.length > 0) {
        containerSites.forEach((site) =>
          this.room.createConstructionSite(site.x, site.y, STRUCTURE_CONTAINER)
        );
        continue;
      }

      if (this.room.find(FIND_CONSTRUCTION_SITES).length > 0) {
        continue;
      }

      const path = containers.find(
        (pos) => this.room.lookForAt(LOOK_STRUCTURES, pos).length === 0
      );
      if (path) {
        this.room.createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
        continue;
      }
    }
  }
}

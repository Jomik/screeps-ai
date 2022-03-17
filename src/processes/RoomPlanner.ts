import { Process, Thread } from 'kernel/Process';
import { sleep } from 'kernel/sys-calls';
import { expandPosition } from 'utils/position';

export class RoomPlanner extends Process<undefined> {
  private get center(): RoomPosition {
    return Game.spawns['Spawn1'].pos;
  }

  private get room(): Room {
    return Game.rooms[this.center.roomName];
  }

  public search(
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

  *runPathsPlan(
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

    const containers = nodes
      .map(({ pos: target, range }) => {
        const endPoint = target.findClosestByRange(paths.flat());
        if (!endPoint) {
          return null;
        }
        const spots = expandPosition(endPoint);
        return target.findClosestByRange(
          spots.filter((spot) => spot.getRangeTo(target) >= range)
        );
      })
      .filter(<T>(v: T | null): v is T => !!v);
    yield;

    for (const { x, y } of paths.flat()) {
      this.room.visual.structure(x, y, STRUCTURE_ROAD, { opacity: 0.3 });
    }
    this.room.visual.connectRoads({ opacity: 0.5 });

    for (const { x, y } of containers) {
      this.room.visual.structure(x, y, STRUCTURE_CONTAINER, { opacity: 0.5 });
    }

    const visuals = this.room.visual.export();

    while (true) {
      yield* sleep();
      this.room.visual.import(visuals);

      if (this.room.find(FIND_CONSTRUCTION_SITES).length > 0) {
        continue;
      }

      const container = containers.find(
        (pos) => this.room.lookForAt(LOOK_STRUCTURES, pos).length === 0
      );
      if (container) {
        this.room.createConstructionSite(
          container.x,
          container.y,
          STRUCTURE_CONTAINER
        );
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

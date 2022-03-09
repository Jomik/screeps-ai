import { Process } from 'kernel/Process';
import { sleep } from 'kernel/sys-calls';

export class BasePlanner extends Process<undefined> {
  private center: RoomPosition;
  private costMatrix = new PathFinder.CostMatrix();

  constructor(memory: undefined) {
    super(memory);
    const spawn = Game.spawns['Spawn1'];
    this.center = spawn.pos;
  }

  private get room() {
    return Game.rooms[this.center.roomName];
  }

  private search(pos: RoomPosition, range = 1): PathFinderPath {
    return PathFinder.search(
      this.center,
      { pos, range },
      {
        swampCost: 10,
        plainCost: 2,
        roomCallback: () => this.costMatrix,
      }
    );
  }

  *run() {
    const sources = this.room
      .find(FIND_SOURCES)
      .sort((a, b) => this.search(a.pos).cost - this.search(b.pos).cost)
      .map((s) => ({ pos: s.pos, range: 2 }));
    yield;

    const nodes = [...sources, { pos: this.room.controller?.pos, range: 3 }];

    const paths: RoomPosition[][] = [];

    for (const node of nodes) {
      if (!node.pos) {
        continue;
      }
      const res = this.search(node.pos, node.range);
      const flatPaths = paths.flat();
      const path = res.path.filter(
        ({ x, y }) =>
          !flatPaths.some((p) => p.x === x && p.y === y) &&
          !this.room
            .lookAt(x, y)
            .some(
              (r) =>
                !!r.constructionSite ||
                r.structure?.structureType === STRUCTURE_ROAD
            )
      );
      paths.push(path);
      path.forEach(({ x, y }) => this.costMatrix.set(x, y, 1));

      yield;
    }

    while (paths.length > 0) {
      const sites = this.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: (cs) => cs.structureType === STRUCTURE_ROAD,
      });
      if (sites.length === 0) {
        const path = paths.shift();
        path?.map(({ x, y }) =>
          this.room.createConstructionSite(x, y, STRUCTURE_ROAD)
        );
      }

      for (const path of paths) {
        this.room.visual.poly(path, { opacity: 0.75, stroke: '#00FF00' });
      }

      yield sleep();
    }
  }
}

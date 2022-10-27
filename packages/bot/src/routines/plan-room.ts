import { Routine } from 'coroutines';
import { SubRoutine } from 'coroutines';
import {
  calculateDistanceTransform,
  Coordinates,
  coordinatesToNumber,
  createLogger,
  expandPosition,
  numberToCoordinates,
} from '../library';
import { chooseBaseOrigin } from '../library/base-origin';
import { sleep } from '../library/sleep';
import { overlayCostMatrix } from '../library/visualize-cost-matrix';
import { go } from '../runner';
import { isDefined, MaxControllerLevel, min } from '../utils';

const logger = createLogger('room-planner');

const RoadCost = 1;
const ContainerCost = 2;

function* getRoadTo(
  origin: Coordinates,
  target: Coordinates,
  roomName: string,
  navigation: CostMatrix
): SubRoutine<Coordinates[]> {
  const room = Game.rooms[roomName];
  if (!room) {
    return [];
    // return exit(`No vision in room ${roomName}`);
  }

  const originPos = new RoomPosition(origin[0], origin[1], roomName);
  const res = PathFinder.search(
    originPos,
    { pos: new RoomPosition(target[0], target[1], roomName), range: 1 },
    {
      roomCallback: () => navigation,
      maxRooms: 1,
      plainCost: 2,
      swampCost: 10,
    }
  );
  if (res.incomplete) {
    logger.warn(`No path to ${JSON.stringify(target)}`);
    return [];
  }

  return res.path.map(({ x, y }) => [x, y]);
}

type Stamp = Array<BuildableStructureConstant | EMPTY | BLOCKED>[];
type StructurePlacement = [
  BuildableStructureConstant | EMPTY | BLOCKED,
  ...Coordinates
];

const EMPTY = 'empty';
type EMPTY = typeof EMPTY;
const BLOCKED = 'blocked';
type BLOCKED = typeof BLOCKED;

// prettier-ignore
const HubStamp: Stamp = [
  [EMPTY        ,STRUCTURE_ROAD      ,STRUCTURE_ROAD      ,STRUCTURE_ROAD      ,STRUCTURE_ROAD      ,STRUCTURE_ROAD      ,EMPTY]        ,
  [STRUCTURE_ROAD ,STRUCTURE_EXTENSION ,STRUCTURE_EXTENSION ,STRUCTURE_EXTENSION ,STRUCTURE_EXTENSION ,STRUCTURE_EXTENSION ,STRUCTURE_ROAD] ,
  [STRUCTURE_ROAD ,STRUCTURE_SPAWN     ,BLOCKED           ,STRUCTURE_EXTENSION ,BLOCKED           ,STRUCTURE_SPAWN     ,STRUCTURE_ROAD] ,
  [STRUCTURE_ROAD ,STRUCTURE_CONTAINER ,STRUCTURE_EXTENSION ,STRUCTURE_LINK      ,STRUCTURE_EXTENSION ,STRUCTURE_CONTAINER ,STRUCTURE_ROAD] ,
  [STRUCTURE_ROAD ,STRUCTURE_EXTENSION ,BLOCKED           ,STRUCTURE_EXTENSION ,BLOCKED           ,STRUCTURE_EXTENSION ,STRUCTURE_ROAD] ,
  [STRUCTURE_ROAD ,STRUCTURE_EXTENSION ,STRUCTURE_EXTENSION ,STRUCTURE_SPAWN     ,STRUCTURE_EXTENSION ,STRUCTURE_EXTENSION ,STRUCTURE_ROAD] ,
  [EMPTY        ,STRUCTURE_ROAD      ,STRUCTURE_ROAD      ,STRUCTURE_ROAD      ,STRUCTURE_ROAD      ,STRUCTURE_ROAD      ,EMPTY]
];

// prettier-ignore
const Lab1Stamp: Stamp = [
  [STRUCTURE_ROAD , STRUCTURE_LAB  , STRUCTURE_LAB  , EMPTY]       ,
  [STRUCTURE_LAB  , STRUCTURE_ROAD , STRUCTURE_LAB  , STRUCTURE_LAB] ,
  [STRUCTURE_LAB  , STRUCTURE_LAB  , STRUCTURE_ROAD , STRUCTURE_LAB] ,
  [EMPTY        , STRUCTURE_LAB  , STRUCTURE_LAB  , STRUCTURE_ROAD] ,
];

// prettier-ignore
const Lab2Stamp: Stamp = [
  [BLOCKED      , STRUCTURE_LAB  , STRUCTURE_LAB  , BLOCKED]      ,
  [STRUCTURE_LAB  , STRUCTURE_LAB  , STRUCTURE_LAB  , STRUCTURE_LAB]  ,
  [STRUCTURE_LAB  , STRUCTURE_LAB  , STRUCTURE_LAB  , STRUCTURE_LAB]  ,
];

// prettier-ignore
const ExtensionPlusStamp: Stamp = [
  [EMPTY        ,EMPTY             ,STRUCTURE_ROAD      ,EMPTY             ,EMPTY]        ,
  [EMPTY        ,STRUCTURE_ROAD      ,STRUCTURE_EXTENSION ,STRUCTURE_ROAD      ,EMPTY]        ,
  [STRUCTURE_ROAD ,STRUCTURE_EXTENSION ,STRUCTURE_EXTENSION ,STRUCTURE_EXTENSION ,STRUCTURE_ROAD] ,
  [EMPTY        ,STRUCTURE_ROAD      ,STRUCTURE_EXTENSION ,STRUCTURE_ROAD      ,EMPTY]        ,
  [EMPTY        ,EMPTY             ,STRUCTURE_ROAD      ,EMPTY             ,EMPTY]
];

// prettier-ignore
const StorageStamp: Stamp = [
  [EMPTY        , STRUCTURE_ROAD    , STRUCTURE_ROAD     , EMPTY]        ,
  [STRUCTURE_ROAD , STRUCTURE_STORAGE , STRUCTURE_TERMINAL , STRUCTURE_ROAD] ,
  [STRUCTURE_ROAD , STRUCTURE_FACTORY , STRUCTURE_ROAD     , EMPTY]        ,
  [EMPTY        , STRUCTURE_ROAD    , EMPTY            , EMPTY]        ,
];

const Stamps: Array<[count: number, stamps: Stamp[]]> = [
  [1, [HubStamp]],
  [1, [Lab1Stamp, Lab2Stamp]],
  [1, [StorageStamp]],
  [9, [ExtensionPlusStamp]],
  [1, [[[STRUCTURE_POWER_SPAWN]]]],
  [1, [[[STRUCTURE_NUKER]]]],
  [1, [[[STRUCTURE_OBSERVER]]]],
  [6, [[[STRUCTURE_TOWER]]]],
];

const getBuildingSpace = (room: Room): CostMatrix => {
  const terrain = room.getTerrain();
  const cm = new PathFinder.CostMatrix();

  // Block off tiles around exit tiles.
  for (const { x, y } of room.find(FIND_EXIT)) {
    [[x, y] as Coordinates, ...expandPosition([x, y])].forEach(([x, y]) =>
      cm.set(x, y, 1)
    );
  }

  // Block off tiles around sources.
  for (const {
    pos: { x, y },
  } of room.find(FIND_SOURCES)) {
    [[x, y] as Coordinates, ...expandPosition([x, y])].forEach(([x, y]) =>
      cm.set(x, y, 254)
    );
  }

  // Block off tiles around minerals.
  for (const {
    pos: { x, y },
  } of room.find(FIND_MINERALS)) {
    [[x, y] as Coordinates, ...expandPosition([x, y])].forEach(([x, y]) =>
      cm.set(x, y, 254)
    );
  }

  // Block off tiles around controller.
  if (room.controller) {
    const { x, y } = room.controller.pos;
    [[x, y] as Coordinates, ...expandPosition([x, y])].forEach(([x, y]) =>
      cm.set(x, y, 254)
    );
  }

  // Set walls to 0 and rest to Infinity.
  for (let x = 0; x <= 49; ++x) {
    for (let y = 0; y <= 49; ++y) {
      if (terrain.get(x, y) & TERRAIN_MASK_WALL) {
        cm.set(x, y, Infinity);
      }
    }
  }

  return cm;
};

const placeStamp = (
  stamp: Stamp,
  center: Coordinates
): StructurePlacement[] => {
  const [centerX, centerY] = center;
  const width = stamp[0]?.length ?? 0;
  const height = stamp.length ?? 0;

  const leftX = centerX - Math.floor(width / 2);
  const topY = centerY - Math.floor(height / 2);

  return stamp.flatMap((row, yOffset) =>
    row.map<StructurePlacement>((structure, xOffset) => [
      structure,
      leftX + xOffset,
      topY + yOffset,
    ])
  );
};

const updateCMWithPlacement = (
  placement: StructurePlacement[],
  buildingSpace: CostMatrix
) => {
  for (const [structureType, x, y] of placement) {
    if (structureType === EMPTY) {
      continue;
    }
    buildingSpace.set(
      x,
      y,
      structureType === BLOCKED
        ? 254
        : structureType === STRUCTURE_CONTAINER
        ? ContainerCost
        : structureType === STRUCTURE_ROAD
        ? RoadCost
        : Infinity
    );
  }
};

function* canPlaceStamp(
  room: Room,
  stamp: Stamp,
  center: Coordinates,
  buildingSpace: CostMatrix,
  origin: Coordinates,
  pointsToReach: Coordinates[]
): SubRoutine<boolean> {
  const placement = placeStamp(stamp, center);

  for (const [structureType, x, y] of placement) {
    if (structureType === EMPTY) {
      continue;
    }
    const cost = buildingSpace.get(x, y);
    if (structureType === STRUCTURE_ROAD && cost === RoadCost) {
      continue;
    }
    if (cost > 0) {
      return false;
    }
  }

  const navigation = buildingSpace.clone();
  updateCMWithPlacement(placement, navigation);

  const originPos = new RoomPosition(...origin, room.name);
  for (const [x, y] of pointsToReach) {
    yield;
    const path = PathFinder.search(
      originPos,
      {
        range: 1,
        pos: new RoomPosition(x, y, room.name),
      },
      {
        maxRooms: 1,
        roomCallback: (roomName) =>
          roomName === room.name ? navigation : false,
      }
    );
    if (path.incomplete) {
      return false;
    }
  }

  return true;
}

function* placeNumberOfStamp(
  room: Room,
  count: number,
  stamps: Stamp[],
  origin: Coordinates,
  distanceTransform: CostMatrix,
  buildingSpace: CostMatrix,
  pointsToReach: Coordinates[]
): SubRoutine<StructurePlacement[]> {
  let placed = 0;
  const structures: StructurePlacement[] = [];
  for (const stamp of stamps) {
    const candidates = new Set<number>([coordinatesToNumber(origin)]);
    for (const packedCoordinates of candidates) {
      yield;
      const candidate = numberToCoordinates(packedCoordinates);
      expandPosition(candidate)
        .filter(([x, y]) => distanceTransform.get(x, y) > 0)
        .forEach((neighbour) => candidates.add(coordinatesToNumber(neighbour)));

      if (
        yield* canPlaceStamp(
          room,
          stamp,
          candidate,
          buildingSpace,
          origin,
          pointsToReach
        )
      ) {
        const placement = placeStamp(stamp, candidate).filter(
          // remove duplicate roads
          ([structureType, x, y]) =>
            structureType !== STRUCTURE_ROAD ||
            buildingSpace.get(x, y) !== RoadCost
        );
        updateCMWithPlacement(placement, buildingSpace);

        structures.push(...placement);

        ++placed;
        if (placed >= count) {
          return structures;
        }
      }
    }
  }

  return structures;
}

const invertBuildingSpaceForDT = (buildingSpace: CostMatrix): CostMatrix => {
  const cm = buildingSpace.clone();
  for (let x = 0; x <= 49; ++x) {
    for (let y = 0; y <= 49; ++y) {
      cm.set(x, y, cm.get(x, y) > 0 ? 0 : Infinity);
    }
  }

  return cm;
};

const nextStructure = (
  room: Room,
  placements: [BuildableStructureConstant, ...Coordinates][],
  includeContainer = false,
  includeRoad = false
): [BuildableStructureConstant, ...Coordinates] | undefined => {
  const { controller } = room;
  if (!controller) {
    return undefined;
  }

  const towers = room
    .find(FIND_MY_STRUCTURES)
    .filter((s) => s.structureType === STRUCTURE_TOWER);
  const spawns = room.find(FIND_MY_SPAWNS);
  const index = placements.findIndex(([type, x, y]) => {
    if (spawns.length === 0) {
      return type === STRUCTURE_SPAWN;
    }

    if (type === STRUCTURE_ROAD) {
      return (
        includeRoad &&
        room
          .lookForAtArea(LOOK_STRUCTURES, y - 1, x - 1, y + 1, x + 1, true)
          .filter((res) => res.structure.structureType !== STRUCTURE_ROAD)
          .length > 0
      );
    }

    if (
      type === STRUCTURE_CONTAINER &&
      controller.level < 3 &&
      !includeContainer
    ) {
      return false;
    }

    if (
      towers.length === 0 &&
      (CONTROLLER_STRUCTURES[STRUCTURE_TOWER][controller.level] ?? 0) > 0
    ) {
      return type === STRUCTURE_TOWER;
    }

    const placed =
      room
        .find(FIND_MY_CONSTRUCTION_SITES)
        .filter((s) => s.structureType === type).length +
      room
        .find(FIND_STRUCTURES)
        .filter((s) => s.structureType === type && ('my' in s ? s.my : true))
        .length;
    return (CONTROLLER_STRUCTURES[type][controller.level] ?? 0) > placed;
  });

  if (index === -1) {
    if (!includeContainer) {
      return nextStructure(room, placements, true);
    }
    if (!includeRoad) {
      return nextStructure(room, placements, true, true);
    }
    return undefined;
  }
  return placements.splice(index, 1)[0];
};

export function* planRoom(roomName: string): Routine {
  const room = Game.rooms[roomName];
  if (!room) {
    return;
    // return exit(`No vision in room ${roomName}`);
  }
  const buildingSpace = getBuildingSpace(room);

  const distanceTransform = yield* calculateDistanceTransform(
    { x: [1, 48], y: [1, 48] },
    invertBuildingSpaceForDT(buildingSpace)
  );

  const origin = yield* chooseBaseOrigin(room, distanceTransform);

  yield;

  const pointsToReach: Coordinates[] = room
    .find(FIND_SOURCES)
    .map(({ pos }) => pos)
    .concat(room.find(FIND_MINERALS).map(({ pos }) => pos))
    .concat(room.find(FIND_EXIT))
    .concat(room.controller ? [room.controller.pos] : [])
    .map(({ x, y }) => [x, y]);

  const placedStructures: StructurePlacement[] = [];
  for (const [count, stamps] of Stamps) {
    const structures = yield* placeNumberOfStamp(
      room,
      count,
      stamps,
      origin,
      distanceTransform,
      buildingSpace,
      pointsToReach
    );
    placedStructures.push(...structures);
  }
  yield;
  const [, storageX, storageY] = placedStructures.find(
    ([type]) => type === STRUCTURE_STORAGE
  ) ?? ['origin', ...origin];
  const containers = [...room.find(FIND_SOURCES), room.controller]
    .filter(isDefined)
    .map((target) => {
      const { pos } = target;
      const range = target instanceof Source ? 1 : 3;
      const { path } = PathFinder.search(
        new RoomPosition(storageX, storageY, roomName),
        { pos, range },
        {
          roomCallback: () => buildingSpace,
        }
      );
      const tile = path[path.length - 1];

      if (!tile) {
        logger.warn(`No container position found for ${target.id}`);
        return undefined;
      }

      return ['container', tile.x, tile.y] as StructurePlacement;
    })
    .filter(isDefined);

  placedStructures.push(...containers);
  yield;

  go(function* roomPlanVisuals() {
    const visuals = new RoomVisual();
    for (const [structureType, x, y] of placedStructures) {
      if (structureType === EMPTY) {
        continue;
      }

      if (structureType === BLOCKED) {
        visuals.circle(x, y, {
          stroke: 'red',
          fill: 'transparent',
          radius: 0.25,
          opacity: 0.2,
        });
        continue;
      }
      visuals.structure(x, y, structureType, {
        opacity: 0.2,
      });
    }
    visuals.connectRoads({
      opacity: 0.2,
    });

    const buildingVisuals = visuals.export();
    visuals.clear();
    yield;

    for (;;) {
      const room = Game.rooms[roomName];
      if (!room) {
        return;
      }
      // room.visual.import(
      //   overlayCostMatrix(distanceTransform, (dist) => dist / 13)
      // );
      // room.visual.import(overlayCostMatrix(buildingSpace));
      room.visual.import(buildingVisuals);
      room.visual.circle(...origin, {
        fill: 'green',
        radius: 0.25,
      });
      yield sleep();
    }
  });

  go(function* constructRoom() {
    yield;
    const toBePlaced = placedStructures
      .filter(
        (
          placement
        ): placement is [BuildableStructureConstant, ...Coordinates] => {
          const [type] = placement;
          return type !== EMPTY && type !== BLOCKED;
        }
      )
      .filter(([type, x, y]) => {
        const [structure] = room.lookForAt(LOOK_STRUCTURES, x, y);
        if (structure) {
          if (structure.structureType !== type) {
            logger.warn(
              `Wrong structure, ${structure.structureType} at ${x},${y}, want ${type}`
            );
          }
          return false;
        }
        const [ruin] = room.lookForAt(LOOK_RUINS, x, y);
        if (ruin) {
          logger.warn(`Ruin at ${x},${y}, want ${type}`);
          return false;
        }
        const [site] = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
        if (site?.structureType !== type) {
          site?.remove();
          return true;
        }
        return false;
      });

    while (toBePlaced.length > 0) {
      const room = Game.rooms[roomName];
      if (!room) {
        return;
      }
      const [site] = room.find(FIND_MY_CONSTRUCTION_SITES);
      if (site) {
        while (Game.getObjectById(site.id) !== null) {
          yield sleep();
        }
        continue;
      }
      const controller = room.controller;
      if (!controller) {
        return;
      }

      const placement = nextStructure(room, toBePlaced);

      if (!placement) {
        const start = controller.level;
        if (start >= MaxControllerLevel) {
          logger.info(`${roomName} construction done`);
          return;
        }
        logger.info('No structures left, waiting for next RCL');
        while (start <= controller.level) {
          yield sleep();
        }
        continue;
      }
      const [type, x, y] = placement;
      const res = room.createConstructionSite(x, y, type);
      if (res !== OK) {
        logger.warn(`Error placing ${type} at ${x},${y}: ${res}`);
        // This will keep erroring, so give up.
        return;
      }
      yield sleep();
    }
  });
}

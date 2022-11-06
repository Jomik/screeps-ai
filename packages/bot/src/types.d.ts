interface CreepMemory {
  slot?: [x: number, y: number, roomName: string];
  target?: Id<ConstructionSite | AnyStructure>;
  home?: string;
}

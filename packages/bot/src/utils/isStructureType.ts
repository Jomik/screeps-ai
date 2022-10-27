export const isStructureType =
  <T extends StructureConstant[]>(...types: T) =>
  (structure: AnyStructure): structure is ConcreteStructure<T[number]> =>
    types.includes(structure.structureType);

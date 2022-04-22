interface CreepMemory {
  slot: [number, number];
}

interface Memory extends Record<string, unknown> {}

type JSONValue =
  | string
  | number
  | boolean
  | undefined
  | void
  | null
  | { [x: string]: JSONValue }
  | Array<JSONValue>;
type JSONPointer = Record<string, JSONValue> | Array<JSONValue>;

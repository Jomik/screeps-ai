export enum Status {
  Success = 'success',
  Running = 'running',
  Failure = 'failure',
}

export type NodeCreator = () => Node;

export abstract class Node {
  constructor(public readonly name: string) {}
  public abstract tick(): Status;
  // public reset(): void {
  //   // do nothing
  // }
}

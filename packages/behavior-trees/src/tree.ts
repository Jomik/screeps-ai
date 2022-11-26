import { Node, NodeCreator } from './node';

export const behaviorTree = (child: NodeCreator): Node => child();

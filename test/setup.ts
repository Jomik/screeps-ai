import * as matchers from './matchers';
import { mockGlobal } from 'screeps-jest';

expect.extend(matchers);
mockGlobal('Memory', {}, true);
beforeEach(() => {
  mockGlobal('Memory', {}, true);
});

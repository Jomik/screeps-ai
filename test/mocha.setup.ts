global._ = require('lodash');

export const mochaHooks = {
  beforeAll() {
    var chai = require('chai');
    var sinonChai = require('sinon-chai');
    chai.use(sinonChai);
  },
};

var fixtures = require('./fixtures');
var test = fixtures.test;
var testBinOp = fixtures.testBinOp;
var testUnOp = fixtures.testUnOp;

describe('Disasm', function() {
  describe('#Math', function() {
    testBinOp('add');
    testBinOp('sub');

    testUnOp('inc');
    testUnOp('dec');
    testUnOp('mul', true);
    testUnOp('imul', true);
    testUnOp('div', true);
    testUnOp('idiv', true);
  });
});

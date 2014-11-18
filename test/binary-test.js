var fixtures = require('./fixtures');
var test = fixtures.test;
var testBinOp = fixtures.testBinOp;
var testShiftOp = fixtures.testShiftOp;

describe('Disasm', function() {
  describe('#Binary', function() {
    testBinOp('and', true);
    testBinOp('or', true);
    testBinOp('xor', true);

    test('neg', function() {
      this.neg('rax');
      this.neg('r9');
    }, function() {/*
      neg rax
      neg r9
    */});

    testShiftOp('shl');
    testShiftOp('shr');
    testShiftOp('sar');
  });
});

var fixtures = require('./fixtures');
var test = fixtures.test;
var testFpBinary = fixtures.testFpBinary;

describe('Disasm', function() {
  describe('#Floating-Point', function() {
    test('movsd', function() {
      this.movsd('xmm1', 'xmm2');
      this.movsd('xmm1', [ 'r9', 8 ]);
      this.movsd([ 'r9', 8 ], 'xmm1');
    }, function() {/*
      vmovsd xmm1, xmm2
      vmovsd xmm1, [r9, 0x8]
      vmovsd [r9, 0x8], xmm1
    */});

    test('movq', function() {
      this.movq('xmm1', 'r9');
      this.movq('r9', 'xmm1');
      this.movq([ 'r9', 8 ], 'xmm1');
      this.movq('xmm3', [ 'r9', 8 ]);
    }, function() {/*
      vmovq xmm1, r9
      vmovq r9, xmm1
      vmovq [r9, 0x8], xmm1
      vmovq xmm3, [r9, 0x8]
    */});

    test('cvtsd2si', function() {
      this.cvtsd2si('r9', 'xmm1');
      this.cvtsd2si('r14', [ 'r15', 5 ]);
    }, function() {/*
      vcvtsd2si r9, xmm1
      vcvtsd2si r14, [r15, 0x5]
    */});

    test('cvttsd2si', function() {
      this.cvttsd2si('r9', 'xmm1');
      this.cvttsd2si('r14', [ 'r15', 5 ]);
    }, function() {/*
      vcvttsd2si r9, xmm1
      vcvttsd2si r14, [r15, 0x5]
    */});

    test('cvtsi2sd', function() {
      this.cvtsi2sd('xmm1', 'r9');
      this.cvtsi2sd('xmm3', [ 'r15', 5 ]);
    }, function() {/*
      vcvtsi2sd xmm1, r9
      vcvtsi2sd xmm3, [r15, 0x5]
    */});

    test('roundsd', function() {
      this.roundsd('nearest', 'xmm3', 'xmm1');
      this.roundsd('down', 'xmm3', 'xmm1');
      this.roundsd('up', 'xmm3', 'xmm1');
      this.roundsd('zero', 'xmm3', 'xmm1');
    }, function() {/*
      vroundsd xmm3, xmm1, 0x0
      vroundsd xmm3, xmm1, 0x1
      vroundsd xmm3, xmm1, 0x2
      vroundsd xmm3, xmm1, 0x3
    */});

    test('ucomisd', function() {
      this.ucomisd('xmm1', 'xmm2');
      this.ucomisd('xmm1', [ 'r8', 3 ]);
    }, function() {/*
      vucomisd xmm1, xmm2
      vucomisd xmm1, [r8, 0x3]
    */});

    testFpBinary('addsd');
    testFpBinary('mulsd');
    testFpBinary('subsd');
    testFpBinary('divsd');
  });
});

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

    test('movss', function() {
      this.movss('xmm1', 'xmm2');
      this.movss('xmm1', [ 'r9', 8 ]);
      this.movss([ 'r9', 8 ], 'xmm1');
    }, function() {/*
      vmovss xmm1, xmm2
      vmovss xmm1, [r9, 0x8]
      vmovss [r9, 0x8], xmm1
    */});

    test('movq', function() {
      this.movq('xmm1', 'r9');
      this.movq('r9', 'xmm1');
      this.movq('xmm2', 'xmm1');
      this.movq([ 'r9', 8 ], 'xmm1');
      this.movq('xmm3', [ 'r9', 8 ]);
    }, function() {/*
      vmovq xmm1, r9
      vmovq r9, xmm1
      vmovq xmm2, xmm1
      vmovq [r9, 0x8], xmm1
      vmovq xmm3, [r9, 0x8]
    */});

    test('movd', function() {
      this.movd('xmm1', 'r15');
      this.movd('rcx', 'xmm1');
      this.movd('xmm2', 'xmm1');
      this.movd([ 'rcx', 8 ], 'xmm1');
      this.movd('xmm3', [ 'rcx', 8 ]);
    }, function() {/*
      vmovd xmm1, r15
      vmovd ecx, xmm1
      vmovq xmm2, xmm1
      vmovd [ecx, 0x8], xmm1
      vmovd xmm3, [ecx, 0x8]
    */});

    test('cvtsd2si', function() {
      this.cvtsd2si('r9', 'xmm1');
      this.cvtsd2si('r14', [ 'r15', 5 ]);
    }, function() {/*
      vcvtsd2si r9, xmm1
      vcvtsd2si r14, [r15, 0x5]
    */});

    test('cvtss2si', function() {
      this.cvtss2si('r9', 'xmm1');
      this.cvtss2si('r14', [ 'r15', 5 ]);
    }, function() {/*
      vcvtss2si r9, xmm1
      vcvtss2si r14, [r15, 0x5]
    */});

    test('cvttsd2si', function() {
      this.cvttsd2si('r9', 'xmm1');
      this.cvttsd2si('r14', [ 'r15', 5 ]);
    }, function() {/*
      vcvttsd2si r9, xmm1
      vcvttsd2si r14, [r15, 0x5]
    */});

    test('cvttss2si', function() {
      this.cvttss2si('r9', 'xmm1');
      this.cvttss2si('r14', [ 'r15', 5 ]);
    }, function() {/*
      vcvttss2si r9, xmm1
      vcvttss2si r14, [r15, 0x5]
    */});

    test('cvtsi2sd', function() {
      this.cvtsi2sd('xmm1', 'r9');
      this.cvtsi2sd('xmm3', [ 'r15', 5 ]);
    }, function() {/*
      vcvtsi2sd xmm1, r9
      vcvtsi2sd xmm3, [r15, 0x5]
    */});

    test('cvtsi2ss', function() {
      this.cvtsi2ss('xmm1', 'r9');
      this.cvtsi2ss('xmm3', [ 'r15', 5 ]);
    }, function() {/*
      vcvtsi2ss xmm1, r9
      vcvtsi2ss xmm3, [r15, 0x5]
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

    test('roundss', function() {
      this.roundss('nearest', 'xmm3', 'xmm1');
      this.roundss('down', 'xmm3', 'xmm1');
      this.roundss('up', 'xmm3', 'xmm1');
      this.roundss('zero', 'xmm3', 'xmm1');
    }, function() {/*
      vroundss xmm3, xmm1, 0x0
      vroundss xmm3, xmm1, 0x1
      vroundss xmm3, xmm1, 0x2
      vroundss xmm3, xmm1, 0x3
    */});

    test('ucomisd', function() {
      this.ucomisd('xmm1', 'xmm2');
      this.ucomisd('xmm1', [ 'r8', 3 ]);
    }, function() {/*
      vucomisd xmm1, xmm2
      vucomisd xmm1, [r8, 0x3]
    */});

    test('ucomiss', function() {
      this.ucomiss('xmm1', 'xmm2');
      this.ucomiss('xmm1', [ 'r8', 3 ]);
    }, function() {/*
      vucomiss xmm1, xmm2
      vucomiss xmm1, [r8, 0x3]
    */});

    testFpBinary('addsd');
    testFpBinary('mulsd');
    testFpBinary('subsd');
    testFpBinary('divsd');

    testFpBinary('addss');
    testFpBinary('mulss');
    testFpBinary('subss');
    testFpBinary('divss');
  });
});

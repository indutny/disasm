var fixtures = require('./fixtures');
var test = fixtures.test;
var testBinOp = fixtures.testBinOp;

describe('Disasm', function() {
  describe('#Branching', function() {
    testBinOp('cmp');
    testBinOp('test', true, true);

    var jc = [
      'o', 'no', 'b', 'nb',
      'z', 'nz', 'be', 'nbe',
      's', 'ns', 'p', 'np',
      'l', 'nl', 'le', 'nle'
    ];
    test('j', function() {
      var l = this.label();
      this.bind(l);
      this.j(l);
      jc.forEach(function(cond) {
        this.j(cond, l);
      }, this);
    }, function() {/*
      jmp -0x2
      jcc o, -0x4
      jcc no, -0x6
      jcc b, -0x8
      jcc nb, -0xa
      jcc z, -0xc
      jcc nz, -0xe
      jcc be, -0x10
      jcc nbe, -0x12
      jcc s, -0x14
      jcc ns, -0x16
      jcc p, -0x18
      jcc np, -0x1a
      jcc l, -0x1c
      jcc nl, -0x1e
      jcc le, -0x20
      jcc nle, -0x22
    */});

    test('tailCall', function() {
      this.tailCall('r15');
    }, function() {/*
      jmp r15
    */});

    test('call', function() {
      this.call('r15');
    }, function() {/*
      call r15
    */});

    test('cmov', function() {
      jc.forEach(function(cond) {
        this.cmov(cond, 'rax', 'rbx');
      }, this);
    }, function() {/*
      cmov o, rax, rbx
      cmov no, rax, rbx
      cmov b, rax, rbx
      cmov nb, rax, rbx
      cmov z, rax, rbx
      cmov nz, rax, rbx
      cmov be, rax, rbx
      cmov nbe, rax, rbx
      cmov ns, rax, rbx
      cmov ns, rax, rbx
      cmov p, rax, rbx
      cmov np, rax, rbx
      cmov l, rax, rbx
      cmov nl, rax, rbx
      cmov le, rax, rbx
      cmov nle, rax, rbx
    */});

    test('far-jcc', function() {
      var l = this.label();
      this.bind(l);
      this.jl(l);
      jc.forEach(function(cond) {
        this.jl(cond, l);
      }, this);
    }, function() {/*
      jmp -0x5
      far-jcc o, -0xb
      far-jcc no, -0x11
      far-jcc b, -0x17
      far-jcc nb, -0x1d
      far-jcc z, -0x23
      far-jcc nz, -0x29
      far-jcc be, -0x2f
      far-jcc nbe, -0x35
      far-jcc s, -0x3b
      far-jcc ns, -0x41
      far-jcc p, -0x47
      far-jcc np, -0x4d
      far-jcc l, -0x53
      far-jcc nl, -0x59
      far-jcc le, -0x5f
      far-jcc nle, -0x65
    */});

    test('set', function() {
      jc.forEach(function(cond) {
        this.set(cond, 'r9');
      }, this);
    }, function() {/*
      setcc o, r9
      setcc no, r9
      setcc b, r9
      setcc nb, r9
      setcc z, r9
      setcc nz, r9
      setcc be, r9
      setcc nbe, r9
      setcc ns, r9
      setcc ns, r9
      setcc p, r9
      setcc np, r9
      setcc l, r9
      setcc nl, r9
      setcc le, r9
      setcc nle, r9
    */});
  });
});

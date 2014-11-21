var fixtures = require('./fixtures');
var test = fixtures.test;

describe('Disasm', function() {
  describe('#Base', function() {
    test('mov', function() {
      // mod=3
      this.mov('rax', 'rbx');

      // mod=0
      this.mov('rax', [ 'rbx' ]);
      this.mov([ 'rax' ], 'rbx');

      // mod=1
      this.mov('rax', [ 'rbx', 8 ]);
      this.mov([ 'rax', 8 ], 'rbx');
      this.mov('rax', [ 'rbx', -8 ]);
      this.mov([ 'rax', -8 ], 'rbx');

      // mod=2
      this.mov('rax', [ 'rbx', 0xdead ]);
      this.mov([ 'rax', 0xdead ], 'rbx');
      this.mov('rax', [ 'rbx', -0xdead ]);
      this.mov([ 'rax', -0xdead ], 'rbx');

      // SIB, mod=0
      this.mov('rax', [ 'rbx', 'rax', 8 ]);
      this.mov([ 'rbx', 'rax', 8 ], 'rax');

      this.mov('r8', [ 'rbx', 'r15', 8 ]);
      this.mov([ 'r9', 'rax', 8 ], 'r15');

      // Immediate
      this.mov('r8', -0xdead);
      this.mov('r8', new Buffer('addebaabefbeadde', 'hex'));

      // High registers
      this.mov('r14', 'rax');
      this.mov('rbx', 'r15');
    }, function() {/*
      mov rax, rbx
      mov rax, [rbx]
      mov [rax], rbx
      mov rax, [rbx, 0x8]
      mov [rax, 0x8], rbx
      mov rax, [rbx, -0x8]
      mov [rax, -0x8], rbx
      mov rax, [rbx, 0xdead]
      mov [rax, 0xdead], rbx
      mov rax, [rbx, -0xdead]
      mov [rax, -0xdead], rbx
      mov rax, [rbx, rax, 0x8]
      mov [rbx, rax, 0x8], rax
      mov r8, [rbx, r15, 0x8]
      mov [r9, rax, 0x8], r15
      mov r8, -0xdead
      mov r8, 0xdeadbeefabbadead
      mov r14, rax
      mov rbx, r15
    */});

    test('imm mov on r15', function() {
      this.mov('r15', new Buffer('addebaabefbeadde', 'hex'));
    }, function() {/*
      mov r15, 0xdeadbeefabbadead
    */})

    test('nop', function() {
      this.nop();
    }, function() {/*
      nop
    */});

    test('push', function() {
      this.push('rax');
      this.push('rbx');
      this.push('rcx');
      this.push('r8');
      this.push([ 'r8' ]);
    }, function() {/*
      push rax
      push rbx
      push rcx
      push r8
      push [r8]
    */});

    test('pop', function() {
      this.pop('rax');
      this.pop('rbx');
      this.pop('rcx');
      this.pop('r8');
      this.pop([ 'r8' ]);
    }, function() {/*
      pop rax
      pop rbx
      pop rcx
      pop r8
      pop [r8]
    */});

    test('ret', function() {
      this.ret(8);
      this.ret();
    }, function() {/*
      ret 0x8
      ret
    */});

    test('xchg', function() {
      this.xchg('rax', 'rbx');
      this.xchg('rcx', 'rbx');
      this.xchg('rcx', [ 'rbx' ]);
    }, function() {/*
      xchg rax, rbx
      xchg rcx, rbx
      xchg [rbx], rcx
    */});

    test('lea', function() {
      this.lea('rax', [ 'rbx', 'rcx', 3]);
    }, function() {/*
      lea rax, [rbx, rcx, 0x3]
    */});
  });
});

var assert = require('assert');
var jit = require('jit.js');

var disasm = require('../');

describe('Disasm', function() {
  function hex(num) {
    if (num < 0)
      return '-0x' + (-num).toString(16);
    else
      return '0x' + num.toString(16);
  }

  function stringify(out) {
    return out.map(function(instr) {
      return instr.type + ' ' + instr.operands.map(function(operand) {
        if (Array.isArray(operand))
          return '[' + operand.map(function(part) {
            if (typeof part === 'number')
              return hex(part);
            else
              return part;
          }).join(', ') + ']';
        else if (typeof operand === 'number')
          return hex(operand);
        else
          return operand;
      }).join(', ');
    }).join('\n');
  }

  function equalLines(actual, expected) {
    if (actual === expected)
      return;

    var actualLines = actual.split('\n');
    var expectedLines = expected.split('\n');
    var width = 0;

    expectedLines.unshift('    expected:');
    actualLines.unshift('    actual:');
    var total = Math.max(actualLines.length, expectedLines.length);

    if (actualLines.length !== total) {
      for (var i = actualLines.length; i < total; i++)
        actualLines.push('');
    } else {
      for (var i = expectedLines.length; i < total; i++)
        expectedLines.push('');
    }

    for (var i = 0; i < total; i++) {
      width = Math.max(width, actualLines[i].length);
      width = Math.max(width, expectedLines[i].length);
    }

    var out = '';
    for (var i = 0; i < total; i++) {
      var left = expectedLines[i];
      var right = actualLines[i];

      if (left !== right)
        out += '\033[31m';
      else
        out += '\033[32m';

      out += left;
      for (var j = left.length; j < width; j++)
        out += ' ';

      out += '  |  ';
      out += right;

      out += '\033[0m';

      out += '\n';
    }

    throw new Error('Output mismatch:\n\n' + out + '\n' + actual);
  }

  function strip(source) {
    var lines = source.split(/\r\n|\r|\n/g);

    var out = lines.map(function(line) {
      return line.trim();
    }).filter(function(line) {
      return !!line;
    });

    return out.join('\n');
  }
  exports.strip = strip;

  function test(name, body, expected) {
    it('should disasm ' + name, function() {
      var out = disasm.create().disasm(jit.generate(body).buffer);
      expected = expected.toString().replace(/^function[^{]+{\/\*|\*\/}$/g, '');
      equalLines(strip(stringify(out)), strip(expected));
    });
  }

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
    */});

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

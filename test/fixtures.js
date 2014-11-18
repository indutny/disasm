var assert = require('assert');
var jit = require('jit.js');

var disasm = require('../');

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
  it('should support ' + name, function() {
    var reloc = jit.generate(body);
    reloc.resolve(reloc.buffer);
    var out = disasm.create().disasm(reloc.buffer);
    expected = expected.toString().replace(/^function[^{]+{\/\*|\*\/}$/g, '');
    equalLines(strip(stringify(out)), strip(expected));
  });
}
exports.test = test;

function testBinOp(type, binary, noRm) {
  var expected = function() {/*
    {type} rax, r9
    {type} al, 0x9
    {type} rax, 0xf1f2
    {type} rbx, rcx
    {type} ebx, 0x9
    {type} rbx, 0xf1f2
    {type} [rbx, 0x0], r9
    {type} r9, [rbx, 0x0]
  */}.toString().replace(/{type}/g, type);
  if (!binary)
    expected = expected.replace(/al/g, 'rax').replace(/ebx/g, 'rbx');
  if (noRm)
    expected = expected.split(/\n/g).slice(0, -2).join('\n');

  test(type, function() {
    this[type]('rax', 'r9');
    this[type]('rax', 9);
    this[type]('rax', 0xf1f2);
    this[type]('rbx', 'rcx');
    this[type]('rbx', 9);
    this[type]('rbx', 0xf1f2);
    this[type]([ 'rbx', 0 ], 'r9');
    if (!noRm)
      this[type]('r9', [ 'rbx', 0 ]);
  }, expected);
}
exports.testBinOp = testBinOp;

function testShiftOp(type) {
  test(type, function() {
    this[type]('rax', 1);
    this[type]('rax', 'rcx');
  }, function() {/*
    {type} rax, 0x1
    {type} rax, cl
  */}.toString().replace(/{type}/g, type));
}
exports.testShiftOp = testShiftOp;

function testUnOp(type, isRax) {
  var expected = function() {/*
    {type} rax, rax
    {type} rax, r9
  */}.toString().replace(/{type}/g, type);

  if (!isRax)
    expected = expected.replace(/ rax,/g, '');

  test(type, function() {
    this[type]('rax');
    this[type]('r9');
  }, expected);
}
exports.testUnOp = testUnOp;

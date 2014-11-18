var disasm = require('../disasm');
var Buffer = require('buffer').Buffer;

exports.create = function create(arch) {
  if (!arch)
    arch = process.arch;

  if (arch === 'x64')
    return new disasm.X64();
  else
    throw new Error('Unsupported arch: ' + arch);
};

function hex(num) {
  if (num < 0)
    return '-0x' + (-num).toString(16);
  else
    return '0x' + num.toString(16);
}

exports.stringifyInstr = function stringifyInstr(instr) {
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
    else if (Buffer.isBuffer(operand))
      return '0x' + operand.toString('hex');
    else
      return operand;
  }).join(', ');
};

exports.stringify = function stringify(out) {
  return out.map(function(instr) {
    return exports.stringifyInstr(instr);
  }).join('\n');
};

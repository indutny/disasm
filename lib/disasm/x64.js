var disasm = require('../disasm');
var assert = require('assert');
var util = require('util');

var Base = disasm.Base;

function X64() {
  Base.call(this, 'x64');

  this.registers = {
    general: {
      64: [
        'rax', 'rcx', 'rdx', 'rbx', 'rsp', 'rbp', 'rsi', 'rdi',
        'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15'
      ],
      32: [
        'eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'
      ]
    },
    mmx: [
      'mm0', 'mm1', 'mm2', 'mm3', 'mm4', 'mm5', 'mm6', 'mm7',
      'mm8', 'mm9', 'mm10', 'mm11', 'mm12', 'mm13', 'mm14', 'mm15'
    ],
    xmm: [
      'xmm0', 'xmm1', 'xmm2', 'xmm3', 'xmm4', 'xmm5', 'xmm6', 'xmm7',
      'xmm8', 'xmm9', 'xmm10', 'xmm11', 'xmm12', 'xmm13', 'xmm14', 'xmm15'
    ],
    unknown: []
  };
}
util.inherits(X64, Base);
module.exports = X64;

X64.opcodeTable = require('./x64/table');

function Prefixes() {
  this.lock = false;
  this['rep-ne'] = false;
  this['rep-nz'] = false;
  this['override-cs'] = false;
  this['override-ss'] = false;
  this['override-ds'] = false;
  this['override-es'] = false;
  this['override-fs'] = false;
  this['override-gs'] = false;
  this.likely = false;
  this.unlikely = false;
  this['op-override'] = false;
  this['addr-override'] = false;
  this.vex = false;
}

X64.prototype.readPrefix = function readPrefix() {
  var b = this.peek();
  var res
  if (b === 0xf0)
    res = 'lock';
  else if (b === 0xf2)
    res = 'rep-ne';
  else if (b === 0xf3)
    res = 'rep-nz';
  else if (b === 0x2e)
    res = 'override-cs';
  else if (b === 0x36)
    res = 'override-ss';
  else if (b === 0x3e)
    res = 'override-ds';
  else if (b === 0x26)
    res = 'override-es';
  else if (b === 0x36)
    res = 'override-ss';
  else if (b === 0x64)
    res = 'override-fs';
  else if (b === 0x65)
    res = 'override-gs';
  else if (b === 0x2e)
    res = 'likely';
  else if (b === 0x3e)
    res = 'unlikely';
  else if (b === 0x66)
    res = 'op-override';
  else if (b === 0x67)
    res = 'addr-override';
  else
    res = false;

  if (res)
    this.skip(1);
  return res;
};

X64.prototype.readREX = function readREX() {
  var rex = this.peek();
  if ((rex & 0xf0) !== 0x40)
    return false;

  this.skip(1);

  return {
    w: (rex >> 3) & 1,
    r: (rex >> 2) & 1,
    x: (rex >> 1) & 1,
    b: rex & 1
  };
};

X64.prototype.readOpcode = function readOpcode(prefixes) {
  var b = this.readUInt8();

  // One byte opcode
  if (b !== 0x0f) {
    var res = X64.opcodeTable.one[b];
    assert(res, 'Opcode not found: ' + b.toString(16));
    return res;
  }

  // Three byte opcode
  var b = this.readUInt8();
  if (b === 0x38) {
    b = this.readUInt8();
    var res = X64.opcodeTable.three1[b];
    assert(res, 'Opcode not found: f,38,' + b.toString(16));
    return res;
  }
  if (b === 0x3a) {
    b = this.readUInt8();
    var res = X64.opcodeTable.three2[b];
    assert(res, 'Opcode not found: f,3a,' + b.toString(16));
    return res;
  }

  // Two byte opcode
  var res = X64.opcodeTable.two[b];
  assert(res, 'Opcode not found: f,' + b.toString(16));
  return res;
};

X64.prototype.getRegister = function getRegister(operand, rex, index, gen) {
  if (gen)
    return this.registers.general[rex.w ? 64 : 32][index];
  else if (operand.kind === 'general')
    return this.registers[operand.kind][rex.w ? 64 : 32][index];
  else
    return this.registers[operand.kind][index];
};

X64.prototype.getImmediate = function getImmediate(operand, rex) {
  if (operand.size === 'z')
    return this.readInt32LE();
  else if (operand.size === 'w')
    return this.readUInt16LE();
  else if (operand.addr === 'J' && operand.size === 'b')
    return this.readInt8();
  else if (operand.size === 'b')
    return this.readUInt8();
  else if (operand.size === 'v')
    return rex.w ? this.readUInt64() : this.readUInt32LE();
  else
    throw new Error('Unknown immediate size: ' + operand.size);
};

X64.prototype.readModrm = function readModrm(rex, opcode, res, b) {
  if (typeof b === 'undefined')
    b = this.readUInt8();

  var mod = b >> 6;
  var reg = (b >> 3) & 7;
  var rm = b & 7;

  if (rex)
    reg |= rex.r << 3;
  if (opcode.r)
    res[opcode.r.index] = this.getRegister(opcode.r, rex, reg);

  var op = opcode.m || opcode.rm;
  if (mod !== 3 && rm === 4) {
    var sib = this.readUInt8();
    var scale = 1 << ((sib >> 6) & 7);
    var index = (sib >> 3) & 7;
    var base = sib & 7;

    if (rex) {
      index |= rex.x << 3;
      base |= rex.b << 3;
    }

    if (index !== 4) {
      index = this.getRegister(op, rex, index, true);
      index = scale === 1 ? index : [ scale, index ];
    }

    var ptr;
    if (base === 5) {
      if (mod === 0)
        ptr = [ index, this.readInt32() ];
      else if (mod === 1)
        ptr = [ index, this.readInt8(), this.getRegister(op, rex, 6, true) ];
      else if (mod === 2)
        ptr = [ index, this.readInt32(), this.getRegister(op, rex, 6, true) ];
    } else {
      base = this.getRegister(op, rex, base);
      if (mod === 0) {
        if (index === 4)
          ptr = [ base ];
        else
          ptr = [ base, index ];
      } else {
        var disp = mod === 1 ? this.readInt8() : this.readInt32();
        if (index === 4)
          ptr = [ base, disp ];
        else
          ptr = [ base, index, disp ];
      }
    }
    res[op.index] = ptr;

    return res;
  }

  if (rex)
    rm |= rex.b << 3;

  if (mod === 3) {
    assert(opcode.m === null);
    res[op.index] = this.getRegister(op, rex, rm);
    return res;
  }

  if (rex) {
    assert.equal(rex.x, 0, 'REX.X should not be present without SIB');
    rm |= rex.b << 3;
  }

  if (mod === 0) {
    res[op.index] = [ this.getRegister(op, rex, rm, true) ];
  } else {
    var imm = mod === 1 ? this.readInt8() : this.readInt32LE();
    res[op.index] = [ this.getRegister(op, rex, rm, true), imm ];
  }

  return res;
};

X64.prototype.readOperand = function readOperand(rex, op, operands) {
  if (op.kind !== 'fixed')
    return;

  var variants = op.value.split(/\//, 2);
  var res;
  if (variants.length === 2)
    res = variants[rex.b];
  else
    res = variants[0];

  // Immediate
  if (res === (res | 0))
    res |= 0;

  operands[op.index] = res;
};

X64.prototype.disasmInstruction = function disasmInstruction() {
  var prefixes = new Prefixes();
  do {
    var prefix = this.readPrefix();
    if (prefix)
      prefixes[prefix] = true;
  } while (prefix);

  var rex = this.readREX();
  var op = this.readOpcode(prefixes);
  if (typeof op === 'function') {
    var modrm = this.readUInt8();
    op = op(modrm >> 6, (modrm >> 3) & 7);
    if (typeof op === 'function')
      op = op(prefixes);
  }

  var operands = new Array(op.operands.length);
  if (op.modrm)
    this.readModrm(rex, op, operands, modrm);

  if (op.cond)
    operands[0] = op.cond;
  if (op.imm)
    operands[op.imm.index] = this.getImmediate(op.imm, rex);

  op.operands.forEach(function(op) {
    this.readOperand(rex, op, operands);
  }, this);

  var type = op.type.split(/\//, 2);
  if (type.length === 2)
    type = type[rex.w ? 1 : 0];
  else
    type = type[0];

  // Filter-out VEX operands if there is no VEX prefix
  operands = operands.filter(function(x, i) {
    if (op.operands[i] && op.operands[i].address === 'H')
      return prefixes.vex;
    else
      return true;
  });

  return {
    type: type,
    offset: null,
    operands: operands
  };
};

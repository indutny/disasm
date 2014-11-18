var disasm = require('../disasm');

function Base(arch, options) {
  this.arch = arch;
  this.buffer = null;
  this.offset = 0;
  this.options = options || {};
}
module.exports = Base;

Base.prototype.disasm = function disasm(buffer) {
  var res = [];

  this.buffer = buffer;
  this.offset = 0;

  try {
    while (this.offset !== this.buffer.length) {
      var pos = this.offset;
      var instr = this.disasmInstruction();
      instr.offset = pos;
      res.push(instr);
    }
  } catch (e) {
    if (!this.options.swallow || !(e instanceof RangeError))
      throw e;
  }

  return res;
};

Base.prototype.peek = function peek() {
  if (this.offset >= this.buffer.length)
    throw new RangeError('peek() after end');

  return this.buffer[this.offset];
};

Base.prototype.skip = function skip(n) {
  if (this.offset + n > this.buffer.length)
    throw new RangeError('skip out of range');

  this.offset += n;
};

Base.prototype.readUInt8 = function readUInt8() {
  if (this.offset + 1 > this.buffer.length)
    throw new RangeError('readUInt8 out of range');

  return this.buffer[this.offset++];
};

Base.prototype.readInt8 = function readInt8() {
  if (this.offset + 1 > this.buffer.length)
    throw new RangeError('readUInt8 out of range');

  return this.buffer.readInt8(this.offset++, true);
};

Base.prototype.readUInt16LE = function readUInt16LE() {
  if (this.offset + 2 > this.buffer.length)
    throw new RangeError('readUInt16LE out of range');

  var res = this.buffer.readUInt16LE(this.offset, true);
  this.offset += 2;
  return res;
};

Base.prototype.readUInt32LE = function readUInt32LE() {
  if (this.offset + 4 > this.buffer.length)
    throw new RangeError('readUInt32LE out of range');

  var res = this.buffer.readUInt32LE(this.offset, true);
  this.offset += 4;
  return res;
};

Base.prototype.readInt32LE = function readInt32LE() {
  if (this.offset + 4 > this.buffer.length)
    throw new RangeError('readInt32LE out of range');

  var res = this.buffer.readInt32LE(this.offset, true);
  this.offset += 4;
  return res;
};

Base.prototype.readUInt64LE = function readUInt64LE() {
  if (this.offset + 8 > this.buffer.length)
    throw new RangeError('readUInt32LE out of range');

  var res = this.buffer.slice(this.offset, this.offset + 8);
  var rev = new Buffer(res.length);
  for (var i = 0; i < res.length; i++)
    rev[res.length - 1 - i] = res[i];
  this.offset += 8;
  return rev;
};

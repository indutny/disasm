var table = exports;

// 1-byte opcodes
var one = new Array(256);
table.one = one;

function parseOperand(op) {
  var isReg = /^[re]*(A[XLH]|B[XLH]|C[XLH]|D[XLH]|BP|SP|SI|DI)$/.test(op) ||
              /^R(8|9|10|11|12|13|14|15)L?$/.test(op) ||
              /^\d+$/.test(op) ||
              /\//.test(op);
  if (isReg)
    return { kind: 'fixed', value: op.toLowerCase() };

  var addr = op[0];
  var size = op.slice(1);

  var modrm = null;
  if (/^[CDGPSV]$/.test(addr))
    modrm = 'r';
  else if (/^[ENQRUW]$/.test(addr))
    modrm = 'rm';
  else if (/^[AILJ]$/.test(addr))
    modrm = 'imm';
  else if (addr === 'M')
    modrm = 'rm';
  else
    modrm = null;

  var desc = null;
  if (addr === 'A')
    desc = 'direct-addr';
  else if (addr === 'B')
    desc = 'vex';
  else if (addr === 'C')
    desc = 'ctrl';
  else if (addr === 'D')
    desc = 'debug';
  else if (addr === 'F')
    desc = 'flags';
  else if (addr === 'H')
    desc = 'vex';
  else if (addr === 'O')
    desc = 'no-modrm';
  else if (addr === 'X')
    desc = 'ds:rsi';
  else if (addr === 'Y')
    desc = 'es:rdi';

  var kind;
  if (/^[AIJLOXY]$/.test(addr))
    kind = 'other';
  else if (/^[HMNPQ]$/.test(addr))
    kind = 'mmx';
  else if (/^[LUVW]$/.test(addr))
    kind = 'xmm';
  else
    kind = 'general';

  return {
    modrm: modrm,
    kind: kind,
    desc: desc,
    size: size,
    addr: addr,
    index: null
  };
}

function instr(type, operands) {
  var ops = operands || [];

  ops = ops.map(parseOperand);

  var instr = {
    type: type,
    operands: ops,
    modrm: false,
    r: null,
    m: null,
    rm: null,
    imm: null
  };

  if (type === 'j')
    return instr;

  instr.modrm = ops.some(function(op) {
    return /^[CDEGMNOPQRSUVW]$/.test(op.addr);
  });

  ops.forEach(function(op, i) {
    if (op.modrm !== null)
      instr[op.modrm] = op;
    op.index = i;
  });

  return instr;
}

function simple(table, op, type, operands) {
  table[op] = instr(type, operands);
}

function ext(table, op, map) {
  Object.keys(map).forEach(function(key) {
    map[key] = instr(map[key].type, map[key].operands);
  });

  table[op] = function select(mod, rm) {
    return map[(mod === 3 ? '' : 'm') + rm] || map['a' + rm];
  };
}

function basicBinary(table, op, opcode) {
  simple(table, op, opcode, [ 'Eb', 'Gb' ]);
  simple(table, op + 1, opcode, [ 'Ev', 'Gv' ]);
  simple(table, op + 2, opcode, [ 'Gb', 'Eb' ]);
  simple(table, op + 3, opcode, [ 'Gv', 'Ev' ]);
  simple(table, op + 4, opcode, [ 'AL', 'Ib' ]);
  simple(table, op + 5, opcode, [ 'rAX', 'Iz' ]);
}

function pushSeg(table, op, seg) {
  simple(table, op, 'push', [ seg ]);
  simple(table, op + 1, 'pop', [ seg ]);
}

function spanOperand(table, op, opcode, operands) {
  for (var i = 0; i < operands.length; i++) {
    var ops = operands[i];
    if (!Array.isArray(ops))
      ops = [ ops ];
    simple(table, op + i, opcode, ops);
  }
}

// 0x00
basicBinary(one, 0x00, 'add');
pushSeg(one, 0x06, 'ES');
basicBinary(one, 0x08, 'or');
pushSeg(one, 0x0e, 'CS');

// 0x10
basicBinary(one, 0x10, 'adc');
pushSeg(one, 0x16, 'SS');
basicBinary(one, 0x18, 'sbb');
pushSeg(one, 0x1e, 'DS');

// 0x20
basicBinary(one, 0x20, 'and');
simple(one, 0x27, 'daa');
basicBinary(one, 0x28, 'sub');
simple(one, 0x2f, 'das');

// 0x30
basicBinary(one, 0x30, 'xor');
simple(one, 0x37, 'aaa');
basicBinary(one, 0x38, 'cmp');
simple(one, 0x3f, 'aas');

// 0x40

var eregs = [ 'eAX', 'eCX', 'eDX', 'eBX', 'eSP', 'eBP', 'eSI', 'eDI' ];
spanOperand(one, 0x40, 'inc', eregs);
spanOperand(one, 0x48, 'dec', eregs);

// 0x50

var rregs = [
  'rAX/R8', 'rCX/R9', 'rDX/R10', 'rBX/R11',
  'rSP/R12', 'rBP/R13', 'rSI/R14', 'rDI/R15'
];
spanOperand(one, 0x50, 'push', rregs);
spanOperand(one, 0x58, 'pop', rregs);

// 0x60

simple(one, 0x60, 'pusha');
simple(one, 0x61, 'popa');
simple(one, 0x62, 'bound', [ 'Gv', 'Ma' ]);

// TODO(indutny): (x86)
// simple(one, 0x63, 'arpl', [ 'Ev', 'Gv' ]);
simple(one, 0x63, 'movsxd', [ 'Gv', 'Ev' ]);
simple(one, 0x68, 'push', [ 'Iz' ]);
simple(one, 0x69, 'imul', [ 'Gv', 'Ev', 'Iz' ]);
simple(one, 0x6a, 'push', [ 'Ib' ]);
simple(one, 0x6b, 'imul', [ 'Gv', 'Ev', 'Ib' ]);
simple(one, 0x6c, 'insb', [ 'Yb', 'DX' ]);
simple(one, 0x6d, 'insd', [ 'Yz', 'DX' ]);
simple(one, 0x6e, 'outsb', [ 'DX', 'Xb' ]);
simple(one, 0x6f, 'outsd', [ 'DX', 'Xz' ]);

// 0x70

var jc = [
  'O', 'NO', 'B/NAE/C', 'NB/AE/NC',
  'Z/E', 'NZ/NE', 'BE/NA', 'NBE/A',
  'S', 'NS', 'P/PE', 'NP/PO', 'L/NGE', 'NL/GE', 'LE/NG', 'NLE/G'
];
spanOperand(one, 0x70, 'j', jc);

// 0x80
function immExt(table, op, operands) {
  ext(table, op, {
    a0: { type: 'add', operands: operands },
    a1: { type: 'or', operands: operands },
    a2: { type: 'adc', operands: operands },
    a3: { type: 'sbb', operands: operands },
    a4: { type: 'and', operands: operands },
    a5: { type: 'sub', operands: operands },
    a6: { type: 'xor', operands: operands },
    a7: { type: 'cmp', operands: operands }
  });
}

immExt(one, 0x80, [ 'Eb', 'Ib' ]);
immExt(one, 0x81, [ 'Ev', 'Iz' ]);
immExt(one, 0x82, [ 'Eb', 'Ib' ]);
immExt(one, 0x83, [ 'Ev', 'Ib' ]);
spanOperand(one, 0x84, 'test', [ [ 'Eb', 'Gb' ], [ 'Ev', 'Gv' ] ]);
spanOperand(one, 0x86, 'xchg', [ [ 'Eb', 'Gb' ], [ 'Ev', 'Gv' ] ]);
spanOperand(one, 0x88, 'mov', [
  [ 'Eb', 'Gb' ], [ 'Ev', 'Gv' ], [ 'Gb', 'Eb' ], [ 'Gv', 'Ev' ],
  [ 'Ev', 'Sw' ]
]);
simple(one, 0x8d, 'lea', [ 'Gv', 'M' ]);
simple(one, 0x8e, 'mov', [ 'Sw', 'Ew' ]);
simple(one, 0x8e, 'mov', [ 'Sw', 'Ew' ]);
ext(one, 0x8f, {
  a0: { type: 'pop', operands: [ 'Ev' ] }
});

// 0x90

spanOperand(one, 0x90, 'xchg', rregs);
simple(one, 0x90, 'nop');
simple(one, 0x98, 'cbw');
simple(one, 0x99, 'cwd');
simple(one, 0x9a, 'call', [ 'Ap' ]);
simple(one, 0x9b, 'wait');
simple(one, 0x9c, 'pushf', [ 'Fv' ]);
simple(one, 0x9d, 'popf', [ 'Fv' ]);
simple(one, 0x9e, 'sahf');
simple(one, 0x9f, 'lahf');

// 0xa0
spanOperand(one, 0xa0, 'mov', [
  [ 'AL', 'Ob' ], [ 'rAX', 'Ov' ], [ 'Ob', 'AL' ], [ 'Ov', 'rAX' ]
]);
simple(one, 0xa4, 'movsb', [ 'Yb', 'Xb' ]);
simple(one, 0xa5, 'movsd', [ 'Yv', 'Xv' ]);
simple(one, 0xa6, 'cmpsb', [ 'Yb', 'Xb' ]);
simple(one, 0xa7, 'cmpsd', [ 'Yv', 'Xv' ]);
spanOperand(one, 0xa8, 'test', [
  [ 'AL', 'Ib' ], [ 'rAX', 'Iz' ]
]);
simple(one, 0xaa, 'stosb', [ 'Yb', 'AL' ]);
simple(one, 0xab, 'stosd', [ 'Yv', 'rAX' ]);
simple(one, 0xac, 'lodsb', [ 'AL', 'Xb' ]);
simple(one, 0xad, 'lodsd', [ 'rAX', 'Xv' ]);
simple(one, 0xae, 'scasb', [ 'AL', 'Yb' ]);
simple(one, 0xaf, 'scasd', [ 'rAX', 'Yv' ]);

// 0xb0
spanOperand(one, 0xb0, 'mov', [
  [ 'AL/R8L', 'Ib' ], [ 'CL/R9L', 'Ib' ],
  [ 'DL/R10L', 'Ib' ], [ 'BL/R11L', 'Ib' ],
  [ 'AH/R12L', 'Ib' ], [ 'CH/R13L', 'Ib' ],
  [ 'DH/R14L', 'Ib' ], [ 'BH/R14L', 'Ib' ],
  [ 'rAX/R8', 'Iv' ], [ 'rCX/R9', 'Iv' ],
  [ 'rDX/R10', 'Iv' ], [ 'rBX/R11', 'Iv' ],
  [ 'rSP/R12', 'Iv' ], [ 'rBP/R13', 'Iv' ],
  [ 'rSI/R13', 'Iv' ], [ 'rDI/R14', 'Iv' ]
]);

// 0xc0
function shiftExt(table, op, operands) {
  ext(table, op, {
    a0: { type: 'rol', operands: operands },
    a1: { type: 'ror', operands: operands },
    a2: { type: 'rcl', operands: operands },
    a3: { type: 'rcr', operands: operands },
    a4: { type: 'shl', operands: operands },
    a5: { type: 'shr', operands: operands },
    a7: { type: 'sar', operands: operands }
  });
}
simple(one, 0xc2, 'ret', [ 'Iw' ]);
simple(one, 0xc3, 'ret');
shiftExt(one, 0xc0, [ 'Eb', 'Ib' ]);
shiftExt(one, 0xc1, [ 'Ev', 'Ib' ]);

// TODO(indutny): VEX+2byte
simple(one, 0xc4, 'les', [ 'Gp', 'Mp' ]);
simple(one, 0xc5, 'lds', [ 'Gz', 'Mp' ]);
ext(one, 0xc6, {
  a0: { type: 'mov', operands: [ 'Eb', 'Ib' ] },
  7: { type: 'xabort', operands: [ 'Ib' ] }
});
ext(one, 0xc7, {
  a0: { type: 'mov', operands: [ 'Ev', 'Iz' ] },
  7: { type: 'xbegin', operands: [ 'Ib' ] }
});
simple(one, 0xc8, 'enter', [ 'Iw', 'Ib' ]);
simple(one, 0xc9, 'leave');
simple(one, 0xca, 'ret', [ 'Iw' ]);
simple(one, 0xcb, 'ret');
simple(one, 0xcc, 'int3');
simple(one, 0xcd, 'int', [ 'Ib' ]);
simple(one, 0xce, 'into');
simple(one, 0xcf, 'iretd');

// 0xd0
simple(one, 0xd6, 'aam', [ 'Ib' ]);
simple(one, 0xd7, 'aad', [ 'Ib' ]);
simple(one, 0xd9, 'xlat');
shiftExt(one, 0xd0, [ 'Eb', '1' ]);
shiftExt(one, 0xd1, [ 'Ev', '1' ]);
shiftExt(one, 0xd2, [ 'Eb', 'CL' ]);
shiftExt(one, 0xd3, [ 'Ev', 'CL' ]);

// 0xe0
simple(one, 0xe0, 'loopne', [ 'Jb' ]);
simple(one, 0xe1, 'loope', [ 'Jb' ]);
simple(one, 0xe2, 'loop', [ 'Jb' ]);
simple(one, 0xe3, 'JrCXZ', [ 'Jb' ]);
simple(one, 0xe4, 'in', [ 'AL', 'Ib' ]);
simple(one, 0xe5, 'in', [ 'eAX', 'Ib' ]);
simple(one, 0xe6, 'out', [ 'Ib', 'AL' ]);
simple(one, 0xe7, 'out', [ 'Ib', 'eAX' ]);
simple(one, 0xe8, 'call', [ 'Jz' ]);
// XXX(indunty): IA64 map just states "near"
simple(one, 0xe9, 'call', [ 'Jz' ]);
simple(one, 0xea, 'jmp', [ 'Ap' ]);
simple(one, 0xeb, 'jmp', [ 'Jb' ]);
simple(one, 0xec, 'in', [ 'AL', 'DX' ]);
simple(one, 0xed, 'in', [ 'eAX', 'DX' ]);
simple(one, 0xee, 'out', [ 'DX', 'AL' ]);
simple(one, 0xef, 'out', [ 'DX', 'eAX' ]);

// 0xf0
function unaryExt(table, op, operands) {
  ext(one, op, {
    a0: { type: 'test', operands: operands },
    a2: { type: 'not', operands: [] },
    a2: { type: 'neg', operands: [] },
    a3: { type: 'not', operands: [] },
    a4: { type: 'mul', operands: [ 'rAX' ] },
    a5: { type: 'imul', operands: [ 'rAX' ] },
    a6: { type: 'div', operands: [ 'rAX' ] },
    a7: { type: 'idiv', operands: [ 'rAX' ] }
  });
}

simple(one, 0xf4, 'hlt');
simple(one, 0xf5, 'cmc');
unaryExt(table, 0xf6, [ 'Eb' ]);
unaryExt(table, 0xf7, [ 'Ev' ]);
simple(one, 0xf8, 'clc');
simple(one, 0xf9, 'stc');
simple(one, 0xfa, 'cli');
simple(one, 0xfb, 'sti');
simple(one, 0xfc, 'cld');
simple(one, 0xfd, 'std');
ext(one, 0xfe, {
  a0: { type: 'inc', operands: [ 'Eb' ] },
  a1: { type: 'dec', operands: [ 'Eb' ] }
});
ext(one, 0xff, {
  a0: { type: 'inc', operands: [ 'Ev' ] },
  a1: { type: 'dec', operands: [ 'Ev' ] },
  a2: { type: 'call', operands: [ 'Ev' ] },
  a3: { type: 'call', operands: [ 'Ep' ] },
  a4: { type: 'jmp', operands: [ 'Ev' ] },
  a5: { type: 'jmp', operands: [ 'Mp' ] },
  a6: { type: 'push', operands: [ 'Ev' ] }
});

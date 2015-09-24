var table = exports;

function parseOperand(op) {
  var isReg = /^[re]*(A[XLH]|B[XLH]|C[XLH]|D[XLH]|BP|SP|SI|DI)$/.test(op) ||
              /^R(8|9|10|11|12|13|14|15)L?$/.test(op) ||
              /^(NTA|T\d)$/.test(op) ||
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
  else if (addr === 'F')
    desc = 'flags';
  else if (addr === 'H')
    desc = 'vex';
  else if (addr === 'O')
    desc = 'no-modrm';
  else if (addr === 'X')
    return { kind: 'fixed', value: 'ds:rsi' };
  else if (addr === 'Y')
    return { kind: 'fixed', value: 'es:rdi' };

  var kind;
  if (addr === 'C')
    kind = 'ctrl';
  else if (addr === 'D')
    kind = 'debug';
  else if (/^[AIJLOXY]$/.test(addr))
    kind = 'other';
  else if (/^[HNPQ]$/.test(addr))
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

  var instr = {
    type: type,
    operands: ops,
    modrm: false,
    r: null,
    m: null,
    rm: null,
    cond: null,
    imm: null
  };

  var isCc = type === 'jcc' || type === 'cmov' || type === 'far-jcc' ||
             type === 'setcc';
  if (isCc) {
    instr.cond = instr.operands[0].toLowerCase().replace(/\/.*$/, '');
    instr.operands = instr.operands.slice(1);
  }

  instr.operands = instr.operands.map(parseOperand);

  instr.modrm = instr.operands.some(function(op) {
    return /^[CDEGMNOPQRSUVW]$/.test(op.addr);
  });

  var off = isCc ? 1 : 0;
  instr.operands.forEach(function(op, i) {
    if (op.modrm !== null)
      instr[op.modrm] = op;
    op.index = off + i;
  });

  return instr;
}

function single(table, op, type, operands) {
  table[op] = instr(type, operands);
}

function ext(table, op, map) {
  Object.keys(map).forEach(function(key) {
    if (typeof map[key] !== 'function')
      map[key] = instr(map[key].type, map[key].operands);
  });

  table[op] = function modrmSelect(mod, rm) {
    return map[(mod === 3 ? '' : 'm') + rm] || map['a' + rm];
  };
}

function prefixExt(table, op, map) {
  var list = Object.keys(map).map(function(key) {
    return {
      key: key,
      instr: instr(map[key].type, map[key].operands)
    };
  });

  table[op] = function modrmSelect() {
    return function prefixSelect(prefix) {
      var res = null;
      list.some(function(item) {
        // Default value
        if (res === null && item.key === 'none') {
          res = item.instr;
          return;
        }

        if (!prefix[item.key])
          return false;

        res = item.instr;
        return true;
      });
      return res;
    };
  };
}

function basicBinary(table, op, opcode) {
  single(table, op, opcode, [ 'Eb', 'Gb' ]);
  single(table, op + 1, opcode, [ 'Ev', 'Gv' ]);
  single(table, op + 2, opcode, [ 'Gb', 'Eb' ]);
  single(table, op + 3, opcode, [ 'Gv', 'Ev' ]);
  single(table, op + 4, opcode, [ 'AL', 'Ib' ]);
  single(table, op + 5, opcode, [ 'rAX', 'Iz' ]);
}

function pushSeg(table, op, seg) {
  single(table, op, 'push', [ seg ]);
  single(table, op + 1, 'pop', [ seg ]);
}

function spanOperand(table, op, opcode, operands) {
  for (var i = 0; i < operands.length; i++) {
    var ops = operands[i];
    var opcodeName = opcode;
    if (typeof opcode === 'function')
      opcodeName = opcode(ops, i);

    if (!Array.isArray(ops))
      ops = [ ops ];

    single(table, op + i, opcodeName, ops);
  }
}

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

function unaryExt(table, op, operands, test) {
  ext(one, op, {
    a0: { type: 'test', operands: operands.concat(test) },
    a2: { type: 'not', operands: operands },
    a3: { type: 'neg', operands: operands },
    a4: { type: 'mul', operands: [ 'rAX' ].concat(operands) },
    a5: { type: 'imul', operands: [ 'rAX' ].concat(operands) },
    a6: { type: 'div', operands: [ 'rAX' ].concat(operands) },
    a7: { type: 'idiv', operands: [ 'rAX' ].concat(operands) }
  });
}

//
// 1-byte opcodes
//
var one = new Array(256);
table.one = one;

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
single(one, 0x27, 'daa');
basicBinary(one, 0x28, 'sub');
single(one, 0x2f, 'das');

// 0x30
basicBinary(one, 0x30, 'xor');
single(one, 0x37, 'aaa');
basicBinary(one, 0x38, 'cmp');
single(one, 0x3f, 'aas');

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

single(one, 0x60, 'pusha');
single(one, 0x61, 'popa');
single(one, 0x62, 'bound', [ 'Gv', 'Ma' ]);

// TODO(indutny): (x86)
// single(one, 0x63, 'arpl', [ 'Ev', 'Gv' ]);
single(one, 0x63, 'movsxd', [ 'Gv', 'Ev' ]);
single(one, 0x68, 'push', [ 'Iz' ]);
single(one, 0x69, 'imul', [ 'Gv', 'Ev', 'Iz' ]);
single(one, 0x6a, 'push', [ 'Ib' ]);
single(one, 0x6b, 'imul', [ 'Gv', 'Ev', 'Ib' ]);
single(one, 0x6c, 'insb', [ 'Yb', 'DX' ]);
single(one, 0x6d, 'insd', [ 'Yz', 'DX' ]);
single(one, 0x6e, 'outsb', [ 'DX', 'Xb' ]);
single(one, 0x6f, 'outsd', [ 'DX', 'Xz' ]);

// 0x70

var jc = [
  'O', 'NO', 'B/NAE/C', 'NB/AE/NC',
  'Z/E', 'NZ/NE', 'BE/NA', 'NBE/A',
  'S', 'NS', 'P/PE', 'NP/PO', 'L/NGE', 'NL/GE', 'LE/NG', 'NLE/G'
];
spanOperand(one, 0x70, 'jcc', jc.map(function(j) {
  return [ j, 'Jb' ];
}));

// 0x80
immExt(one, 0x80, [ 'Eb', 'Ib' ]);
immExt(one, 0x81, [ 'Ev', 'Iz' ]);
immExt(one, 0x82, [ 'Eb', 'Ib' ]);
immExt(one, 0x83, [ 'Ev', 'Ib' ]);
spanOperand(one, 0x84, function(op, i) {
  return 'test' + (i === 0 ? 'b' : '');
}, [ [ 'Eb', 'Gb' ], [ 'Ev', 'Gv' ] ]);

spanOperand(one, 0x86, function(op, i) {
  return 'xchg' + (i === 0 ? 'b' : '');
}, [ [ 'Eb', 'Gb' ], [ 'Ev', 'Gv' ] ]);

spanOperand(one, 0x88, function(op, i) {
  var postfix = '';
  if (i === 0 || i === 2)
    postfix = 'b';
  else if (i === 4)
    postfix = 'w';
  return 'mov' + postfix;
}, [
  [ 'Eb', 'Gb' ], [ 'Ev', 'Gv' ], [ 'Gb', 'Eb' ], [ 'Gv', 'Ev' ],
  [ 'Ev', 'Sw' ]
]);
single(one, 0x8d, 'lea', [ 'Gv', 'M' ]);
single(one, 0x8e, 'mov', [ 'Sw', 'Ew' ]);
single(one, 0x8e, 'mov', [ 'Sw', 'Ew' ]);
ext(one, 0x8f, {
  a0: { type: 'pop', operands: [ 'Ev' ] }
});

// 0x90

spanOperand(one, 0x90, 'xchg', rregs.map(function(reg) {
  return [ 'rAX', reg ];
}));
single(one, 0x90, 'nop');
single(one, 0x98, 'cbw');
single(one, 0x99, 'cwd');
single(one, 0x9a, 'call', [ 'Ap' ]);
single(one, 0x9b, 'wait');
single(one, 0x9c, 'pushf', [ 'Fv' ]);
single(one, 0x9d, 'popf', [ 'Fv' ]);
single(one, 0x9e, 'sahf');
single(one, 0x9f, 'lahf');

// 0xa0
spanOperand(one, 0xa0, 'mov', [
  [ 'AL', 'Ob' ], [ 'rAX', 'Ov' ], [ 'Ob', 'AL' ], [ 'Ov', 'rAX' ]
]);
single(one, 0xa4, 'movsb', [ 'Yb', 'Xb' ]);
single(one, 0xa5, 'movsd', [ 'Yv', 'Xv' ]);
single(one, 0xa6, 'cmpsb', [ 'Yb', 'Xb' ]);
single(one, 0xa7, 'cmpsd', [ 'Yv', 'Xv' ]);
spanOperand(one, 0xa8, 'test', [
  [ 'AL', 'Ib' ], [ 'rAX', 'Iz' ]
]);
single(one, 0xaa, 'stosb', [ 'Yb', 'AL' ]);
single(one, 0xab, 'stosd', [ 'Yv', 'rAX' ]);
single(one, 0xac, 'lodsb', [ 'AL', 'Xb' ]);
single(one, 0xad, 'lodsd', [ 'rAX', 'Xv' ]);
single(one, 0xae, 'scasb', [ 'AL', 'Yb' ]);
single(one, 0xaf, 'scasd', [ 'rAX', 'Yv' ]);

// 0xb0
spanOperand(one, 0xb0, 'mov', [
  [ 'AL/R8L', 'Ib' ], [ 'CL/R9L', 'Ib' ],
  [ 'DL/R10L', 'Ib' ], [ 'BL/R11L', 'Ib' ],
  [ 'AH/R12L', 'Ib' ], [ 'CH/R13L', 'Ib' ],
  [ 'DH/R14L', 'Ib' ], [ 'BH/R15L', 'Ib' ],
  [ 'rAX/R8', 'Iv' ], [ 'rCX/R9', 'Iv' ],
  [ 'rDX/R10', 'Iv' ], [ 'rBX/R11', 'Iv' ],
  [ 'rSP/R12', 'Iv' ], [ 'rBP/R13', 'Iv' ],
  [ 'rSI/R14', 'Iv' ], [ 'rDI/R15', 'Iv' ]
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
single(one, 0xc2, 'ret', [ 'Iw' ]);
single(one, 0xc3, 'ret');
shiftExt(one, 0xc0, [ 'Eb', 'Ib' ]);
shiftExt(one, 0xc1, [ 'Ev', 'Ib' ]);

// TODO(indutny): VEX+2byte
single(one, 0xc4, 'les', [ 'Gp', 'Mp' ]);
single(one, 0xc5, 'lds', [ 'Gz', 'Mp' ]);
ext(one, 0xc6, {
  a0: { type: 'mov', operands: [ 'Eb', 'Ib' ] },
  7: { type: 'xabort', operands: [ 'Ib' ] }
});
ext(one, 0xc7, {
  a0: { type: 'mov', operands: [ 'Ev', 'Iz' ] },
  7: { type: 'xbegin', operands: [ 'Ib' ] }
});
single(one, 0xc8, 'enter', [ 'Iw', 'Ib' ]);
single(one, 0xc9, 'leave');
single(one, 0xca, 'ret', [ 'Iw' ]);
single(one, 0xcb, 'ret');
single(one, 0xcc, 'int3');
single(one, 0xcd, 'int', [ 'Ib' ]);
single(one, 0xce, 'into');
single(one, 0xcf, 'iretd');

// 0xd0
single(one, 0xd6, 'aam', [ 'Ib' ]);
single(one, 0xd7, 'aad', [ 'Ib' ]);
single(one, 0xd9, 'xlat');
shiftExt(one, 0xd0, [ 'Eb', '1' ]);
shiftExt(one, 0xd1, [ 'Ev', '1' ]);
shiftExt(one, 0xd2, [ 'Eb', 'CL' ]);
shiftExt(one, 0xd3, [ 'Ev', 'CL' ]);

// 0xe0
single(one, 0xe0, 'loopne', [ 'Jb' ]);
single(one, 0xe1, 'loope', [ 'Jb' ]);
single(one, 0xe2, 'loop', [ 'Jb' ]);
single(one, 0xe3, 'JrCXZ', [ 'Jb' ]);
single(one, 0xe4, 'in', [ 'AL', 'Ib' ]);
single(one, 0xe5, 'in', [ 'eAX', 'Ib' ]);
single(one, 0xe6, 'out', [ 'Ib', 'AL' ]);
single(one, 0xe7, 'out', [ 'Ib', 'eAX' ]);
single(one, 0xe8, 'call', [ 'Jz' ]);
single(one, 0xe9, 'jmp', [ 'Jz' ]);
single(one, 0xea, 'jmp', [ 'Ap' ]);
single(one, 0xeb, 'jmp', [ 'Jb' ]);
single(one, 0xec, 'in', [ 'AL', 'DX' ]);
single(one, 0xed, 'in', [ 'eAX', 'DX' ]);
single(one, 0xee, 'out', [ 'DX', 'AL' ]);
single(one, 0xef, 'out', [ 'DX', 'eAX' ]);

// 0xf0
single(one, 0xf4, 'hlt');
single(one, 0xf5, 'cmc');
unaryExt(table, 0xf6, [ 'Eb' ], 'Ib');
unaryExt(table, 0xf7, [ 'Ev' ], 'Iz');
single(one, 0xf8, 'clc');
single(one, 0xf9, 'stc');
single(one, 0xfa, 'cli');
single(one, 0xfb, 'sti');
single(one, 0xfc, 'cld');
single(one, 0xfd, 'std');
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

//
// 2-byte opcodes
//
var two = new Array(256);
table.two = two;

// 0x00
ext(two, 0x00, {
  0: { type: 'sldt', operands: [ 'Rv' ] },
  1: { type: 'str', operands: [ 'Rv' ] },
  m0: { type: 'sldt', operands: [ 'Mw' ] },
  m1: { type: 'str', operands: [ 'Mw' ] },
  a2: { type: 'lldt', operands: [ 'Ew' ] },
  a3: { type: 'ltr', operands: [ 'Ew' ] },
  a4: { type: 'verr', operands: [ 'Ew' ] },
  a5: { type: 'verw', operands: [ 'Ew' ] }
});
ext(two, 0x01, {
  m0: { type: 'sgdt', operands: [ 'Ms' ] },
  m1: { type: 'sidt', operands: [ 'Ms' ] },
  m2: { type: 'lgdt', operands: [ 'Ms' ] },
  m3: { type: 'lidt', operands: [ 'Ms' ] },
  m4: { type: 'smsw', operands: [ 'Mw' ] },
  m6: { type: 'lmsw', operands: [ 'Mw' ] },
  m7: { type: 'invlpg', operands: [ 'Mb' ] },

  // TODO(indutny): vmcall, vmlaunch, vmresume, vmxoff
  0: { type: 'vmOp', operands: [] },
  // TODO(indutny): monitor, mwait, clac, stac
  1: { type: 'monitorOp', operands: [] },
  // TODO(indutny): xgetbv, xsetbv, vmfunc, xend, xtest
  2: { type: 'xOp', operands: [] },
  4: { type: 'smsw', operands: [ 'Rv' ] },
  6: { type: 'lmsw', operands: [ 'Rv' ] },
  // TODO(indutny): swapgs, rdtscp
  7: { type: 'swapgs', operands: [] }
});
single(two, 0x02, 'lar', [ 'Gv', 'Ew' ]);
single(two, 0x03, 'lsl', [ 'Gv', 'Ew' ]);
single(two, 0x05, 'syscall');
single(two, 0x06, 'clts');
single(two, 0x07, 'sysret');
single(two, 0x08, 'invd');
single(two, 0x09, 'wbinvd');
single(two, 0x0d, 'prefetchw', [ 'Ev' ]);

// 0x10
prefixExt(two, 0x10, {
  none: { type: 'vmovups', operands: [ 'Vps', 'Wps' ] },
  'op-override': { type: 'vmovupd', operands: [ 'Vpd', 'Wpd' ] },
  'rep-nz': { type: 'vmovss', operands: [ 'Vx', 'Hx', 'Wss' ] },
  'rep-ne': { type: 'vmovsd', operands: [ 'Vx', 'Hx', 'Wsd' ] }
});
prefixExt(two, 0x11, {
  none: { type: 'vmovups', operands: [ 'Wps', 'Vps' ] },
  'op-override': { type: 'vmovupd', operands: [ 'Wpd', 'Vpd' ] },
  'rep-nz': { type: 'vmovss', operands: [ 'Wss', 'Hx', 'Vx' ] },
  'rep-ne': { type: 'vmovsd', operands: [ 'Wsd', 'Hx', 'Vx' ] }
});
prefixExt(two, 0x12, {
  none: { type: 'vmovlps', operands: [ 'Vq', 'Hq', 'Mq' ] },
  'op-override': { type: 'vmovlpd', operands: [ 'Vq', 'Hq', 'Mq' ] },
  'rep-nz': { type: 'vmovsldup', operands: [ 'Vx', 'Wx' ] },
  'rep-ne': { type: 'vmovddup', operands: [ 'Vx', 'Wx' ] }
});
prefixExt(two, 0x13, {
  none: { type: 'vmovlps', operands: [ 'Mq', 'Vq' ] },
  'op-override': { type: 'vmovlpd', operands: [ 'Mq', 'Vq' ] }
});
prefixExt(two, 0x14, {
  none: { type: 'vunpcklps', operands: [ 'Vx', 'Hx', 'Wx' ] },
  'op-override': { type: 'vunpcklpd', operands: [ 'Vx', 'Hx', 'Wx' ] }
});
prefixExt(two, 0x15, {
  none: { type: 'vunpckhps', operands: [ 'Vx', 'Hx', 'Wx' ] },
  'op-override': { type: 'vunpckhpd', operands: [ 'Vx', 'Hx', 'Wx' ] }
});
prefixExt(two, 0x16, {
  none: { type: 'vmovhps', operands: [ 'Vdq', 'Hq', 'Mq' ] },
  'op-override': { type: 'vmovhpd', operands: [ 'Vdq', 'Hq', 'Mq' ] },
  'rep-nz': { type: 'movshdup', operands: [ 'Vx', 'Wx' ] }
});
prefixExt(two, 0x17, {
  none: { type: 'vmovhps', operands: [ 'Mq', 'Vq' ] },
  'op-override': { type: 'vmovhpd', operands: [ 'Mq', 'Vq' ] }
});
ext(two, 0x18, {
  m0: { type: 'prefetch', operands: [ 'NTA' ] },
  m1: { type: 'prefetch', operands: [ 'T0' ] },
  m2: { type: 'prefetch', operands: [ 'T1' ] },
  m3: { type: 'prefetch', operands: [ 'T2' ] }
});
single(two, 0x1f, 'nop', [ 'Ev' ]);

// 0x20
spanOperand(two, 0x20, 'mov', [
  [ 'Rd', 'Cd' ],
  [ 'Rd', 'Dd' ],
  [ 'Cd', 'Rd' ],
  [ 'Dd', 'Rd' ]
]);
prefixExt(two, 0x28, {
  none: { type: 'vmovaps', operands: [ 'Vps', 'Wps' ] },
  'op-override': { type: 'vmovapd', operands: [ 'Vpd', 'Wpd' ] }
});
prefixExt(two, 0x29, {
  none: { type: 'vmovaps', operands: [ 'Wps', 'Vps' ] },
  'op-override': { type: 'vmovapd', operands: [ 'Wpd', 'Vpd' ] }
});
prefixExt(two, 0x2a, {
  none: { type: 'cvtpi2ps', operands: [ 'Vps', 'Qpi' ] },
  'op-override': { type: 'cvtpi2pd', operands: [ 'Vpd', 'Qpi' ] },
  'rep-nz': { type: 'vcvtsi2ss', operands: [ 'Vss', 'Hss', 'Ey' ] },
  'rep-ne': { type: 'vcvtsi2sd', operands: [ 'Vss', 'Hss', 'Ey' ] }
});
prefixExt(two, 0x2b, {
  none: { type: 'vmovntps', operands: [ 'Mps', 'Vps' ] },
  'op-override': { type: 'vmovntpd', operands: [ 'Mps', 'Vpd' ] }
});
prefixExt(two, 0x2c, {
  none: { type: 'cvttps2pi', operands: [ 'Ppi', 'Wps' ] },
  'op-override': { type: 'cvttpd2pi', operands: [ 'Ppi', 'Wpd' ] },
  'rep-nz': { type: 'vcvttss2si', operands: [ 'Gy', 'Wss' ] },
  'rep-ne': { type: 'vcvttsd2si', operands: [ 'Gy', 'Wsd' ] }
});
prefixExt(two, 0x2d, {
  none: { type: 'cvtps2pi', operands: [ 'Ppi', 'Wps' ] },
  'op-override': { type: 'cvtpd2pi', operands: [ 'Ppi', 'Wpd' ] },
  'rep-nz': { type: 'vcvtss2si', operands: [ 'Gy', 'Wss' ] },
  'rep-ne': { type: 'vcvtsd2si', operands: [ 'Gy', 'Wsd' ] }
});
prefixExt(two, 0x2e, {
  none: { type: 'vucomiss', operands: [ 'Vss', 'Wss' ] },
  'op-override': { type: 'vucomisd', operands: [ 'Vsd', 'Wsd' ] }
});
prefixExt(two, 0x2f, {
  none: { type: 'vcomiss', operands: [ 'Vss', 'Wss' ] },
  'op-override': { type: 'vcomisd', operands: [ 'Vsd', 'Wsd' ] }
});

// 0x30
single(two, 0x30, 'wrmsr');
single(two, 0x31, 'rdtsc');
single(two, 0x32, 'rdmsr');
single(two, 0x33, 'rdpmc');
single(two, 0x34, 'sysenter');
single(two, 0x35, 'sysexit');
single(two, 0x37, 'getsec');

// 0x40
spanOperand(two, 0x40, 'cmov', jc.map(function(j) {
  return [ j, 'Gv', 'Ev' ];
}));

// 0x50
prefixExt(two, 0x50, {
  none: { type: 'vmovmskps', operands: [ 'Gy', 'Ups' ] },
  'op-override': { type: 'vmovmskpd', operands: [ 'Gy', 'Upd' ] }
});
prefixExt(two, 0x51, {
  none: { type: 'vsqrtps', operands: [ 'Vps', 'Wps' ] },
  'op-override': { type: 'vsqrtpd', operands: [ 'Vpd', 'Wpd' ] },
  'rep-nz': { type: 'vsqrtss', operands: [ 'Vss', 'Hss', 'Wss' ] },
  'rep-ne': { type: 'vsqrtsd', operands: [ 'Vsd', 'Hsd', 'Wsd' ] }
});
prefixExt(two, 0x52, {
  none: { type: 'vrsqrtps', operands: [ 'Vps', 'Wps' ] },
  'rep-nz': { type: 'vrsqrtss', operands: [ 'Vss', 'Hss', 'Wss' ] }
});
prefixExt(two, 0x53, {
  none: { type: 'vrcpps', operands: [ 'Vps', 'Wps' ] },
  'rep-nz': { type: 'vrcpss', operands: [ 'Vss', 'Hss', 'Wss' ] }
});
prefixExt(two, 0x54, {
  none: { type: 'vandps', operands: [ 'Vps', 'Hps', 'Wps' ] },
  'op-override': { type: 'vandpd', operands: [ 'Vpd', 'Hpd', 'Wpd' ] }
});
prefixExt(two, 0x55, {
  none: { type: 'vandnps', operands: [ 'Vps', 'Hps', 'Wps' ] },
  'op-override': { type: 'vandnpd', operands: [ 'Vpd', 'Hpd', 'Wpd' ] }
});
prefixExt(two, 0x56, {
  none: { type: 'vorps', operands: [ 'Vps', 'Hps', 'Wps' ] },
  'op-override': { type: 'vorpd', operands: [ 'Vpd', 'Hpd', 'Wpd' ] }
});
prefixExt(two, 0x57, {
  none: { type: 'vxorps', operands: [ 'Vps', 'Hps', 'Wps' ] },
  'op-override': { type: 'vxorpd', operands: [ 'Vpd', 'Hpd', 'Wpd' ] }
});
prefixExt(two, 0x58, {
  none: { type: 'vaddps', operands: [ 'Vps', 'Hps', 'Wps' ] },
  'op-override': { type: 'vaddpd', operands: [ 'Vpd', 'Hpd', 'Wpd' ] },
  'rep-nz': { type: 'vaddss', operands: [ 'Vss', 'Hss', 'Wss' ] },
  'rep-ne': { type: 'vaddsd', operands: [ 'Vsd', 'Hsd', 'Wsd' ] }
});
prefixExt(two, 0x59, {
  none: { type: 'vmulps', operands: [ 'Vps', 'Hps', 'Wps' ] },
  'op-override': { type: 'vmulpd', operands: [ 'Vpd', 'Hpd', 'Wpd' ] },
  'rep-nz': { type: 'vmulss', operands: [ 'Vss', 'Hss', 'Wss' ] },
  'rep-ne': { type: 'vmulsd', operands: [ 'Vsd', 'Hsd', 'Wsd' ] }
});
prefixExt(two, 0x5a, {
  none: { type: 'vcvtps2pd', operands: [ 'Vps', 'Wps' ] },
  'op-override': { type: 'vcvtpd2ps', operands: [ 'Vps', 'Wpd' ] },
  'rep-nz': { type: 'vcvtss2sd', operands: [ 'Vsd', 'Hx', 'Wss' ] },
  'rep-ne': { type: 'vcvtsd2ss', operands: [ 'Vss', 'Hx', 'Wsd' ] }
});
prefixExt(two, 0x5b, {
  none: { type: 'vcvtdq2ps', operands: [ 'Vps', 'Wdq' ] },
  'op-override': { type: 'vcvtps2dq', operands: [ 'Vdq', 'Wps' ] },
  'rep-nz': { type: 'vcvttps2dq', operands: [ 'Vdq', 'Wps' ] }
});
prefixExt(two, 0x5c, {
  none: { type: 'vsubps', operands: [ 'Vps', 'Hps', 'Wps' ] },
  'op-override': { type: 'vsubpd', operands: [ 'Vpd', 'Hpd', 'Wpd' ] },
  'rep-nz': { type: 'vsubss', operands: [ 'Vss', 'Hss', 'Wss' ] },
  'rep-ne': { type: 'vsubsd', operands: [ 'Vsd', 'Hsd', 'Wsd' ] }
});
prefixExt(two, 0x5d, {
  none: { type: 'vminps', operands: [ 'Vps', 'Hps', 'Wps' ] },
  'op-override': { type: 'vminpd', operands: [ 'Vpd', 'Hpd', 'Wpd' ] },
  'rep-nz': { type: 'vminss', operands: [ 'Vss', 'Hss', 'Wss' ] },
  'rep-ne': { type: 'vminsd', operands: [ 'Vsd', 'Hsd', 'Wsd' ] }
});
prefixExt(two, 0x5e, {
  none: { type: 'vdivps', operands: [ 'Vps', 'Hps', 'Wps' ] },
  'op-override': { type: 'vdivpd', operands: [ 'Vpd', 'Hpd', 'Wpd' ] },
  'rep-nz': { type: 'vdivss', operands: [ 'Vss', 'Hss', 'Wss' ] },
  'rep-ne': { type: 'vdivsd', operands: [ 'Vsd', 'Hsd', 'Wsd' ] }
});
prefixExt(two, 0x5f, {
  none: { type: 'vmaxps', operands: [ 'Vps', 'Hps', 'Wps' ] },
  'op-override': { type: 'vmaxpd', operands: [ 'Vpd', 'Hpd', 'Wpd' ] },
  'rep-nz': { type: 'vmaxss', operands: [ 'Vss', 'Hss', 'Wss' ] },
  'rep-ne': { type: 'vmaxsd', operands: [ 'Vsd', 'Hsd', 'Wsd' ] }
});

// 0x60
prefixExt(two, 0x6e, {
  none: { type: 'movd/movq', operands: [ 'Pd', 'Ey' ] },
  'op-override': { type: 'vmovd/vmovq', operands: [ 'Vy', 'Ey' ] }
});
prefixExt(two, 0x6f, {
  none: { type: 'movq', operands: [ 'Pq', 'Qq' ] },
  'op-override': { type: 'vmovdqa', operands: [ 'Vx', 'Wx' ] },
  'rep-nz': { type: 'vmovdqu', operands: [ 'Vx', 'Wx' ] }
});

// 0x70
single(two, 0x78, 'vmread', [ 'Ey', 'Gy' ]);
single(two, 0x78, 'vmwrite', [ 'Gy', 'Ey' ]);
prefixExt(two, 0x7e, {
  none: { type: 'movd/movq', operands: [ 'Ey', 'Pd' ] },
  'op-override': { type: 'vmovd/vmovq', operands: [ 'Ey', 'Vy' ] },
  'rep-nz': { type: 'vmovq', operands: [ 'Vq', 'Wq' ] }
});
prefixExt(two, 0x7f, {
  none: { type: 'movq', operands: [ 'Qq', 'Pq' ] },
  'op-override': { type: 'vmovdqa', operands: [ 'Wx', 'Vx' ] },
  'rep-nz': { type: 'vmovdqu', operands: [ 'Wx', 'Vx' ] }
});

// 0x80
spanOperand(two, 0x80, 'far-jcc', jc.map(function(j) {
  return [ j, 'Jz' ];
}));

// 0x90
spanOperand(two, 0x90, 'setcc', jc.map(function(j) {
  return [ j, 'Eb' ];
}));

// 0xa0
single(two, 0xa0, 'push', [ 'FS' ]);
single(two, 0xa1, 'pop', [ 'FS' ]);
single(two, 0xa2, 'cpuid');
single(two, 0xa3, 'bt', [ 'Ev', 'Gv' ]);
single(two, 0xa4, 'shld', [ 'Ev', 'Gv', 'Ib' ]);
single(two, 0xa5, 'shld', [ 'Ev', 'Gv', 'CL' ]);
single(two, 0xa8, 'push', [ 'GS' ]);
single(two, 0xa9, 'pop', [ 'GS' ]);
single(two, 0xaa, 'rsm');
single(two, 0xab, 'bts', [ 'Ev', 'Gv' ]);
single(two, 0xac, 'shrd', [ 'Ev', 'Gv', 'Ib' ]);
single(two, 0xad, 'shrd', [ 'Ev', 'Gv', 'CL' ]);
single(two, 0xaf, 'imul', [ 'Gv', 'Ev' ]);

// 0xb0
spanOperand(two, 0xb0, 'cmpxchg', [
  [ 'Eb', 'Gb' ], [ 'Ev', 'Gv' ]
]);
single(two, 0xb2, 'lss', [ 'Gv', 'Mp' ]);
single(two, 0xb3, 'btr', [ 'Ev', 'Gv' ]);
single(two, 0xb4, 'lfs', [ 'Gv', 'Mp' ]);
single(two, 0xb5, 'lgs', [ 'Gv', 'Mp' ]);
spanOperand(two, 0xb6, function(op, i) {
  return 'movzx' + (i === 0 ? 'b' : 'w');
}, [
  [ 'Gv', 'Eb' ], [ 'Gv', 'Ew' ]
]);
prefixExt(two, 0xb8, {
  none: { type: 'jmpe', operands: [] },
  'rep-nz': { type: 'popcnt', operands: [ 'Gv', 'Ev' ] }
});
ext(two, 0xba, {
  a4: { type: 'bt', operands: [ 'Ev', 'Ib' ] },
  a5: { type: 'bts', operands: [ 'Ev', 'Ib' ] },
  a6: { type: 'btr', operands: [ 'Ev', 'Ib' ] },
  a7: { type: 'btc', operands: [ 'Ev', 'Ib' ] }
});
single(two, 0xbb, 'btc', [ 'Ev', 'Gv' ]);
prefixExt(two, 0xbc, {
  none: { type: 'bsf', operands: [ 'Gv', 'Ev' ] },
  'rep-nz': { type: 'tzcnt', operands: [ 'Gv', 'Ev' ] }
});
prefixExt(two, 0xbd, {
  none: { type: 'bsr', operands: [ 'Gv', 'Ev' ] },
  'rep-nz': { type: 'lzcnt', operands: [ 'Gv', 'Ev' ] }
});
spanOperand(two, 0xbe, function(op, i) {
  return 'movsx' + (i === 0 ? 'b' : 'w');
}, [
  [ 'Gv', 'Eb' ], [ 'Gv', 'Ew' ]
]);

// 0xc0
spanOperand(two, 0xc0, function(op, i) {
  return 'xadd' + (i === 0 ? 'b' : '');
}, [
  [ 'Eb', 'Gb' ], [ 'Ev', 'Gv' ]
]);
single(two, 0xc3, 'movnti', [ 'My', 'Gy' ]);
spanOperand(two, 0xc8, 'bswap', [
  [ 'rAX/R8' ], [ 'rCX/R9' ], [ 'rDX/R10' ], [ 'rBX/R11' ],
  [ 'rSP/R12' ], [ 'rBP/R13' ], [ 'rSI/R14'], [ 'rDI/R15' ]
]);

// 0xd0
prefixExt(two, 0xd6, {
  'op-override': { type: 'vmovq', operands: [ 'Wq', 'Vq' ] },
  'rep-nz': { type: 'movq2dq', operands: [ 'Vdq', 'Nq' ] },
  'rep-ne': { type: 'movdq2q', operands: [ 'Pq', 'Uq' ] }
});

//
// Three-byte part 1
//
var three1 = {};
table.three1 = three1;

//
// Three-byte part 2
//
var three2 = {};
table.three2 = three2;

prefixExt(three2, 0xa, {
  'op-override': { type: 'vroundss', operands: [ 'Vss', 'Wss', 'Ib' ] }
});
prefixExt(three2, 0xb, {
  'op-override': { type: 'vroundsd', operands: [ 'Vsd', 'Wsd', 'Ib' ] }
});

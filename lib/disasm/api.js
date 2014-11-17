var disasm = require('../disasm');

exports.create = function create(arch) {
  if (!arch)
    arch = process.arch;

  if (arch === 'x64')
    return new disasm.X64();
  else
    throw new Error('Unsupported arch: ' + arch);
};

var disasm = exports;

disasm.Base = require('./disasm/base');
disasm.X64 = require('./disasm/x64');

disasm.create = require('./disasm/api').create;
disasm.stringify = require('./disasm/api').stringify;

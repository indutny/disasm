# Disassembler

## Usage

```javascript
var disasm = require('disasm');

var code = new Buffer(
    '48554889e5488b4510a8010f85360000' +
        '00488b5d18f6c3010f85290000004839' +
        'd80f8f1000000048b8f109e152010000' +
        '004889ec485dc348b8010ae152010000' +
        '004889ec485dc3cc',
    'hex');
var out = disasm.create().disasm(code)
console.log(disasm.stringify(out));
/*
  push rbp
  mov rbp, rsp
  mov rax, [rbp, 0x10]
  test al, 0x1
  far-jcc nz, 0x36
  mov rbx, [rbp, 0x18]
  test ebx, 0x1
  far-jcc nz, 0x29
  cmp rax, rbx
  far-jcc nle, 0x10
  mov rax, 0xf109e15201000000
  mov rsp, rbp
  pop rbp
  ret
  mov rax, 0x010ae15201000000
  mov rsp, rbp
  pop rbp
  ret
  int3
*/
```

#### LICENSE

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2014.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const platform = process.argv[2];
const dir = path.join(__dirname, '..', 'dist');
const files = fs.readdirSync(dir);
const names = files.filter(f => /\.(exe|dmg|zip)$/i.test(f));
for (const f of names) {
  const bytes = fs.statSync(path.join(dir, f)).size;
  assert(bytes > 100_000, `Native installer is suspiciously small: ${f} (${bytes} bytes)`);
}
const count = ext => names.filter(f => f.toLowerCase().endsWith(ext)).length;
if (platform === 'windows-x64') {
  assert.equal(count('.exe'), 1, `Expected one Windows EXE. Found: ${names}`);
} else if (platform === 'macos-universal-architectures') {
  assert.equal(count('.dmg'), 2, `Expected two Mac DMGs. Found: ${names}`);
  assert.equal(count('.zip'), 2, `Expected two Mac ZIPs. Found: ${names}`);
  const dmgs = names.filter(f => f.endsWith('.dmg'));
  assert(dmgs.some(f => f.includes('arm64')) && dmgs.some(f => f.includes('x64')),
    'Both Apple Silicon and Intel Mac DMGs are required');
} else throw new Error(`Unknown build target ${platform}`);
console.log(`Installer output OK (${platform}):\n${names.join('\n')}`);

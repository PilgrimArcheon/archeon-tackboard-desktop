'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { version } = require('../package.json');
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
  for (const ext of ['dmg', 'zip']) {
    for (const arch of ['x64', 'arm64']) {
      const expected = `TackBoard-${version}-${arch}.${ext}`;
      assert(names.includes(expected), `Missing ${arch} Mac ${ext.toUpperCase()} installer: ${expected}. Found: ${names}`);
    }
  }
} else throw new Error(`Unknown build target ${platform}`);
console.log(`Installer output OK (${platform}):\n${names.join('\n')}`);

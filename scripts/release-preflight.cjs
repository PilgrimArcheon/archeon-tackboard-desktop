'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
assert.equal(pkg.name, 'tackboard-desktop');
assert.equal(lock.packages[''].version, pkg.version, 'Lockfile version must match package version');
assert.equal(pkg.build?.appId, 'app.archeon.tackboard', 'Do not change app identity during upgrades');
assert.deepEqual(pkg.build?.nsis?.deleteAppDataOnUninstall, false);
for (const p of ['src/main.cjs', 'src/preload.cjs', 'src/reconcile.cjs', 'assets/icon.ico', 'assets/icon.icns', 'assets/icon.png']) {
  assert(fs.existsSync(path.join(root, p)), `Required release file missing: ${p}`);
}
assert(read('src/main.cjs').includes("const LIVE_ORIGIN='https://archeon-dxvt.vercel.app'"), 'Live sync origin unexpectedly changed');
const leaks = fs.readdirSync(root).filter(x => /(?:backup|recovery).*\.json$|^\.env(?:\.|$)/i.test(x));
assert.equal(leaks.length, 0, `Private backup/environment files in release source: ${leaks.join(', ')}`);
if (process.env.GITHUB_REF_TYPE === 'tag') {
  const expected = `tackboard-desktop-v${pkg.version}`;
  assert.equal(process.env.GITHUB_REF_NAME, expected, `Tag must match app version: ${expected}`);
}
console.log(`Release source OK: TackBoard Desktop v${pkg.version}; no local data or credentials packaged.`);

'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const src=path.join(__dirname,'../src');
const main=fs.readFileSync(path.join(src,'main.cjs'),'utf8');
const hub=fs.readFileSync(path.join(src,'hub.html'),'utf8');
const script=fs.readFileSync(path.join(src,'hub.js'),'utf8');
const preload=fs.readFileSync(path.join(src,'preload.cjs'),'utf8');

test('production URL is fixed in request and pairing; no alternative hosts accepted',()=>{
  assert.match(main,/const LIVE_ORIGIN='https:\/\/archeon-dxvt\.vercel\.app'/);
  assert.match(main,/fetch\(LIVE_ORIGIN\+'\/api\/apps\/tackboard\/sync'/);
  assert.match(main,/function useCloudOnly\(\{token\}=\{\}\)/);
  assert.doesNotMatch(main,/ORIGINS=new Set/);
  assert.doesNotMatch(hub,/id="server"/);
  assert.doesNotMatch(hub,/ARCHEON SERVER/);
  assert.doesNotMatch(script,/\$\('server'\)/);
  assert.match(main,/previousOrigin!==LIVE_ORIGIN\)deleteToken\(\)/);
});

test('native editable right-click menu includes Paste; key is still password-masked',()=>{
  assert.match(main,/webContents\.on\('context-menu'/);
  assert.match(main,/\{label:'Paste',role:'paste'/);
  assert.match(main,/attachEditContextMenu\(hub\)/);
  assert.match(main,/role:'paste'/);
  assert.match(hub,/<input id="token" type="password"/);
  assert.match(script,/window\.tack\.connect\(\{token,confirmReplace:true\}\)/);
});

test('frameless translucent settings hub has accessible hide-to-tray control',()=>{
  assert.match(main,/transparent:true,frame:false,hasShadow:true/);
  assert.match(preload,/hideHub:/);
  assert.match(main,/ipcMain\.handle\('tb:hide-hub'/);
  assert.match(hub,/id="hideHub"[^>]*aria-label="Hide TackBoard"/);
});

test('companion front shows only branding and active board while controls live in Settings',()=>{
 assert.match(hub,/id="frontView"/);
 assert.match(hub,/id="settingsToggle"/);
 assert.match(hub,/<section id="settingsView" class="settings-view hidden"/);
 assert.match(hub,/<select id="noteSize">/);
 assert.match(preload,/noteSize:/);
 assert.match(main,/ipcMain\.handle\('tb:note-size'/);
});

test('per-note size overrides survive persistence while web pinboard positions remain untouched',()=>{
  const sticky=fs.readFileSync(path.join(src,'sticky.js'),'utf8');
  assert.match(main,/noteSizes:state.noteSizes/);
  assert.match(main,/ipcMain\.handle\('tb:note-size-for'/);
  assert.match(preload,/noteSizeFor:/);
  assert.match(hub,/id="editSize"/);
  assert.match(script,/tack\.noteSizeFor\(editing/);
  assert.match(sticky,/s\.noteSizes\?\.\[id\]/);
});

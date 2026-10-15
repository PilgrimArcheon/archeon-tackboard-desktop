'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {blankBoard,applyOperation,replay}=require('../src/core.cjs');
test('create and rename desktop board survive cloud operation replay',()=>{
 const original=blankBoard(),id='project-design';
 const ops=[{type:'new-board',board:{id,name:'Creative ideas',createdAt:1234},at:1234},{type:'rename-board',boardId:id,name:'Creative plan',at:1235}];
 const local=ops.reduce((value,op)=>applyOperation(value,op),original);
 assert.equal(local.boards.find(b=>b.id===id)?.name,'Creative plan');
 const remote=blankBoard();
 assert.equal(replay(remote,ops).boards.find(b=>b.id===id)?.name,'Creative plan');
});
test('invalid board renames do not change local state',()=>{
 const initial=blankBoard();
 assert.throws(()=>applyOperation(initial,{type:'rename-board',boardId:initial.activeBoardId,name:'   ',at:1}));
 assert.equal(initial.boards[0].name,'My board');
});
test('pairing must be explicitly confirmed and cloud boards win',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8');
 const hub=fs.readFileSync(path.join(__dirname,'../src/hub.js'),'utf8');
 assert.match(main,/p\?\.confirmReplace===true\?useCloudOnly/);
 assert.match(main,/state\.data=r\.data\|\|blankBoard\(\);/);
 assert.match(main,/backupRecovery\('before-cloud-only-pairing'\)/);
 assert.match(hub,/REPLACE all local boards and notes/);
 assert.match(hub,/Export local backup/);
});

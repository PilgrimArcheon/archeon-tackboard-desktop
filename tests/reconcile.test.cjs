'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {planMerge}=require('../src/reconcile.cjs');
function board(){return {id:'b1',name:'Planning',createdAt:1};}
function note(id,title,boardId='b1'){return {id,title,boardId,body:'',color:'butter',status:'active',tasks:[],x:0,y:0,layer:1,archivedAt:null,createdAt:1,updatedAt:1};}
function doc(boards=[board()],notes=[]){return {version:1,boards,notes,activeBoardId:boards[0].id};}
test('explicit recovery imports a missing note with a NEW ID and keeps the cloud deletion',()=>{
 const remote=doc([board()],[note('other','Remote note')]);
 const local=doc([board()],[note('gone','Important old note')]);local.notes[0].title='Edited locally';
 const pending=[{type:'update-note',noteId:'gone',field:'title',value:'Edited locally',at:2}];
 const orig=structuredClone(remote);
 const preview=planMerge(remote,local,pending);
 assert.equal(preview.needsRecovery,true);assert.deepEqual(preview.missing,[{id:'gone',title:'Edited locally'}]);
 const resolved=planMerge(remote,local,pending,{recoverMissing:true,makeId:()=> 'recovered-new-id'});
 assert.equal(resolved.needsRecovery,false);assert.equal(resolved.recovered,1);
 assert.equal(resolved.data.notes.length,2);assert.equal(resolved.data.notes.some(n=>n.id==='gone'),false);
 assert.equal(resolved.data.notes.find(n=>n.id==='recovered-new-id').title,'Edited locally (recovered)');
 assert.equal(resolved.data.notes.find(n=>n.id==='other').title,'Remote note');
 assert.deepEqual(remote,orig); // no mutation
});
test('independent local and remote note changes are kept without a recovery prompt',()=>{
 const remote=doc([board()],[note('n1','Remote title'),note('n2','Other')]);
 const local=doc([board()],[note('n1','Old title'),note('n2','New title')]);
 const pending=[{type:'update-note',noteId:'n2',field:'title',value:'New title',at:10}];
 const result=planMerge(remote,local,pending);
 assert.equal(result.needsRecovery,false);assert.equal(result.data.notes[0].title,'Remote title');assert.equal(result.data.notes[1].title,'New title');
});
test('a locally NEW note remains the same ID; not falsely flagged as deleted remotely',()=>{
 const remote=doc();const local=doc([board()],[note('new-id','Fresh')]);
 const result=planMerge(remote,local,[{type:'new-note',note:local.notes[0],at:10}]);
 assert.equal(result.needsRecovery,false);assert.equal(result.recovered,0);assert.equal(result.data.notes[0].id,'new-id');
});
test('a missing board is recovered only with an explicit merge and no duplicated boards',()=>{
 const remote=doc();const second={id:'b2',name:'Other board',createdAt:2};
 const local=doc([board(),second],[note('missing','Important','b2')]);
 const result=planMerge(remote,local,[{type:'update-note',noteId:'missing',field:'body',value:'work',at:20}],{recoverMissing:true,makeId:()=> 'copy'});
 assert.equal(result.data.boards.filter(x=>x.id==='b2').length,1);assert.equal(result.data.notes[0].boardId,'b2');
});
test('edits to a note missing both locally and remotely are blocked (not dropped)',()=>{
 const remote=doc();const local=doc();
 assert.throws(()=>planMerge(remote,local,[{type:'update-note',noteId:'unknown',field:'title',value:'Lost',at:2}],{recoverMissing:true}),/missing from BOTH/);
});
test('importing old local notes without queued edits asks for explicit recovery',()=>{
 const remote=doc();const local=doc([board()],[note('offline','Offline only')]);
 const p=planMerge(remote,local,[],{includeUnqueued:true});assert.equal(p.needsRecovery,true);
 const r=planMerge(remote,local,[],{includeUnqueued:true,recoverMissing:true,makeId:()=> 'copy2'});
 assert.equal(r.data.notes[0].id,'copy2');
});
test('board creation deduplicates pending new-board events',()=>{
 const remote=doc();const added={id:'b2',name:'New board',createdAt:2};const local=doc([board(),added]);
 const r=planMerge(remote,local,[{type:'new-board',board:added,at:3},{type:'new-board',board:added,at:4}]);
 assert.equal(r.data.boards.filter(x=>x.id==='b2').length,1);
});

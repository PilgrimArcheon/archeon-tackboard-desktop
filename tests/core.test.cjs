const test=require('node:test');const assert=require('node:assert/strict');
const {blankBoard,applyOperation,replay,validateDoc}=require('../src/core.cjs');
const note={id:'note1',boardId:'board-default',title:'Work notes',body:'',color:'butter',status:'planned',tasks:[{id:'task1',text:'Make an app',done:false}],x:2,y:2,layer:1,createdAt:1,updatedAt:1,archivedAt:null};
test('blank local board can receive editable sticky notes',()=>{
 let board=blankBoard();assert.equal(validateDoc(board),true);
 board=applyOperation(board,{type:'new-note',note,at:10});assert.equal(board.notes.length,1);
 board=applyOperation(board,{type:'update-note',noteId:'note1',field:'color',value:'mint',at:20});
 assert.equal(board.notes[0].color,'mint');
 board=applyOperation(board,{type:'update-task',noteId:'note1',taskId:'task1',field:'done',value:true,at:21});assert.equal(board.notes[0].tasks[0].done,true);
 board=applyOperation(board,{type:'archive-note',noteId:'note1',at:22});assert.equal(board.notes[0].archivedAt,22);
 board=applyOperation(board,{type:'restore-note',noteId:'note1',at:23});assert.equal(board.notes[0].archivedAt,null);
});
test('sync replay retains unrelated cloud changes while applying local edits',()=>{
 let remote=applyOperation(blankBoard(),{type:'new-note',note,at:3});
 remote=applyOperation(remote,{type:'new-note',note:{...note,id:'note2',title:'Other device'},at:5});
 const merged=replay(remote,[{type:'update-note',noteId:'note1',field:'title',value:'Updated locally',at:15}]);
 assert.equal(merged.notes.length,2);assert.equal(merged.notes[0].title,'Updated locally');assert.equal(merged.notes[1].title,'Other device');
});
test('sync replay does not silently discard edits if target deleted remotely',()=>{
 assert.throws(()=>replay(blankBoard(),[{type:'update-note',noteId:'missing',field:'title',value:'New',at:7}]),/removed/);
});
test('editing one task leaves others intact',()=>{
 let b=applyOperation(blankBoard(),{type:'new-note',note,at:1});
 b=applyOperation(b,{type:'new-task',noteId:'note1',task:{id:'task2',text:'Share preview'},at:3});
 b=applyOperation(b,{type:'update-task',noteId:'note1',taskId:'task2',field:'text',value:'Review UX',at:4});
 assert.deepEqual(b.notes[0].tasks.map(x=>x.text),['Make an app','Review UX']);
});
test('malformed documents are rejected before upload',()=>{
 assert.equal(validateDoc({...blankBoard(),notes:[{...note,color:'evil'}]}),false);
 assert.equal(validateDoc({...blankBoard(),boards:[]}),false);
});

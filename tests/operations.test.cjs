const test=require('node:test');const assert=require('node:assert/strict');
const {blankBoard,applyOperation,replay}=require('../src/core.cjs');
const note={id:'sticky',boardId:'board-default',title:'Desktop note',body:'',color:'mint',status:'planned',tasks:[],x:20,y:30,layer:1,archivedAt:null,createdAt:1,updatedAt:1};
test('new desktop note is cloud-document compatible',()=>{
 let doc=applyOperation(blankBoard(),{type:'new-note',note,at:2});
 doc=applyOperation(doc,{type:'new-task',noteId:'sticky',task:{id:'task',text:'Finish drawing'},at:3});
 doc=applyOperation(doc,{type:'update-task',noteId:'sticky',taskId:'task',field:'done',value:true,at:4});
 assert.equal(doc.notes[0].tasks[0].done,true);
 doc=applyOperation(doc,{type:'archive-note',noteId:'sticky',at:5});assert.equal(doc.notes[0].status,'done');
});
test('pending note edits rebase over cloud changes',()=>{
 const remote=applyOperation(blankBoard(),{type:'new-note',note,at:2});
 const rebased=replay(remote,[{type:'update-note',noteId:'sticky',field:'title',value:'Revised',at:8}]);
 assert.equal(rebased.notes[0].title,'Revised');
});

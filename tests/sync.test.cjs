'use strict';
// Test the actual push/pull/syncNow functions from Electron's main process
// against a deterministic in-memory server without launching Electron.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {applyOperation,replay,validateDoc}=require('../src/core.cjs');
const source=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8');
const fragment=source.slice(source.indexOf('async function push(){'),source.indexOf('async function useCloudOnly('));
function board(id,name){return {id,name,createdAt:1};}
function doc(){return {version:1,activeBoardId:'board-1',boards:[board('board-1','Original')],notes:[]};}
function setup(){
 const server={revision:2,data:doc(),accountId:'user-1'};
 const state={revision:1,accountId:'user-1',data:doc(),pending:[],settings:{},lastSyncedAt:null,status:'online',error:''};
 const context={state,getToken:()=>'token',putInFlight:false,pullInFlight:false,manualSyncPromise:null,
  request:async(method,body)=>{
   if(method==='GET')return {ok:true,status:200,data:structuredClone(server.data),revision:server.revision,accountId:server.accountId};
   if(body.baseRevision!==server.revision)return {ok:false,status:409,data:structuredClone(server.data),revision:server.revision,accountId:server.accountId};
   server.data=structuredClone(body.data);server.revision++;
   return {ok:true,saved:true,status:200,revision:server.revision,accountId:server.accountId};
  },report:(status,error='')=>{state.status=status;state.error=error;},save:()=>{},syncWindows:()=>{},
  queueFlush:()=>{},validateDoc,replay,setTimeout,clearTimeout,Promise,Number,Date,console};
 const c=vm.createContext(context);vm.runInContext(fragment+';this.syncNow=syncNow;this.pull=pull;',c);
 return {c,state,server};
}
test('manual sync merges cloud board updates and desktop queued note',async()=>{
 const {c,state,server}=setup();
 server.data.boards.push(board('board-2','Planning Phase'));
 const note={id:'note-1',boardId:'board-1',title:'Design',body:'',color:'butter',status:'planned',tasks:[],x:0,y:0,layer:1,createdAt:2,updatedAt:2,archivedAt:null};
 const op={type:'new-note',note,at:2};state.data=applyOperation(state.data,op);state.pending=[op];
 const result=await c.syncNow(true);
 assert.equal(result.ok,true);assert.equal(state.revision,3);
 assert.equal(state.status,'online');assert.equal(state.pending.length,0);
 assert.equal(server.data.boards.length,2);assert.equal(server.data.notes.length,1);
 assert.equal(state.data.boards.length,2);
});
test('desktop sees a remote board rename after Sync now',async()=>{
 const {c,state,server}=setup();server.data.boards[0].name='Planning Phase';
 const result=await c.syncNow(true);
 assert.equal(result.ok,true);assert.equal(state.data.boards[0].name,'Planning Phase');assert.equal(state.revision,2);
});
test('different pairing account cannot silently replace local boards',async()=>{
 const {c,state,server}=setup();server.accountId='user-other';server.data.boards[0].name='Wrong account';
 const result=await c.syncNow(true);
 assert.equal(result.ok,false);assert.equal(state.status,'auth');assert.equal(state.data.boards[0].name,'Original');
});
test('failed server write preserves queued edits and reports error',async()=>{
 const {c,state}=setup();
 state.data.boards.push(board('board-2','My new board'));
 state.pending=[{type:'new-board',board:board('board-2','My new board'),at:3}];
 c.request=async()=>({ok:false,status:503,error:'Neon unavailable'});
 const result=await c.syncNow(true);
 assert.equal(result.ok,false);assert.equal(state.pending.length,1);
 assert.equal(state.status,'offline');assert.equal(state.data.boards.length,2);
});

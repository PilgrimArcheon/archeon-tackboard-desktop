'use strict';
const {app,BrowserWindow,Tray,Menu,ipcMain,shell,screen,safeStorage,nativeImage,nativeTheme,dialog} = require('electron');
const path=require('node:path'); const fs=require('node:fs'); const crypto=require('node:crypto');
const {blankBoard,validateDoc,applyOperation,replay}=require('./core.cjs');
const {planMerge}=require('./reconcile.cjs');
const {snap,fitToWorkArea,initialBounds}=require('./geometry.cjs');
const {normalizeSize,boundsFor}=require('./sizes.cjs');
const TOKEN=/^tb_[A-Za-z0-9_-]{40,100}$/;
// Pairing credentials are sent only to this production endpoint, never to UI-supplied URLs.
const LIVE_ORIGIN='https://archeon-dxvt.vercel.app';
const DEFAULT={origin:LIVE_ORIGIN,boardId:'',noteSize:'medium',theme:'system',onTop:true,visible:true,launchAtLogin:false};
const APP_ICON=path.join(__dirname,'../assets/icon.png');
const MAX_VISIBLE=30;
let editorTarget='',tray,hub,quitting=false,tokenInMemory='',pullInFlight=false,putInFlight=false,flushTimer=null,pollTimer=null,dirty=false;
let state={settings:{...DEFAULT},data:blankBoard(),revision:0,accountId:'',localDataAccountId:'',lastSyncedAt:null,pending:[],pendingVersion:0,positions:{},expanded:{},noteSizes:{},paired:false,status:'local',error:''};
const windows=new Map(),moveTimers=new Map();
const saveFile=()=>path.join(app.getPath('userData'),'tackboard-state.json');
const tokenFile=()=>path.join(app.getPath('userData'),'tackboard-token.bin');
function backupRecovery(reason){
 const folder=path.join(app.getPath('userData'),'recovery');fs.mkdirSync(folder,{recursive:true,mode:0o700});
 const file=path.join(folder,`tackboard-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.json`);
 atomic(file,{format:'tackboard-desktop-recovery-v1',reason,createdAt:new Date().toISOString(),accountId:state.accountId,revision:state.revision,data:state.data,pending:state.pending,settings:state.settings});
 return file;
}
function atomic(file,value){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value),{mode:0o600});fs.renameSync(tmp,file);}
function save(){ atomic(saveFile(),{settings:state.settings,data:state.data,revision:state.revision,accountId:state.accountId,localDataAccountId:state.localDataAccountId,lastSyncedAt:state.lastSyncedAt,pending:state.pending,positions:state.positions,expanded:state.expanded,noteSizes:state.noteSizes}); }
function load(){try {const x=JSON.parse(fs.readFileSync(saveFile(),'utf8'));
  if(validateDoc(x.data))state.data=x.data;
  if(Number.isSafeInteger(x.revision)&&x.revision>=0)state.revision=x.revision;
  if(typeof x.accountId==='string')state.accountId=x.accountId;
  if(typeof x.localDataAccountId==='string')state.localDataAccountId=x.localDataAccountId;else state.localDataAccountId=state.accountId;
  if(Number.isFinite(x.lastSyncedAt))state.lastSyncedAt=x.lastSyncedAt;
  if(Array.isArray(x.pending))state.pending=x.pending.slice(0,5000);
  if(x.positions&&typeof x.positions==='object'&&!Array.isArray(x.positions))state.positions=x.positions;
  if(x.expanded&&typeof x.expanded==='object'&&!Array.isArray(x.expanded))state.expanded=x.expanded;
  if(x.noteSizes&&typeof x.noteSizes==='object'&&!Array.isArray(x.noteSizes))state.noteSizes=Object.fromEntries(Object.entries(x.noteSizes).filter(([,v])=>['small','medium','large'].includes(v)));
  const previousOrigin=x.settings?.origin;
  state.settings={...DEFAULT,...x.settings,origin:LIVE_ORIGIN,noteSize:normalizeSize(x.settings?.noteSize),theme:['system','light','dark'].includes(x.settings?.theme)?x.settings.theme:'system'};
  // Never forward a legacy localhost/alternate-server pairing token to production.
  // Local board data and queued changes stay intact; only the key must be paired again.
  if(previousOrigin&&previousOrigin!==LIVE_ORIGIN)deleteToken();
 }catch{} }
function getToken(){if(tokenInMemory)return tokenInMemory;
 if(!safeStorage.isEncryptionAvailable())return '';
 try{const t=safeStorage.decryptString(fs.readFileSync(tokenFile()));return TOKEN.test(t)?t:'';}catch{return '';}}
function storeToken(token){tokenInMemory=token;
 if(safeStorage.isEncryptionAvailable())fs.writeFileSync(tokenFile(),safeStorage.encryptString(token),{mode:0o600});}
function deleteToken(){tokenInMemory='';try{fs.unlinkSync(tokenFile())}catch{}}
function effectiveTheme(){return state.settings.theme==='system'?(nativeTheme.shouldUseDarkColors?'dark':'light'):state.settings.theme;}
function snapshot(){return {settings:state.settings,effectiveTheme:effectiveTheme(),data:state.data,revision:state.revision,accountId:state.accountId,localDataAccountId:state.localDataAccountId,lastSyncedAt:state.lastSyncedAt,paired:!!getToken(),pending:state.pending.length,status:state.status,error:state.error,displays:screen.getAllDisplays().map(d=>({id:d.id,label:d.label,workArea:d.workArea})),visible:windows.size,limit:MAX_VISIBLE,expanded:{...state.expanded},noteSizes:{...state.noteSizes}};}
function broadcast(){const s=snapshot();for(const win of [hub,...windows.values()])if(win&&!win.isDestroyed())win.webContents.send('tack:state',s);updateTray();}
function report(status,error=''){state.status=status;state.error=error;broadcast();}
function currentBoard(){return state.settings.boardId&&state.data.boards.some(b=>b.id===state.settings.boardId)?state.settings.boardId:state.data.activeBoardId;}
function notes(){return state.data.notes.filter(n=>n.boardId===currentBoard()&&!n.archivedAt).sort((a,b)=>a.layer-b.layer).slice(0,MAX_VISIBLE);}
function safeBounds(raw){return raw&&['x','y'].every(k=>Number.isFinite(raw[k]))&&Math.abs(raw.x)<1e6&&Math.abs(raw.y)<1e6;}
function sizeForNote(id){return state.noteSizes[id]||state.settings.noteSize;}
function displayBounds(id,index){const displays=screen.getAllDisplays();const stored=state.positions[id];
 const dimensions=boundsFor(sizeForNote(id),!!state.expanded[id]);
 return stored&&safeBounds(stored)?fitToWorkArea({...stored,...dimensions},displays):initialBounds(index,screen.getDisplayNearestPoint(screen.getCursorScreenPoint()),dimensions.width,dimensions.height);}
function resizeNoteWindows(){for(const [id,w] of windows){if(w.isDestroyed())continue;const next=fitToWorkArea({...w.getBounds(),...boundsFor(sizeForNote(id),!!state.expanded[id])},screen.getAllDisplays());w.setBounds(next,false);state.positions[id]={x:next.x,y:next.y};}save();broadcast();}
function noteWindow(note,index){const bounds=displayBounds(note.id,index);
 const w=new BrowserWindow({...bounds,icon:APP_ICON,transparent:true,frame:false,backgroundColor:'#00000000',hasShadow:false,resizable:false,skipTaskbar:true,show:false,alwaysOnTop:state.settings.onTop,
   webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
 windows.set(note.id,w);w.setMenuBarVisibility(false);
 w.loadFile(path.join(__dirname,'sticky.html'),{query:{id:note.id}});
 w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());
 const reveal=()=>{if(state.settings.visible&&!w.isDestroyed()&&!w.isVisible())w.showInactive();broadcast();};
 w.once('ready-to-show',reveal);w.webContents.once('did-finish-load',reveal);
 let internalMove=false;
 w.on('moved',()=>{if(internalMove)return;
  clearTimeout(moveTimers.get(note.id));moveTimers.set(note.id,setTimeout(()=>{
    if(w.isDestroyed())return;const adjusted=snap(w.getBounds(),screen.getAllDisplays());
    const before=w.getBounds();if(before.x!==adjusted.x||before.y!==adjusted.y){internalMove=true;w.setBounds(adjusted,false);internalMove=false;}
    state.positions[note.id]={x:adjusted.x,y:adjusted.y};save();
  },260));});
 w.on('closed',()=>{windows.delete(note.id);clearTimeout(moveTimers.get(note.id));});
 return w;
}
function syncWindows(){if(!app.isReady())return;
 const desired=new Map((state.settings.visible?notes():[]).map((n,i)=>[n.id,i]));
 for(const [id,w]of windows)if(!desired.has(id)){windows.delete(id);w.destroy();}
 for(const [id,i]of desired){if(!windows.has(id))noteWindow(state.data.notes.find(n=>n.id===id),i);}
 broadcast();}
function reconcileDisplays(){for(const [id,w] of windows){const b=w.getBounds(),next=fitToWorkArea(b,screen.getAllDisplays());
 if(next.x!==b.x||next.y!==b.y)w.setBounds(next,false);
 state.positions[id]={x:next.x,y:next.y};}save();broadcast();}
// Electron does not show a standard right-click text menu by default on all platforms.
// Native menu roles preserve Undo, Cut, Copy, Paste and Select All in editable fields,
// including the password-style pairing key input (without exposing its value).
function attachEditContextMenu(win){
 win.webContents.on('context-menu',(_event,params)=>{
  if(!params.isEditable)return;
  const edit=params.editFlags||{};
  Menu.buildFromTemplate([
   {label:'Undo',role:'undo',enabled:!!edit.canUndo},
   {label:'Redo',role:'redo',enabled:!!edit.canRedo},
   {type:'separator'},
   {label:'Cut',role:'cut',enabled:!!edit.canCut},
   {label:'Copy',role:'copy',enabled:!!edit.canCopy},
   {label:'Paste',role:'paste',enabled:!!edit.canPaste},
   {type:'separator'},
   {label:'Select All',role:'selectAll'},
  ]).popup({window:win});
 });
}
function setHubView(view){if(!hub||hub.isDestroyed())return;
 const expanded=view==='settings'||view==='edit';const b=hub.getBounds();
 const fitted=fitToWorkArea({...b,width:410,height:expanded?640:480},screen.getAllDisplays());hub.setBounds(fitted,false);}
function makeHub(id){editorTarget=typeof id==='string'?id:'';if(hub&&!hub.isDestroyed()){hub.show();hub.focus();void syncNow(true);if(editorTarget){setHubView('edit');hub.webContents.send('tack:edit',editorTarget);}return;}
 const d=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
 hub=new BrowserWindow({icon:APP_ICON,width:410,height:480,minWidth:370,minHeight:340,x:d.x+Math.max(0,d.width-440),y:d.y+54,show:false,transparent:true,frame:false,hasShadow:true,backgroundColor:'#00000000',title:'TackBoard · Desktop hub',autoHideMenuBar:true,
  webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
 hub.loadFile(path.join(__dirname,'hub.html'));attachEditContextMenu(hub);hub.webContents.on('did-finish-load',()=>{if(editorTarget){setHubView('edit');hub.webContents.send('tack:edit',editorTarget);}});hub.webContents.setWindowOpenHandler(()=>({action:'deny'}));hub.webContents.on('will-navigate',e=>e.preventDefault());
 hub.on('close',e=>{if(!quitting){e.preventDefault();hub.hide();}});
 hub.once('ready-to-show',()=>{hub.show();hub.focus();broadcast();if(getToken())void syncNow(true);});
}
function updateTray(){if(!tray)return;
 const board=state.data.boards.find(b=>b.id===currentBoard());const submenu=state.data.boards.map(b=>({label:b.name,type:'radio',checked:b.id===currentBoard(),click:()=>{state.settings.boardId=b.id;save();syncWindows();broadcast();}}));
 tray.setContextMenu(Menu.buildFromTemplate([
  {label:'TackBoard · '+(board?.name||'Notes'),enabled:false},
  {label:'Open settings / Add note',click:makeHub},
  {label:'Choose board',submenu:submenu.length?submenu:[{label:'No boards',enabled:false}]},
  {label:state.settings.visible?'Hide notes':'Show notes',click:()=>{state.settings.visible=!state.settings.visible;save();syncWindows();}},
  {label:'Always on top',type:'checkbox',checked:state.settings.onTop,click:item=>{state.settings.onTop=item.checked;for(const w of windows.values())w.setAlwaysOnTop(item.checked);save();broadcast();}},
  {label:'Sync now',click:()=>void syncNow(true)},
  {type:'separator'},
  {label:'Open full board on web',click:()=>void shell.openExternal(LIVE_ORIGIN+'/app/tackboard')},
  {label:'Quit TackBoard',click:()=>{quitting=true;app.quit();}}
 ]));}
async function request(method,body,token=getToken()){
 if(!token)return {ok:false,status:401,error:'Pair the desktop app with your Archeon account.'};
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
 try {const res=await fetch(LIVE_ORIGIN+'/api/apps/tackboard/sync',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:ctrl.signal,cache:'no-store',redirect:'error'});
 let doc={};try{doc=await res.json();}catch{}return {...doc,ok:res.ok,status:res.status};}
 catch(e){return {ok:false,status:0,error:e.name==='AbortError'?'Cloud timed out':'Network unavailable'};}
 finally{clearTimeout(timer);}}
function queueFlush(delay=900){clearTimeout(flushTimer);if(!getToken())return;flushTimer=setTimeout(()=>void syncNow(false),delay);}
function apply(op){
 if(state.pending.length>=5000)return {ok:false,error:'Too many queued edits. Please sync first.'};
 try {const next=applyOperation(state.data,op);state.data=next;if(op.type==='new-board')state.settings.boardId=op.board.id;state.pending.push(op);state.pendingVersion++;save();syncWindows();broadcast();queueFlush();return {ok:true};}
 catch(e){return {ok:false,error:e.message};}}
// Server-authoritative revision sync. Each PUT is acknowledged by Neon before its
// queued operations are removed. On a CAS conflict we replay only the queued
// desktop operations over the new cloud document (never the stale whole board).
async function push(){
 if(putInFlight)return false;
 if(!state.pending.length)return true;
 if(!getToken()){report('auth','Pair with your Archeon account to sync.');return false;}
 putInFlight=true;report('syncing');
 let success=false;
 try{
  if(state.accountId){
   const identity=await request('GET');
   if(!identity.ok){report(identity.status===401?'auth':'offline',identity.error||'Could not verify paired account. Local changes were not sent.');return false;}
   if(identity.accountId&&identity.accountId!==state.accountId){
    report('auth','The pairing key belongs to a different account. Local changes were NOT uploaded.');return false;
   }
  }
  for(let attempt=0;attempt<6&&state.pending.length;attempt++){
   const queue=state.pending.slice(),revision=state.revision,payload=state.data;
   const r=await request('PUT',{data:payload,baseRevision:revision});
   if(r.ok){
    if(r.saved!==true||!Number.isSafeInteger(r.revision)||r.revision<=revision){report('offline','Cloud did not confirm the saved revision.');return false;}
    state.revision=r.revision;
    if(r.accountId)state.accountId=r.accountId;
    state.pending.splice(0,queue.length);
    state.lastSyncedAt=Date.now();save();
    // Edits made during the request remain queued; do not claim sync yet.
    if(!state.pending.length)report('online');
    continue;
   }
   if(r.status===409){
    if(!r.data||!validateDoc(r.data)||!Number.isSafeInteger(r.revision)||r.revision<=revision){report('conflict','Invalid cloud conflict response. Local edits are preserved.');return false;}
    try{
     // No data is discarded on a conflict: replay all local operations over
     // the latest cloud version, then attempt another compare-and-swap.
     state.data=replay(r.data,state.pending);state.revision=r.revision;
     if(r.accountId)state.accountId=r.accountId;
     save();syncWindows();
     continue;
    }catch(e){report('conflict','Needs review: '+e.message);return false;}
   }
   report(r.status===401?'auth':'offline',r.error||`Cloud save failed (HTTP ${r.status}).`);
   return false;
  }
  success=!state.pending.length;
  if(!success)report('conflict','Sync needs review after repeated concurrent updates. Your edits are safe.');
  return success;
 }catch(e){report('offline',e.message);return false;}
 finally{putInFlight=false;if(state.pending.length&&state.status!=='conflict'&&state.status!=='auth')queueFlush(12000);}
}
async function pull(){
 if(pullInFlight)return false;
 if(putInFlight||state.pending.length)return false;
 if(!getToken()){report('auth','Pair with your Archeon account to sync.');return false;}
 pullInFlight=true;
 try{
  const r=await request('GET');
  if(!r.ok){report(r.status===401?'auth':'offline',r.error||'Unable to read cloud');return false;}
  if(!Number.isSafeInteger(r.revision)||r.revision<0){report('offline','Cloud returned an invalid revision.');return false;}
  if(state.pending.length)return false; // an edit arrived during the GET
  if(r.revision<state.revision){report('conflict','Cloud revision is older than this device. Local notes are preserved. Verify the account/database.');return false;}
  if(r.revision===0&&!r.data&&(state.revision>0||state.data.notes.length>0)){
   report('conflict','Cloud has no boards, but this device has notes. Export a backup before reconnecting.');return false;
  }
  if(state.accountId&&r.accountId&&state.accountId!==r.accountId){report('auth','This device is paired to a different Archeon account. Reconnect intentionally.');return false;}
  if(r.data&&!validateDoc(r.data)){report('offline','Cloud returned invalid board data.');return false;}
  if(r.data&&r.revision!==state.revision){state.data=r.data;state.revision=r.revision;syncWindows();}
  if(r.accountId)state.accountId=r.accountId;
  state.lastSyncedAt=Date.now();save();report('online');
  return true;
 }catch(e){report('offline',e.message);return false;}
 finally{pullInFlight=false;}
}
let manualSyncPromise=null;
async function syncNow(force=false){
 if(!getToken()){report('auth','Pair with your Archeon account to sync.');return {ok:false,error:state.error};}
 // Serialize explicit refreshes (hub button / tray button) rather than dropping
 // clicks silently while a background poll is busy.
 if(force&&manualSyncPromise)return manualSyncPromise;
 const operation=(async()=>{
  if(state.pending.length){
   // Wait for a scheduled upload already in progress and verify the remaining queue.
   if(putInFlight){for(let i=0;i<40&&putInFlight;i++)await new Promise(r=>setTimeout(r,150));}
   if(state.pending.length&&!await push())return {ok:false,error:state.error||'Cloud save not confirmed.',pending:state.pending.length};
  }
  if(putInFlight){return {ok:false,error:'Sync is still processing. Try again shortly.'};}
  if(pullInFlight){for(let i=0;i<40&&pullInFlight;i++)await new Promise(r=>setTimeout(r,150));}
  const ok=await pull();
  return {ok,revision:state.revision,boardCount:state.data.boards.length,accountId:state.accountId,error:ok?'':state.error};
 })();
 if(force){manualSyncPromise=operation;try{return await operation;}finally{if(manualSyncPromise===operation)manualSyncPromise=null;}}
 return operation;
}
// Pairing is explicitly reviewed. Remote data is never overwritten by a stale
// local snapshot, and no local data is replaced without an automatic backup.
async function useCloudOnly({token}={}){
 if(putInFlight||pullInFlight)return {ok:false,error:'Cloud sync is busy. Try again shortly.'};
 const initialVersion=state.pendingVersion;
 if(!TOKEN.test(token))return {ok:false,error:'Invalid pairing key.'};
 if(getToken() && state.accountId)return {ok:false,error:'Already paired. Disconnect first.'};
 const r=await request('GET',undefined,token);if(!r.ok)return r;
 if(!Number.isSafeInteger(r.revision)||r.revision<0||!r.accountId||(r.data&&!validateDoc(r.data)))return {ok:false,error:'Cloud returned invalid account, revision, or board data.'};
 if(initialVersion!==state.pendingVersion)return {ok:false,error:'New local edits arrived during pairing. Please try again.'};
 try{backupRecovery('before-cloud-only-pairing');}catch{return {ok:false,error:'Recovery backup failed. Local edits were not replaced.'};}
 storeToken(token);state.data=r.data||blankBoard();state.revision=r.revision;state.accountId=r.accountId;state.localDataAccountId=r.accountId;state.settings.boardId='';state.pending=[];state.paired=true;save();syncWindows();report('online');
 return {ok:true,revision:state.revision,accountId:state.accountId,backupSaved:true};
}
async function reviewPending({recoverMissing=false}={}){
 if(putInFlight||pullInFlight)return {ok:false,error:'A sync is already running. Wait a moment and try again.'};
 if(!getToken())return {ok:false,error:'Pair with an Archeon account first.'};
 if(!state.pending.length)return {ok:true,empty:true};
 const recoveryVersion=state.pendingVersion;
 const r=await request('GET');if(!r.ok)return r;
 if(!r.data||!validateDoc(r.data)||!Number.isSafeInteger(r.revision))return {ok:false,error:'Cloud returned an invalid document.'};
 if(!r.accountId || (state.accountId && r.accountId!==state.accountId))return {ok:false,error:'Account mismatch: local queued edits were NOT uploaded.'};
 if(r.revision<state.revision)return {ok:false,error:'Cloud revision is older than this device. No changes were made.'};
 let plan;
 try{plan=planMerge(r.data,state.data,state.pending,{recoverMissing});}catch(e){return {ok:false,error:'Reconciliation needs review: '+e.message};}
 if(plan.needsRecovery)return {ok:false,needsRecovery:true,missing:plan.missing,error:`${plan.missing.length} queued local note(s) no longer exist in the cloud.`};
 try{backupRecovery('before-queued-edit-reconciliation');}catch{return {ok:false,error:'Recovery backup failed. Pending edits were preserved.'};}
 // Keep all local changes added while the cloud request was underway.
 // If another edit was queued concurrently we refuse to replace the queue.
 if(recoveryVersion!==state.pendingVersion)return {ok:false,error:'New local edits arrived during recovery. Review again.'};
 state.data=plan.data;state.pending=plan.queue;state.revision=r.revision;state.accountId=r.accountId;state.localDataAccountId=r.accountId;save();syncWindows();report(state.pending.length?'syncing':'online');
 if(state.pending.length)queueFlush(100);
 return {ok:true,recovered:plan.recovered,queued:state.pending.length};
}

function registerIPC(){
 ipcMain.handle('tb:state',()=>snapshot());
 ipcMain.handle('tb:operation',(_e,op)=>apply(op));
 ipcMain.handle('tb:board',(_e,id)=>{if(!state.data.boards.some(b=>b.id===id))return false;state.settings.boardId=id;save();syncWindows();return true;});
 ipcMain.handle('tb:hub',()=>{makeHub();return true;});
 ipcMain.handle('tb:hide-hub',()=>{if(hub&&!hub.isDestroyed())hub.hide();return true;});
 ipcMain.handle('tb:hub-view',(_e,view)=>{if(!['front','settings','edit'].includes(view))return false;setHubView(view);return true;});
 ipcMain.handle('tb:edit-note',(_e,id)=>{if(!state.data.notes.some(n=>n.id===id))return false;makeHub(id);return true;});
 ipcMain.handle('tb:visibility',(_e,visible)=>{state.settings.visible=!!visible;save();syncWindows();return true;});
 ipcMain.handle('tb:on-top',(_e,on)=>{state.settings.onTop=!!on;for(const w of windows.values())w.setAlwaysOnTop(!!on);save();broadcast();return true;});
 ipcMain.handle('tb:expand',(_e,id)=>{if(!windows.has(id))return false;state.expanded[id]=!state.expanded[id];resizeNoteWindows();return state.expanded[id];});
 ipcMain.handle('tb:theme',(_e,theme)=>{if(!['system','light','dark'].includes(theme))return false;state.settings.theme=theme;save();broadcast();return true;});
 ipcMain.handle('tb:note-size',(_e,size)=>{if(!['small','medium','large'].includes(size))return false;state.settings.noteSize=size;resizeNoteWindows();return true;});
 ipcMain.handle('tb:note-size-for',(_e,id,size)=>{if(!state.data.notes.some(n=>n.id===id)||!['default','small','medium','large'].includes(size))return false;
  if(size==='default')delete state.noteSizes[id];else state.noteSizes[id]=size;resizeNoteWindows();return true;});
 ipcMain.handle('tb:note-expanded',(_e,id)=>!!state.expanded[id]);
 // The ordinary connection flow always adopts the cloud document. The legacy merge helper is not exposed.
 ipcMain.handle('tb:connect',(_e,p)=>p?.confirmReplace===true?useCloudOnly({token:p.token}):{ok:false,error:'Confirm cloud replacement before pairing.'});
 ipcMain.handle('tb:review',(_e,p)=>reviewPending(p));
 ipcMain.handle('tb:disconnect',()=>{deleteToken();state.paired=false;state.localDataAccountId=state.accountId||state.localDataAccountId;state.accountId='';save();report('local');return true;});
 ipcMain.handle('tb:sync',()=>syncNow(true));
 ipcMain.handle('tb:backup',async()=>{
  const options={
   title:'Back up TackBoard notes',defaultPath:`tackboard-backup-${new Date().toISOString().slice(0,10)}.json`,
   filters:[{name:'TackBoard JSON backup',extensions:['json']}]
  };
  const target=hub&&!hub.isDestroyed()?await dialog.showSaveDialog(hub,options):await dialog.showSaveDialog(options);
  if(target.canceled||!target.filePath)return {ok:false,canceled:true};
  try{fs.writeFileSync(target.filePath,JSON.stringify(state.data,null,2),{mode:0o600});return {ok:true};}
  catch{return {ok:false,error:'Could not save the backup file.'};}
 });
 ipcMain.handle('tb:backup-recovery',async()=>{
  const options={title:'Export complete TackBoard recovery backup',defaultPath:`tackboard-recovery-${new Date().toISOString().slice(0,10)}.json`,filters:[{name:'TackBoard recovery JSON',extensions:['json']}]} ;
  const target=hub&&!hub.isDestroyed()?await dialog.showSaveDialog(hub,options):await dialog.showSaveDialog(options);
  if(target.canceled||!target.filePath)return {ok:false,canceled:true};
  try{atomic(target.filePath,{format:'tackboard-desktop-recovery-v1',createdAt:new Date().toISOString(),accountId:state.accountId||state.localDataAccountId,revision:state.revision,data:state.data,pending:state.pending,settings:state.settings});return {ok:true};}
  catch{return {ok:false,error:'Could not export complete recovery backup.'};}
 });
 ipcMain.handle('tb:login-item',(_e,enabled)=>{app.setLoginItemSettings({openAtLogin:!!enabled});state.settings.launchAtLogin=!!enabled;save();broadcast();return true;});
 ipcMain.handle('tb:web',()=>shell.openExternal(LIVE_ORIGIN+'/app/tackboard'));
}
app.requestSingleInstanceLock() || app.quit();
app.on('second-instance',()=>makeHub());
app.whenReady().then(()=>{
 // macOS uses the native Edit menu roles for reliable Cmd+V in frameless windows.
 if(process.platform==='darwin')Menu.setApplicationMenu(Menu.buildFromTemplate([
  {role:'appMenu'},
  {label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},
   {role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
  {role:'windowMenu'},
 ]));
 if(process.platform==='win32')app.setAppUserModelId('app.archeon.tackboard');
 if(process.platform==='darwin') {app.dock?.setIcon(APP_ICON);app.dock?.hide();}
 load();state.paired=!!getToken();
 nativeTheme.on('updated',()=>{if(state.settings.theme==='system')broadcast();});
 registerIPC();
 // Use one TackBoard icon everywhere: the packaged app, window, hub and system tray.
 // macOS status items are measured in *points*, not raw source-image pixels.
 // tray-icon.png is 18x18 pt; tray-icon@2x.png provides a sharp Retina rendition.
 const trayIconPath=path.join(__dirname,'../assets',process.platform==='darwin'?'tray-icon.png':'icon.ico');
 let trayIcon=nativeImage.createFromPath(trayIconPath);
 if(trayIcon.isEmpty())trayIcon=nativeImage.createFromPath(path.join(__dirname,'../assets/icon.png'));
 if(process.platform==='darwin'&&!trayIcon.isEmpty()){
   const s=trayIcon.getSize();
   if(s.width>20||s.height>20)trayIcon=trayIcon.resize({width:18,height:18});
 }
 tray=new Tray(trayIcon);tray.setToolTip('TackBoard · desktop sticky notes');
 tray.on('click',()=>{if(process.platform==='win32')makeHub();}); tray.on('double-click',makeHub);
 syncWindows();updateTray();
 if(!state.paired)makeHub();else void syncNow(true);
 // Poll silently for changes made in the web app or on other devices.
 // Also refresh promptly when the computer wakes or the hub is reopened.
 pollTimer=setInterval(()=>void syncNow(false),8000);
 const {powerMonitor}=require('electron');
 powerMonitor.on('resume',()=>void syncNow(true));
 for(const ev of ['display-added','display-removed','display-metrics-changed'])screen.on(ev,reconcileDisplays);
 app.on('activate',makeHub);
});
app.on('before-quit',()=>{quitting=true;clearInterval(pollTimer);clearTimeout(flushTimer);for(const t of moveTimers.values())clearTimeout(t);});
app.on('window-all-closed',()=>{/* Tray remains running after settings are closed. */});

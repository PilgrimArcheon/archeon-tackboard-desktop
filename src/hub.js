'use strict';
(()=>{
 const $=id=>document.getElementById(id),id=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
 let state=null,editing=null,editDraft=null;
 let visibleView='front';
 function showView(view){
  visibleView=view;
  $('frontView').classList.toggle('hidden',view!=='front');
  $('settingsView').classList.toggle('hidden',view!=='settings');
  $('editPanel').classList.toggle('hidden',view!=='edit');
  $('settingsToggle').setAttribute('aria-expanded',String(view==='settings'));
  $('settingsToggle').setAttribute('aria-label',view==='settings'?'Back to active board':'Open settings');
  $('settingsToggle').textContent=view==='settings'?'←':'⚙';
  void window.tack.hubView(view);
 }
 const showMessage=(message,warn=false)=>{$('message').textContent=message;$('message').classList.toggle('warn',warn);};
 const boardId=()=>state?.settings.boardId||state?.data.activeBoardId;
 function render(s){state=s;
  document.documentElement.dataset.theme=s.effectiveTheme||'dark';
  const select=$('boards'),was=select.value;select.replaceChildren();for(const b of s.data.boards){const opt=document.createElement('option');opt.value=b.id;opt.textContent=b.name;select.append(opt);}
  for (const [value,label] of [['__create__','+ Create new board…'],['__rename__','✎ Rename current board…']]) {const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
  select.value=s.data.boards.some(b=>b.id===s.settings.boardId)?s.settings.boardId:s.data.activeBoardId;
  const notes=s.data.notes.filter(n=>n.boardId===boardId()&&!n.archivedAt);
  $('count').textContent=notes.length+' active · '+s.data.notes.filter(n=>n.boardId===boardId()&&n.archivedAt).length+' completed'+(notes.length>s.limit?' · '+s.limit+' shown':'');
  const recent=$('recent');recent.replaceChildren();const sorted=s.data.notes.filter(n=>n.boardId===boardId()).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,8);
  if(sorted.length){const header=document.createElement('p');header.className='recent-title';header.textContent='RECENT NOTES';recent.append(header);}
  for(const n of sorted){const row=document.createElement('div');row.className='recent-row';const title=document.createElement('span');title.textContent=(n.archivedAt?'✓  ':'•  ')+n.title;title.title=n.archivedAt?'Completed note':'Active note';const btn=document.createElement('button');btn.className='subtle';btn.textContent=n.archivedAt?'Restore':'Edit';btn.onclick=()=>{if(n.archivedAt)void op({type:'restore-note',noteId:n.id});else openEdit(n.id);};row.append(title,btn);recent.append(row);}
  $('appearance').value=s.settings.theme||'system';
  $('noteSize').value=s.settings.noteSize||'medium';
  $('onTop').checked=s.settings.onTop;$('toggleVisible').textContent=s.settings.visible?'Hide notes':'Show notes';$('launch').checked=!!s.settings.launchAtLogin;
  $('status').textContent=s.status.toUpperCase()+(s.pending?' · '+s.pending+' queued':'')+(s.paired?` · cloud rev ${s.revision}`:'');
  $('status').title=s.accountId?`Connected account: ${s.accountId}`:'Not connected';
  $('cloudAccount').textContent=s.accountId?`Account ${s.accountId.slice(0,8)}…`:'';
  $('pairingControls').classList.toggle('hidden',!!s.paired);
  $('connectedControls').classList.toggle('hidden',!s.paired);
  $('recoveryControls').classList.toggle('hidden',!s.paired||!s.pending);
  $('recoveryHint').textContent=s.pending?`${s.pending} local edit(s) awaiting cloud confirmation`:'';
  if(s.error)showMessage(s.error,true);
  if(editing){const n=s.data.notes.find(n=>n.id===editing);if(!n){editing=null;showView('front');}}
 }
 function openEdit(noteId){const n=state?.data.notes.find(x=>x.id===noteId);if(!n)return;editing=noteId;editDraft=structuredClone(n);showView('edit');
  $('editTitle').value=n.title;$('editBody').value=n.body;$('editSize').value=state.noteSizes?.[noteId]||'default';$('editColor').value=n.color;$('editStatus').value=n.status;renderEditTasks();
  $('editPanel').scrollIntoView({behavior:'smooth',block:'nearest'});}
 function renderEditTasks(){const area=$('editTasks');area.replaceChildren();if(!editDraft)return;
  for(const t of editDraft.tasks){const row=document.createElement('div');row.className='edit-task';
    const check=document.createElement('input');check.type='checkbox';check.checked=t.done;check.onchange=()=>{t.done=check.checked;};
    const input=document.createElement('input');input.type='text';input.maxLength=180;input.value=t.text;input.oninput=()=>{t.text=input.value;};
    const remove=document.createElement('button');remove.textContent='×';remove.title='Remove task';remove.onclick=()=>{editDraft.tasks=editDraft.tasks.filter(x=>x.id!==t.id);renderEditTasks();};
    row.append(check,input,remove);area.append(row);}
 }
 async function op(obj){const r=await window.tack.operate({...obj,at:Date.now()});if(!r.ok)showMessage(r.error||'Could not save',true);return r.ok;}
 let boardAction='';
 const resetBoardSelector=()=>{if(state) $('boards').value=boardId();};
 const closeBoardEditor=()=>{$('boardEditor').classList.add('hidden');boardAction='';resetBoardSelector();};
 $('boards').onchange=()=>{
  const choice=$('boards').value;
  if(choice==='__create__'||choice==='__rename__'){
   boardAction=choice==='__create__'?'create':'rename';
   $('boardEditLabel').textContent=boardAction==='create'?'NEW BOARD NAME':'RENAME BOARD';
   $('boardName').value=boardAction==='rename'?(state.data.boards.find(b=>b.id===boardId())?.name||''):'';
   $('boardEditor').classList.remove('hidden');$('boardName').focus();resetBoardSelector();return;
  }
  closeBoardEditor();void window.tack.chooseBoard(choice);
 };
 $('boardCancel').onclick=closeBoardEditor;
 $('boardForm').onsubmit=async e=>{e.preventDefault();const name=$('boardName').value.trim();if(!name)return;
  const action=boardAction;const current=boardId();const at=Date.now();
  const ok=await op(action==='create'?{type:'new-board',board:{id:id(),name,createdAt:at}}:{type:'rename-board',boardId:current,name});
  if(ok){closeBoardEditor();showMessage(action==='create'?'Board created. Cloud save queued.':'Board renamed. Cloud save queued.');}
 };
 $('settingsToggle').onclick=()=>{if(visibleView==='edit'){editing=null;editDraft=null;}showView(visibleView==='settings'?'front':'settings');};
 $('appearance').onchange=async()=>{const ok=await window.tack.theme($('appearance').value);if(!ok)showMessage('Could not change appearance.',true);};
 $('noteSize').onchange=async()=>{const ok=await window.tack.noteSize($('noteSize').value);if(!ok)showMessage('Could not save note size.',true);};
 $('toggleVisible').onclick=()=>void window.tack.visibility(!state.settings.visible);
 $('onTop').onchange=()=>void window.tack.onTop($('onTop').checked);
 $('launch').onchange=()=>void window.tack.loginItem($('launch').checked);
 $('quickAdd').onsubmit=async e=>{e.preventDefault();if(!state)return;const title=$('quickTitle').value.trim();if(!title)return;
  const count=state.data.notes.filter(n=>n.boardId===boardId()).length;const at=Date.now();const n={id:id(),boardId:boardId(),title:title.slice(0,90),body:'',color:['butter','mint','lilac','rose','sky','paper'][count%6],status:'planned',tasks:[],x:24,y:24,layer:count+1,createdAt:at,updatedAt:at,archivedAt:null};
  if(await op({type:'new-note',note:n}))$('quickTitle').value='';};
 $('sync').onclick=async()=>{
  $('sync').disabled=true;showMessage('Checking cloud and sending queued changes…');
  try{const result=await window.tack.sync();
   showMessage(result?.ok?`Cloud up to date · revision ${result.revision} · ${result.boardCount} boards. Account ${String(result.accountId||'unknown').slice(0,8)}…`:result?.error||'Sync did not complete. Local notes are preserved.',!result?.ok);
  }catch{showMessage('Could not complete sync. Your notes remain on this computer.',true);}
  finally{$('sync').disabled=false;}
 };
 const pairingMessage=r=>r.ok ? `Connected to cloud account ${String(r.accountId||'').slice(0,8)}…. Your cloud boards are now active. A private recovery backup was also saved.` : r.error||'Could not connect.';
 $('exportBeforeConnect').onclick=async()=>{
  const result=await window.tack.backupRecovery();
  if(!result?.canceled)showMessage(result?.ok?'Backup exported. You can now connect your cloud account.':result?.error||'Export failed.',!result?.ok);
 };
 $('connect').onclick=async()=>{
  const token=$('token').value.trim();if(!token){showMessage('Paste a pairing key first.',true);return;}
  const queued=state?.pending||0;
  const confirmed=confirm(`Connecting this Archeon account will REPLACE all local boards and notes on this device, including ${queued} unsynced edit(s), with the CLOUD VERSION.\n\nYour cloud data will NOT be overwritten.\n\nBefore continuing, use “Export local backup” if you want an easily accessible copy. TackBoard also makes an internal recovery backup.\n\nContinue and replace local boards?`);
  if(!confirmed)return;
  $('connect').disabled=true;
  showMessage('Loading your cloud boards…');
  try {const r=await window.tack.connect({token,confirmReplace:true});showMessage(pairingMessage(r),!r.ok);if(r.ok)$('token').value='';}
  catch {showMessage('Connection failed. Local boards remain unchanged.',true);}
  finally {$('connect').disabled=false;}
 };
 $('review').onclick=async()=>{
  $('review').disabled=true;showMessage('Checking queued edits against the latest cloud version…');
  try {
   let r=await window.tack.review({recoverMissing:false});
   if(r.needsRecovery){
    const names=(r.missing||[]).slice(0,4).map(n=>'• '+n.title).join('\n');
    if(confirm(`Cloud notes were deleted while this computer had unsynced edits:\n${names}\n\nRecover ${r.missing.length} local note(s) as NEW copies and retry sync? A recovery backup will be saved.`)) r=await window.tack.review({recoverMissing:true});
   }
   showMessage(r.ok?(r.empty?'No queued edits.':`Recovery prepared: ${r.recovered||0} note(s) copied; ${r.queued||0} edit(s) ready to sync.`):(r.error||'Recovery canceled. Local edits are safe.'),!r.ok);
  }catch{showMessage('Recovery could not complete. Local edits remain on this computer.',true);}
  finally{$('review').disabled=false;}
 };
 $('backup').onclick=async()=>{const r=await window.tack.backup();if(!r?.canceled)showMessage(r?.ok?'Notes exported successfully.':r?.error||'Backup failed.',!r?.ok);};
 $('backupRecovery').onclick=async()=>{const r=await window.tack.backupRecovery();if(!r?.canceled)showMessage(r?.ok?'Complete recovery backup exported, including queued edits.':r?.error||'Recovery backup failed.',!r?.ok);};
 $('disconnect').onclick=async()=>{if(!confirm('Disconnect this computer? Existing local notes remain. Revoke the pairing key on the website, too.'))return;await window.tack.disconnect();showMessage('Disconnected. Local notes remain on this device.');};
 $('openWeb').onclick=$('openWebBottom').onclick=()=>void window.tack.openWeb();
 $('hideHub').onclick=()=>void window.tack.hideHub();
 $('cancelEdit').onclick=()=>{editing=null;editDraft=null;showView('front');};
 $('addEditTask').onclick=()=>{if(!editDraft||editDraft.tasks.length>=35)return;editDraft.tasks.push({id:id(),text:'',done:false});renderEditTasks();};
 $('saveEdit').onclick=async()=>{if(!editing)return;const n=state.data.notes.find(n=>n.id===editing);if(!n)return;
  const fields={title:$('editTitle').value.trim()||'Untitled',body:$('editBody').value,color:$('editColor').value,status:$('editStatus').value};
  for(const [field,value]of Object.entries(fields))if(value!==n[field]){if(!await op({type:'update-note',noteId:editing,field,value}))return;}
  if(editDraft){
    for(const old of n.tasks){const current=editDraft.tasks.find(t=>t.id===old.id);
      if(!current){if(!await op({type:'remove-task',noteId:editing,taskId:old.id}))return;}
      else{if(old.text!==current.text){if(!await op({type:'update-task',noteId:editing,taskId:old.id,field:'text',value:current.text}))return;}
        if(old.done!==current.done){if(!await op({type:'update-task',noteId:editing,taskId:old.id,field:'done',value:current.done}))return;}}}
    for(const task of editDraft.tasks.filter(t=>!n.tasks.some(old=>old.id===t.id)&&t.text.trim())){
      if(!await op({type:'new-task',noteId:editing,task:{id:task.id,text:task.text}}))return;
      if(task.done){if(!await op({type:'update-task',noteId:editing,taskId:task.id,field:'done',value:true}))return;}}
  }
  const sizeApplied=await window.tack.noteSizeFor(editing,$('editSize').value);if(!sizeApplied){showMessage('Could not save this note size.',true);return;}
  editing=null;editDraft=null;showView('front');};
 $('finishEdit').onclick=async()=>{if(!editing)return;if(await op({type:'archive-note',noteId:editing})){editing=null;showView('front');}};
 window.tack.onState(render);window.tack.onEdit(openEdit);void window.tack.state().then(render);
})();

'use strict';
(()=>{
 const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id');
 let note=null,removing=false;
 const esc='';
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 async function operate(op){const result=await window.tack.operate({...op,noteId:id,at:Date.now()});if(!result.ok){$('taskInput').placeholder=result.error||'Could not save note';}return result;}
 function paint(s){const n=s.data.notes.find(x=>x.id===id);if(!n||n.archivedAt||removing)return;
  note=n;$('paper').dataset.color=n.color;
  const size=s.noteSizes?.[id]||s.settings.noteSize||'medium';
  const expanded=!!s.expanded?.[id];
  $('paper').dataset.noteSize=expanded?(size==='small'?'medium':'large'):size;
  $('expand').textContent=expanded?'⤡':'⤢';
  $('expand').title=expanded?'Return to preferred size':'Expand this note';$('flag').textContent=n.status.toUpperCase();$('title').textContent=n.title;$('body').textContent=n.body||'';
  const area=$('tasks');area.replaceChildren();for(const task of n.tasks){const label=make('label','task'+(task.done?' done':''));const cb=make('input');cb.type='checkbox';cb.checked=!!task.done;
    cb.onchange=async()=>{const result=await operate({type:'update-task',taskId:task.id,field:'done',value:cb.checked});if(result.ok&&note.tasks.every(t=>t.id===task.id?cb.checked:t.done)&&note.tasks.length)peel();};
    label.append(cb,make('span','',task.text));area.append(label);}
  const done=n.tasks.filter(t=>t.done).length;$('progress').textContent=done+' / '+n.tasks.length+' done';$('paper').style.setProperty('--pct',n.tasks.length?`${Math.round(done/n.tasks.length*100)}%`:'0%');
 }
 function peel(){if(removing)return;removing=true;$('paper').classList.add('peeling');setTimeout(()=>void operate({type:'archive-note'}),matchMedia('(prefers-reduced-motion: reduce)').matches?120:1190);}
 $('edit').onclick=()=>void window.tack.editNote(id);$('hub').onclick=()=>void window.tack.openHub();
 $('expand').onclick=()=>void window.tack.expand(id);
 $('archive').onclick=peel;
 $('newTask').onsubmit=async e=>{e.preventDefault();const text=$('taskInput').value.trim();if(!text)return;
  const taskId=typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');const result=await operate({type:'new-task',task:{id:taskId,text}});if(result.ok)$('taskInput').value='';};
 window.tack.onState(paint);void window.tack.state().then(paint);

})();

'use strict';
(() => {
const DATA=JSON.parse(document.getElementById('writing-data').textContent);
const prompts=new Map(DATA.prompts.map(p=>[p.id,p]));
const sets=new Map(DATA.timedSets.map(s=>[s.id,s]));
const KEY='ssat-middle-writing-v1';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storageOK=true,noticeTimer,query='',typeFilter='all';
let state=load();
function blank(){return {version:1,drafts:[],activeId:null,libraryCollapsed:false};}
function text(value,max=200000){return typeof value==='string'?value.slice(0,max):'';}
function normalize(raw){
  const next=blank();if(!raw||raw.version!==1||!Array.isArray(raw.drafts))return next;
  const ids=new Set();
  for(const d of raw.drafts){
    if(!d||typeof d.id!=='string'||d.id.length>100||ids.has(d.id))continue;
    const set=sets.get(d.setId),mode=d.mode==='timed'&&set&&Number.isFinite(d.deadline)&&Number.isFinite(d.startedAt)?'timed':'guided';
    let promptId=prompts.has(d.promptId)?d.promptId:null;
    if(mode==='timed'&&promptId&&!set.promptIds.includes(promptId))promptId=null;
    if(mode==='guided'&&!promptId)continue;
    const plan={};for(const key of ['a','b','c','d','e','notes'])plan[key]=text(d.plan?.[key],10000);
    next.drafts.push({id:d.id,promptId,mode,setId:mode==='timed'?d.setId:null,deadline:mode==='timed'?d.deadline:null,startedAt:Number.isFinite(d.startedAt)?d.startedAt:Date.now(),createdAt:Number.isFinite(d.createdAt)?d.createdAt:Date.now(),updatedAt:Number.isFinite(d.updatedAt)?d.updatedAt:Date.now(),finishedAt:Number.isFinite(d.finishedAt)?d.finishedAt:null,status:d.status==='finished'?'finished':'draft',title:text(d.title,200),body:text(d.body),plan,checks:DATA.checklist.filter(c=>d.checks?.includes(c.id)).map(c=>c.id),reflection:text(d.reflection,5000)});ids.add(d.id);
  }
  next.activeId=ids.has(raw.activeId)?raw.activeId:next.drafts[0]?.id||null;
  const pending=next.drafts.find(d=>d.mode==='timed'&&d.status==='draft');if(pending)next.activeId=pending.id;
  next.libraryCollapsed=raw.libraryCollapsed===true;return next;
}
function load(){try{return normalize(JSON.parse(localStorage.getItem(KEY)));}catch{storageOK=false;return blank();}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;}catch{storageOK=false;}if($('save-status'))$('save-status').textContent=storageOK?'Saved in this browser':'Storage unavailable · download a copy';}
function toast(message){$('toast').textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('toast').textContent='',4200);}
function active(){return state.drafts.find(d=>d.id===state.activeId);}
function timed(){return active()?.mode==='timed'&&active().status==='draft';}
function pendingTimed(){return state.drafts.find(d=>d.mode==='timed'&&d.status==='draft');}
function wordCount(s){return (s.trim().match(/\S+/g)||[]).length;}
function paragraphCount(s){return s.trim()?s.trim().split(/\n+/).filter(s=>s.trim()).length:0;}
function hasWork(d){return !!(d.body.trim()||d.title.trim()||Object.values(d.plan).some(s=>s.trim())||d.status==='finished');}
function createDraft(promptId,options={}){
  const now=Date.now(),id=globalThis.crypto?.randomUUID?.()||`writing-${now}-${Math.random().toString(36).slice(2)}`;
  const d={id,promptId,mode:'guided',setId:null,deadline:null,startedAt:now,createdAt:now,updatedAt:now,finishedAt:null,status:'draft',title:'',body:'',plan:{a:'',b:'',c:'',d:'',e:'',notes:''},checks:[],reflection:'',...options};
  state.drafts.push(d);state.activeId=id;save();return d;
}
function sourceLink(p){return p.file?`reading_materials/${encodeURIComponent(p.file)}#page=${p.page}`:null;}
function eligiblePrompts(){
  const d=active();if(timed())return sets.get(d.setId).promptIds.map(id=>prompts.get(id));
  return DATA.prompts.filter(p=>(typeFilter==='all'||p.type===typeFilter)&&(!query||[p.title,p.text,p.source].join(' ').toLowerCase().includes(query.toLowerCase())));
}
function layout(){
  const compact=window.matchMedia('(max-width:980px)').matches,folded=!compact&&state.libraryCollapsed;
  $('workspace').classList.toggle('library-collapsed',folded);$('library-expand').hidden=!folded;$('library-fold').hidden=compact;
  for(const id of ['library-fold','library-expand'])$(id).setAttribute('aria-expanded',String(!folded));
}
function foldLibrary(){state.libraryCollapsed=!state.libraryCollapsed;save();layout();$(state.libraryCollapsed?'library-expand':'library-fold').focus({preventScroll:true});}
function renderLibrary(){
  const available=eligiblePrompts(),d=active();
  $('library-filters').hidden=timed();$('library-count').textContent=`${available.length} ${timed()?'test choices':'prompts'}`;$('mobile-count').textContent=`${available.length} prompts`;
  $('prompt-total').textContent=timed()?2:DATA.prompts.length;$('prompt-total-label').textContent=timed()?'prompts · choose one':'prompts to explore';
  $('draft-count').textContent=state.drafts.filter(hasWork).length;
  $('prompt-list').innerHTML=available.map(p=>`<button class="library-item${d.promptId===p.id?' active':''}" data-prompt="${p.id}" ${d.promptId===p.id?'aria-current="true"':''}><span class="item-title">${esc(p.title)}</span><span class="prompt-kind">${p.type==='story'?'Story starter':'Personal response'}</span><span class="item-meta">${esc(p.source)}</span></button>`).join('')||'<p class="empty-library">No prompts match. Try another search or prompt type.</p>';
}
function renderPrompt(){
  const d=active(),p=prompts.get(d.promptId);
  if(!p){$('prompt-panel').innerHTML='<div class="source-tag">25-minute writing sample</div><h2 id="prompt-title">Two ideas. One response.</h2><p class="timed-choice-note">Your timer is running. Choose one of the two prompts in the prompt library, then plan and write your response.</p>';return;}
  $('prompt-panel').innerHTML=`<div class="prompt-source"><span class="source-tag">${p.type==='story'?'Story starter':'Personal response'} · Middle Level</span>${sourceLink(p)&&!timed()?`<a href="${sourceLink(p)}" target="_blank" rel="noopener">Source · PDF p. ${p.page} ↗</a>`:`<span>${esc(p.source)}</span>`}</div><h2 id="prompt-title">${esc(p.text)}</h2><p class="prompt-instruction">${p.type==='story'?'Use this sentence as the first sentence of your story.':'Answer the question in your own voice, with specific examples and details.'}</p>`;
}
function updateCounts(){const d=active();$('starter-button').disabled=!!d.body.trim();$('word-count').textContent=`${wordCount(d.body)} words · ${paragraphCount(d.body)} paragraphs`;$('draft-count').textContent=state.drafts.filter(hasWork).length;}
function editable(event,getOld,apply){
  const d=active();if(d.status==='finished'){event.target.value=getOld(d);return;}
  if(timed()&&Date.now()>=d.deadline){event.target.value=getOld(d);finish(true);return;}
  apply(d,event.target.value);d.updatedAt=Date.now();save();updateCounts();
}
function renderPlanner(){
  const d=active(),p=prompts.get(d.promptId),story=p?.type!=='personal';
  const labels=story?['Who is the main character?','Where does the story happen?','What is the challenge?','What choice changes things?','How will the story end?']:['What is my main point?','Which experience or example fits?','Which details bring it to life?','What did I learn or realize?','How will I bring it to a close?'];
  $('planner-card').hidden=d.status==='finished';
  $('planner-fields').innerHTML=timed()?`<label class="plan-field"><strong>Planning notes</strong><textarea id="plan-notes" name="plan-notes" data-plan="notes" rows="7" maxlength="10000" placeholder="Your notes are part of the same 25 minutes.">${esc(d.plan.notes)}</textarea></label><p class="plan-note">Only your response, not these notes, belongs in the writing sample.</p>`:labels.map((label,i)=>`<label class="plan-field"><strong>${i+1}. ${label}</strong><textarea id="plan-${'abcde'[i]}" name="plan-${'abcde'[i]}" data-plan="${'abcde'[i]}" rows="2" maxlength="10000">${esc(d.plan['abcde'[i]])}</textarea></label>`).join('');
  $('planner-fields').querySelectorAll('[data-plan]').forEach(input=>input.addEventListener('input',e=>editable(e,d=>d.plan[input.dataset.plan],(d,value)=>{d.plan[input.dataset.plan]=value;})));
  $('review-card').hidden=d.status!=='finished';
  $('review-fields').innerHTML=DATA.checklist.map(c=>`<label class="check-item"><input type="checkbox" id="review-${c.id}" data-check="${c.id}" ${d.checks.includes(c.id)?'checked':''}><strong>${esc(c.title)}</strong><small>${esc(c.detail)}</small></label>`).join('');
  $('review-fields').querySelectorAll('[data-check]').forEach(input=>input.addEventListener('change',()=>{const d=active();d.checks=d.checks.filter(id=>id!==input.dataset.check);if(input.checked)d.checks.push(input.dataset.check);save();}));
  $('reflection').value=d.reflection;
}
function renderStatus(){
  const d=active();$('mode-label').textContent=d.status==='finished'?'Writing review':timed()?'Timed practice':'Guided practice';
  $('mode-description').textContent=d.status==='finished'?'· reflect, then revise':timed()?'· choose one of two prompts':'· plan, write, reflect';
  $('timer').hidden=!timed();$('finish-button').hidden=d.status==='finished';$('finish-button').disabled=!d.promptId;
  $('timed-button').textContent=timed()?'Finish practice':'25-minute practice ↗';
  $('test-banner').hidden=d.mode!=='timed';
  if(d.mode==='timed')$('test-banner').innerHTML=`<div><strong>${esc(sets.get(d.setId).name)} · ${d.status==='finished'?'Response saved':'25 minutes'}</strong><p>${d.status==='finished'?'Review your response below. The original writing is preserved.':'Choose one prompt. Planning and writing share the same timer.'}</p></div>`;
  $('essay-title').value=d.title;$('essay-title').readOnly=d.status==='finished';$('essay-title').disabled=!d.promptId;
  $('essay').value=d.body;$('essay').readOnly=d.status==='finished';$('essay').disabled=!d.promptId;$('essay').spellcheck=!timed();$('essay').setAttribute('autocorrect',timed()?'off':'on');
  $('editor-mode').textContent=d.status==='finished'?'Finished response · read only':'Your response';
  $('starter-button').hidden=timed()||d.status==='finished'||prompts.get(d.promptId)?.type!=='story';
  $('starter-button').disabled=!!d.body.trim();
  $('draft-actions').innerHTML=d.status==='finished'?'<button class="primary" id="revise-button" '+(!d.promptId?'hidden':'')+'>Revise as a new draft →</button><button class="quiet" id="new-draft">Start a fresh response</button><p>Review your choices. Choose one goal for next time.</p>':'<button class="quiet" id="new-draft" '+(timed()?'hidden':'')+'>Start a fresh response</button><p>A complete response matters more than a particular word count.</p>';
  $('new-draft')?.addEventListener('click',()=>{if(timed())return;createDraft(active().promptId||DATA.prompts[0].id);render();});
  $('revise-button')?.addEventListener('click',()=>{const d=active();createDraft(d.promptId,{title:d.title,body:d.body,plan:{...d.plan}});render();$('essay').focus();});
  updateCounts();save();
}
function render(){layout();renderLibrary();renderPrompt();renderPlanner();renderStatus();tick();}
function selectPrompt(id){
  if(!prompts.has(id))return;
  const d=active();
  if(timed()){
    if(Date.now()>=d.deadline){finish(true);return;}
    if(!sets.get(d.setId).promptIds.includes(id))return;
    d.promptId=id;d.updatedAt=Date.now();save();
  }else{const existing=[...state.drafts].reverse().find(d=>d.promptId===id);if(existing)state.activeId=existing.id;else createDraft(id);}
  render();if(window.matchMedia('(max-width:980px)').matches)$('library').open=false;
}
function modal(title,body){$('modal-content').innerHTML=`<div class="dialog-top"><h2 id="modal-title">${esc(title)}</h2><button id="close-modal" aria-label="Close dialog">×</button></div>${body}`;$('close-modal').onclick=()=>$('modal').close();if(!$('modal').open)$('modal').showModal();}
function setupTimed(){
  if(timed()){confirmFinish();return;}
  modal('One prompt. Twenty-five minutes.',`<p class="dialog-lead">Choose a practice pair. When the timer starts, choose one of its two prompts and plan and write a single response. The timer includes choosing and planning, and keeps running if you leave the page.</p><label class="dialog-field" for="timed-pair">Practice pair<select id="timed-pair">${DATA.timedSets.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><p class="dialog-lead" style="font-size:11px">Your two prompt choices will appear when the timer starts.</p><p class="dialog-lead" style="font-size:11px">Planning notes are separate from your response. Spellcheck and the opening-sentence helper are off during timed practice. Your finished writing will be saved for self-review.</p><div class="dialog-actions"><button id="cancel-timed">Keep practicing</button><button class="primary" id="start-timed">Start 25-minute practice →</button></div>`);
  $('cancel-timed').onclick=()=>$('modal').close();$('start-timed').onclick=()=>startTimed($('timed-pair').value);
}
function startTimed(setId){if(!sets.has(setId)||pendingTimed())return;const now=Date.now();createDraft(null,{mode:'timed',setId,startedAt:now,deadline:now+DATA.minutes*60*1000});$('modal').close();query='';typeFilter='all';$('search').value='';$('type-filter').value='all';render();if(window.matchMedia('(max-width:980px)').matches)$('library').open=true;}
function confirmFinish(){
  if(active().status==='finished')return;
  modal('Ready to read it through?',`<p class="dialog-lead">Save your ${wordCount(active().body)}-word response and move to self-review. Your original response will be read only; you can revise it as a new draft afterward.</p><div class="dialog-actions"><button id="keep-writing">Keep writing</button><button class="primary" id="confirm-finish">Finish & reflect</button></div>`);$('keep-writing').onclick=()=>$('modal').close();$('confirm-finish').onclick=()=>finish(false);
}
function finish(expired=false){
  const d=active();if(d.status==='finished')return;
  d.status='finished';d.finishedAt=expired?d.deadline:Date.now();d.updatedAt=Date.now();save();if($('modal').open)$('modal').close();render();
  if(expired)modal('Time’s up. Your writing is saved.','<p class="dialog-lead">Your response is now read only. Read it through, use the self-review checklist, and choose one goal for next time. You can make a separate revision without changing the timed original.</p><div class="dialog-actions"><button class="primary" id="begin-review">Review my writing →</button></div>');
  if($('begin-review'))$('begin-review').onclick=()=>$('modal').close();
}
function tick(){if(!timed())return;const remaining=Math.max(0,Math.ceil((active().deadline-Date.now())/1000));$('timer').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;$('timer').classList.toggle('urgent',remaining<=300);if(!remaining)finish(true);}
function openDraft(id){if(pendingTimed()&&pendingTimed().id!==id){toast('Finish the timed response before opening another draft.');return;}if(!state.drafts.some(d=>d.id===id))return;state.activeId=id;save();if($('modal').open)$('modal').close();render();}
function showDrafts(){
  if(timed()){toast('Finish the timed response before opening other drafts.');return;}
  const drafts=[...state.drafts].filter(d=>hasWork(d)||d.mode==='timed').sort((a,b)=>b.updatedAt-a.updatedAt);
  modal('Your writing, in progress.',`<p class="dialog-lead">Drafts and completed responses are saved in this browser. Finished originals stay read only; a revision is saved separately.</p>${drafts.length?drafts.map(d=>`<section class="draft-row"><div><h3>${esc(d.title||prompts.get(d.promptId)?.title||'Prompt not yet chosen')}</h3><p>${d.mode==='timed'?'Timed':'Guided'} · ${d.status==='finished'?'Finished':'Draft'} · ${wordCount(d.body)} words · ${new Date(d.updatedAt).toLocaleDateString()}</p></div><button data-open-draft="${esc(d.id)}">Open →</button></section>`).join(''):'<p class="dialog-lead">Your first response starts with a few words. It will appear here as you write.</p>'}<div class="data-actions"><button id="backup-button">Back up all drafts</button><button id="restore-button">Merge a backup</button><input id="restore-file" type="file" accept="application/json,.json" hidden></div>`);
  $('modal-content').querySelectorAll('[data-open-draft]').forEach(b=>b.onclick=()=>openDraft(b.dataset.openDraft));$('backup-button').onclick=()=>download(JSON.stringify(state,null,2),'ssat-writing-drafts.json','application/json');$('restore-button').onclick=()=>$('restore-file').click();$('restore-file').onchange=restoreBackup;
}
async function restoreBackup(event){
  const file=event.target.files?.[0];if(!file)return;
  try{if(file.size>10*1024*1024)throw Error('Choose a backup smaller than 10 MiB.');const raw=JSON.parse(await file.text());if(raw.version!==1||!Array.isArray(raw.drafts))throw Error('Choose an SSAT writing backup.');const imported=normalize(raw);if(imported.drafts.some(d=>d.mode==='timed'&&d.status==='draft'))throw Error('Finish the timed response in the original browser before merging this backup.');
    let added=0;for(const d of imported.drafts){const current=state.drafts.find(x=>x.id===d.id);if(!current){state.drafts.push(d);added++;}else if(JSON.stringify(current)!==JSON.stringify(d)){state.drafts.push({...d,id:globalThis.crypto?.randomUUID?.()||`import-${Date.now()}-${Math.random()}`});added++;}}
    save();showDrafts();toast(`${added} response${added===1?'':'s'} added. Existing drafts were kept.`);
  }catch(error){toast(error.message||'Could not read this backup.');}
}
function download(content,filename,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportText(){const d=active(),p=prompts.get(d.promptId);download([d.title||p?.title||'Writing practice','SSAT Middle Level · '+(d.mode==='timed'?'25-minute practice':'Guided practice'),'',p?'Prompt: '+p.text:'No prompt chosen.','Source: '+(p?.source||''),'',d.body,'','Planning notes (not part of the response):',...Object.values(d.plan).filter(Boolean),'',d.reflection?'Next time: '+d.reflection:''].join('\n'),'ssat-writing-response.txt');}
function printCopy(){const d=active();$('print-copy').innerHTML=`${d.title?'<h2>'+esc(d.title)+'</h2>':''}<div>${esc(d.body)}</div>`;}
function showSources(){modal('Sources & Middle Level format',`<p class="dialog-lead">Eight prompts come from the explicitly labeled SSAT Middle Level writing sections in your local materials. Twelve are original practice prompts created for this page.</p>${[...new Set(DATA.prompts.filter(p=>p.file).map(p=>p.source))].map(source=>{const p=DATA.prompts.find(p=>p.source===source);return `<section class="source-row"><h3>${esc(source)}</h3><p>Middle Level writing sample · PDF page ${p.page} · two prompts.</p><a href="${sourceLink(p)}" target="_blank" rel="noopener">Open local source ↗</a></section>`;}).join('')}<section class="source-row"><h3>Timed practice</h3><p>Each of the seven pairs offers one story starter and one personal prompt. You choose one and have 25 minutes, including planning. The Test Ninjas pair is retained from its source; the other six pairs are original practice.</p><p>Older Ivy, Princeton, and Kaplan samples offer two story starters. Their prompts are available individually in guided practice. Upper Level, ISEE, and argumentative essay drills are excluded.</p><a href="${esc(DATA.formatSource)}" target="_blank" rel="noopener">Official Middle Level format ↗</a></section><section class="source-row"><h3>About feedback</h3><p>The checklist and writing tips were prepared for this page. They guide self-review and do not generate a score. Source prompts remain credited to their publishers.</p></section>`);}
function showGuide(){modal('Plan. Write. Read it again.',`<p class="dialog-lead">A flexible practice routine: spend a few minutes choosing and planning, most of your time drafting, and the final few minutes rereading. These are practice suggestions, not official timing rules.</p><section class="source-row"><h3>For a story</h3><p>Keep the supplied opening sentence. Give one main character a clear goal or problem. Build a small sequence of connected events, show a choice, and end with a consequence or change.</p></section><section class="source-row"><h3>For a personal response</h3><p>Answer each part of the prompt. Choose one specific experience or example, explain the details that matter, and show what you learned or why the topic is important to you.</p></section><section class="source-row"><h3>For either kind of writing</h3><p>Choose a manageable idea. Use details you can explain clearly, put related ideas together in paragraphs, and save time to check the ending, missing words, and punctuation.</p></section><p class="dialog-lead">The sample is unscored. Your goal is to make your thinking and your voice clear to a reader.</p>`);}
$('essay').addEventListener('input',e=>editable(e,d=>d.body,(d,value)=>{d.body=value;}));$('essay-title').addEventListener('input',e=>editable(e,d=>d.title,(d,value)=>{d.title=value;}));
$('reflection').addEventListener('input',e=>{active().reflection=e.target.value;save();});
$('prompt-list').addEventListener('click',e=>{const b=e.target.closest('[data-prompt]');if(b)selectPrompt(b.dataset.prompt);});
$('search').oninput=e=>{query=e.target.value;renderLibrary();};$('type-filter').onchange=e=>{typeFilter=e.target.value;renderLibrary();};
$('library-fold').onclick=foldLibrary;$('library-expand').onclick=foldLibrary;
$('focus-button').onclick=()=>{const on=document.body.classList.toggle('focused');$('focus-button').textContent=on?'Exit focus':'Focus view';$('focus-button').setAttribute('aria-pressed',String(on));};
$('timed-button').onclick=setupTimed;$('finish-button').onclick=confirmFinish;$('drafts-button').onclick=showDrafts;$('guide-button').onclick=showGuide;$('sources-button').onclick=showSources;
$('starter-button').onclick=()=>{const d=active(),p=prompts.get(d.promptId);if(timed()||d.status==='finished'||d.body.trim()||p?.type!=='story')return;d.body=p.text+'\n\n';d.updatedAt=Date.now();save();renderStatus();$('essay').focus();};
$('export-button').onclick=exportText;$('print-button').onclick=()=>{printCopy();window.print();};window.addEventListener('beforeprint',printCopy);
const compact=window.matchMedia('(max-width:980px)');compact.addEventListener('change',()=>{$('library').open=!compact.matches;layout();});if(compact.matches)$('library').open=false;
window.addEventListener('focus',tick);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
if(!active())createDraft(DATA.prompts[0].id);render();setInterval(tick,1000);
window.WritingApp={data:DATA,snapshot:()=>JSON.parse(JSON.stringify({state,active:active()})),selectPrompt,startTimed,finish,openDraft,wordCount,paragraphCount,tick};
})();

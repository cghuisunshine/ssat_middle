// Run in an isolated writing-page browser context. Restores the saved state afterward.
(async()=>{
const app=WritingApp,$=id=>document.getElementById(id),original=localStorage.getItem('ssat-middle-writing-v1');
const assert=(v,m)=>{if(!v)throw Error(m);};
const input=(element,value)=>{element.value=value;element.dispatchEvent(new Event('input',{bubbles:true}));};
const reports=[];
try{
 assert(app.data.prompts.length===20,'20 prompts');assert(!app.snapshot().active||app.snapshot().active.mode==='guided','Guided mode initially');
 for(const p of app.data.prompts){app.selectPrompt(p.id);assert($('prompt-title').textContent===p.text,p.id+' rendered faithfully');assert(document.querySelectorAll('[data-plan]').length===5,p.id+' planner');}
 app.selectPrompt('ivy-a');$('starter-button').click();assert($('essay').value.startsWith(app.data.prompts[0].text),'Opening sentence inserted');
 const body='It was unlike any place I’d ever been.\n\nI followed a path past the old garden.\nA light appeared in the window.';
 input($('essay'),body);input($('essay-title'),'The garden');input(document.querySelector('[data-plan="a"]'),'A curious visitor');
 const first=app.snapshot().active;assert(first.body===body&&first.plan.a==='A curious visitor','Writing and planning saved');
 assert($('starter-button').disabled,'Helper cannot overwrite existing response');
 assert(app.wordCount(body)>0&&app.paragraphCount(body)===3,'Word and paragraph counts');
 app.selectPrompt('original-1b');input($('essay'),'I learned to repair a bicycle.');app.selectPrompt('ivy-a');assert($('essay').value===body,'Switching prompts preserves draft');
 $('type-filter').value='personal';$('type-filter').dispatchEvent(new Event('change'));assert(document.querySelectorAll('[data-prompt]').length===7,'Personal prompt filter');
 $('search').value='not-a-real-prompt-xyz';$('search').dispatchEvent(new Event('input'));assert(document.querySelector('.empty-library'),'Search empty state');
 $('search').value='';$('search').dispatchEvent(new Event('input'));$('type-filter').value='all';$('type-filter').dispatchEvent(new Event('change'));
 app.finish();const finished=app.snapshot().active;assert($('essay').readOnly&&!$('review-card').hidden,'Finished response locked and review visible');
 document.querySelector('[data-check="prompt"]').click();input($('reflection'),'Use more precise details.');assert(app.snapshot().active.checks.includes('prompt'),'Self-review saved');
 $('revise-button').click();assert(app.snapshot().active.id!==finished.id&&app.snapshot().active.mode==='guided','Revision has a separate id');input($('essay'),'A revised response.');
 assert(app.snapshot().state.drafts.find(d=>d.id===finished.id).body===body,'Revision does not modify original');
 reports.push('All prompts, planners, filters, autosaving, safe starter insertion, original preservation, separate revision, and self-review');
 for(const set of app.data.timedSets){
  app.startTimed(set.id);let a=app.snapshot().active;assert(!a.promptId&&$('essay').disabled,'Choose after timer starts');
  assert(document.querySelectorAll('[data-prompt]').length===2,'Only two timed choices');assert(a.deadline-a.startedAt===1500000,'Exactly 25 minutes');
  const before=app.snapshot().active.promptId;app.selectPrompt(app.data.prompts.find(p=>!set.promptIds.includes(p.id)).id);assert(app.snapshot().active.promptId===before,'Outside prompts blocked');
  app.selectPrompt(set.promptIds[1]);input($('essay'),'My personal response.');app.selectPrompt(set.promptIds[0]);assert($('essay').value==='My personal response.','Changing choice keeps response');
  assert(!$('essay').spellcheck&&$('starter-button').hidden,'Timed helpers off');
  input($('essay'),'A timed story response.');input(document.querySelector('[data-plan="notes"]'),'A short plan.');
  const now=Date.now;Date.now=()=>app.snapshot().active.deadline+1;
  try{input($('essay'),'This input is too late.');}finally{Date.now=now;}
  a=app.snapshot().active;assert(a.status==='finished'&&a.body==='A timed story response.','Late input rejected and response frozen');
  assert($('essay').readOnly,'Timed editor is read only');assert(a.plan.notes==='A short plan.','Timed plan retained');
  $('modal').close();const count=app.snapshot().state.drafts.length;app.finish();assert(app.snapshot().state.drafts.length===count,'Finishing twice does not duplicate');
 }
 reports.push('Seven timed pairs: one of two choices, 25-minute deadline, prompt restriction, disabled helpers, expiry, late-input rejection, and preserved plans');
 app.startTimed('original-1');const now=Date.now;Date.now=()=>app.snapshot().active.deadline+1;try{app.tick();}finally{Date.now=now;}
 assert(app.snapshot().active.status==='finished'&&!app.snapshot().active.promptId,'Blank unchosen timed session closes safely');$('modal').close();assert($('revise-button').hidden,'No invalid revision for an unchosen prompt');$('new-draft').click();assert(app.snapshot().active.promptId&&app.snapshot().active.mode==='guided','Can write again after blank expiry');
 input($('essay'),'<img src=x onerror=alert(1)> & <script>bad()</script>');app.finish();assert(!document.querySelector('.writing-paper img,.writing-paper script'),'Essay text is not interpreted as HTML');
 $('print-button').onclick=()=>{};window.dispatchEvent(new Event('beforeprint'));assert($('print-copy').textContent.includes('<img src=x'),'Print text safely escaped');
 // Merge an earlier backup without removing existing responses.
 const snapshot=app.snapshot(),existingCount=snapshot.state.drafts.length;const item={...snapshot.active,id:'restored-example-id',body:'A restored response.'};
 $('drafts-button').click();const file=new File([JSON.stringify({version:1,drafts:[item]})],'drafts.json',{type:'application/json'});Object.defineProperty($('restore-file'),'files',{value:[file],configurable:true});await $('restore-file').onchange({target:$('restore-file')});
 assert(app.snapshot().state.drafts.length===existingCount+1,'Backup merge adds a response');assert(app.snapshot().state.drafts.some(d=>d.id===snapshot.active.id),'Backup merge keeps current draft');$('modal').close();
 reports.push('Blank expiry, HTML-safe writing/printing, and backup merge preserving existing drafts');
 return {passed:true,reports};
}finally{if(original===null)localStorage.removeItem('ssat-middle-writing-v1');else localStorage.setItem('ssat-middle-writing-v1',original);}
})();

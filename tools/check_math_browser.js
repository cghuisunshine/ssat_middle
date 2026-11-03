// Run in an isolated math-page browser context. Restores saved browser state afterward.
(async()=>{
 const app=MathApp,$=id=>document.getElementById(id),original=localStorage.getItem('ssat-middle-math-v1'),reports=[];
 const assert=(condition,message)=>{if(!condition)throw Error(message);};
 const input=(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
 try{
  assert(!app.snapshot().state.session,'Guided mode initially');
  const first=app.data.questions[0];app.selectQuestion(first.id);app.retry();
  assert(!$('question-card').querySelector('.feedback'),'No solution before checking');
  document.querySelector(`input[name=answer][value="${first.answer}"]`).click();$('check-answer').click();assert(document.querySelector('.feedback:not(.wrong)'),'Radio selection grades correctly');
  let count=app.snapshot().stats.checked;app.checkAnswer();assert(app.snapshot().stats.checked===count,'Cannot double-count grading');
  app.retry();app.selectAnswer((first.answer+1)%5);app.checkAnswer();assert(document.querySelector('.feedback.wrong'),'Incorrect answer explained');
  app.retry();app.checkAnswer(true);assert(app.snapshot().state.records[first.id].selected===null,'Revealing is not counted correct');
  for(const q of app.data.questions){app.selectQuestion(q.id);app.retry();app.selectAnswer(q.answer);app.checkAnswer();assert(document.querySelector('.feedback:not(.wrong)'),q.id+' grading');for(const step of q.steps)assert($('question-card').textContent.includes(step),q.id+' step present');if(q.diagramSvg){const svg=document.querySelector('.math-diagram svg');assert(svg&&svg.getAttribute('aria-label'),q.id+' accessible diagram');const b=svg.getBBox(),v=svg.viewBox.baseVal;assert(b.x>=v.x-4&&b.y>=v.y-4&&b.x+b.width<=v.x+v.width+4&&b.y+b.height<=v.y+v.height+4,q.id+' unclipped diagram');}}
  assert(app.snapshot().stats.correct===150,'All 150 questions can be graded correctly');reports.push('150 questions graded with all worked steps, 35 accessible unclipped diagrams, incorrect/reveal/retry paths, and no duplicate grading');
  app.selectQuestion(first.id);input($('scratch'),'<img src=x onerror=alert(1)> & my calculation');$('flag-question').click();app.selectQuestion(app.data.questions[1].id);app.selectQuestion(first.id);assert($('scratch').value.includes('<img'),'Scratch restored as plain text');assert(!document.querySelector('.scratch-card img'),'Scratch is escaped');
  $('topic-filter').value='Algebra';$('topic-filter').dispatchEvent(new Event('change'));assert([...document.querySelectorAll('[data-question]')].every(b=>app.data.questions.find(q=>q.id===b.dataset.question).topic==='Algebra'),'Topic filtering');
  $('search').value='no-such-question-xyz';$('search').dispatchEvent(new Event('input'));assert(document.querySelector('.empty-library'),'Search empty state');
  $('search').value='';$('search').dispatchEvent(new Event('input'));$('topic-filter').value='all';$('topic-filter').dispatchEvent(new Event('change'));
  $('library-fold').click();assert(getComputedStyle($('library')).display==='none'&&!$('library-expand').hidden,'Navigation folds');$('library-expand').click();assert(getComputedStyle($('library')).display!=='none','Navigation reopens');
  reports.push('Topic/search filters, flags, HTML-safe saved scratch notes, and foldable navigation');
  for(const [setId,set] of Object.entries(app.data.sets)){
   app.startSession(setId);assert(app.snapshot().state.session.deadline-app.snapshot().state.session.startedAt===1800000,'Exactly 30 minutes');assert(document.querySelectorAll('[data-question]').length===25,'Only 25 assigned questions');assert($('question-total').textContent==='25'&&$('set-total').textContent==='1','Timed counters');assert(!$('scratch').value,'Timed scratch begins blank');assert($('math-guide').disabled,'Reference disabled during test');assert(!document.querySelector('.feedback'),'Guided solutions hidden during timed test');
   const before=app.snapshot().state.activeId,outside=app.data.questions.find(q=>!set.questionIds.includes(q.id));app.selectQuestion(outside.id);assert(app.snapshot().state.activeId===before,'Outside questions blocked');
   let correct=0,wrong=0,skipped=0;
   for(const [i,id] of set.questionIds.entries()){
    const q=app.data.questions.find(q=>q.id===id);app.selectQuestion(id);
    if(i%3===0){app.selectAnswer(q.answer);correct++;}else if(i%3===1){app.selectAnswer((q.answer+1)%5);wrong++;}else skipped++;
    assert(!document.querySelector('.feedback')&&!$('show-answer'),'No answer/solution leak');
    if(i===0)input($('scratch'),'Timed arithmetic steps.');
   }
   app.checkAnswer(true);assert(!document.querySelector('.feedback'),'Reveal API cannot bypass timed mode');app.finish();const score=app.sessionScore();assert(score.correct===correct&&score.wrong===wrong&&score.skipped===skipped&&score.raw===correct-.25*wrong,'Timed grading and skipping');
   const history=app.snapshot().state.history.length;app.finish();assert(app.snapshot().state.history.length===history,'One-time submission');assert(document.querySelector('.feedback'),'Solutions available in review');$('modal').close();app.exitReview();assert(document.querySelectorAll('[data-question]').length===150,'Full bank restored');assert(app.snapshot().state.notes[set.questionIds[0]].includes('Timed arithmetic steps.'),'Timed working preserved for later');
  }
  reports.push('All six sections: 25-question limit, 30-minute deadlines, blank scratch space, no solutions/reference before submission, correct scoring, and preserved timed working');
  app.startSession(Object.keys(app.data.sets)[0]);const now=Date.now;Date.now=()=>app.snapshot().state.session.deadline+1;try{app.selectAnswer(first.answer);}finally{Date.now=now;}assert(app.snapshot().state.session.finished&&app.sessionScore().skipped===25,'Expiry rejects late answers and submits');$('modal').close();app.exitReview();
  reports.push('Timer expiry and late-answer rejection');
  // A backup restore is explicit, rejects other subjects, and preserves scratch text.
  $('progress-button').click();
  const beforeRestore=app.snapshot().state;
  const invalid=new File([JSON.stringify({version:1,records:{}})],'reading.json',{type:'application/json'});
  Object.defineProperty($('restore-file'),'files',{value:[invalid],configurable:true});await $('restore-file').onchange({target:$('restore-file')});
  assert(app.snapshot().state.activeId===beforeRestore.activeId&&$('toast').textContent.includes('math progress backup'),'Other-subject backup rejected');
  const backup={...beforeRestore,session:null,notes:{...beforeRestore.notes,[first.id]:'Restored scratch work.'},activeId:first.id};
  const valid=new File([JSON.stringify(backup)],'math.json',{type:'application/json'});
  Object.defineProperty($('restore-file'),'files',{value:[valid],configurable:true});await $('restore-file').onchange({target:$('restore-file')});
  assert($('confirm-restore')&&app.snapshot().state.notes[first.id]!=='Restored scratch work.','Restoring waits for confirmation');
  $('confirm-restore').click();assert($('scratch').value==='Restored scratch work.','Confirmed backup restores scratch work');
  reports.push('Backup type validation, explicit restore confirmation, and restored scratch work');
  return {passed:true,reports};
 }finally{if(original===null)localStorage.removeItem('ssat-middle-math-v1');else localStorage.setItem('ssat-middle-math-v1',original);}
})();

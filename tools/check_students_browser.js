// Run on content.html in an isolated browser context. Exercises real page reloads.
(async () => {
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const keys=()=>Array.from({length:localStorage.length},(_,i)=>localStorage.key(i));
  const originals=new Map(keys().map(k=>[k,localStorage.getItem(k)]));
  const frame=document.createElement('iframe');frame.style='width:1200px;height:900px';document.body.append(frame);
  const report=[];
  async function loaded(action){await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Page load timed out')),15000);frame.onload=()=>{clearTimeout(timer);resolve();};action();});return frame.contentWindow;}
  const open=filename=>loaded(()=>frame.src=new URL(filename,location.href).href);
  const choose=(win,name)=>loaded(()=>{win.document.getElementById('student-button').click();win.document.getElementById('login-name').value=name;win.document.getElementById('login-form').requestSubmit();});
  const input=(win,id,value)=>{const node=win.document.getElementById(id);node.value=value;node.dispatchEvent(new win.Event('input',{bubbles:true}));};
  const name='QA Peggy '+Date.now(),other='QA Sam '+Date.now();
  try {
    // Start a fresh profile without using any existing student's work.
    let win=await open('content.html');win=await choose(win,name);
    assert(win.SSATUsers.student===name,'Student chosen via form');
    win=await open('ssat_middle_math.html');
    const app=win.MathApp,q=app.data.questions[0];app.selectQuestion(q.id);app.selectAnswer(q.answer);app.checkAnswer();input(win,'scratch','Peggy arithmetic');
    app.startSession(Object.keys(app.data.sets)[0]);const deadline=app.snapshot().state.session.deadline;
    input(win,'scratch','Peggy timed scratch');
    win=await choose(win,other);
    assert(win.SSATUsers.student===other,'Switch creates second student');
    assert(!win.MathApp.snapshot().state.session&&win.MathApp.snapshot().stats.checked===0,'Math and timer start empty for Sam');
    input(win,'scratch','Sam scratch');
    win=await choose(win,name.toUpperCase());
    assert(win.SSATUsers.student===name,'Case-insensitive quick return');
    assert(win.MathApp.snapshot().state.session.deadline===deadline,'Original timed deadline survives switching');
    assert(win.document.getElementById('scratch').value==='Peggy timed scratch','Timed scratch belongs to Peggy');
    win.MathApp.finish();win.document.getElementById('modal').close();win.MathApp.exitReview();
    report.push('Math: separate answers, scratch notes, and timed deadlines across real profile switches');
    win=await open('ssat_middle_reading.html');
    const passage=win.ReadingApp.data.passages[0];win.ReadingApp.selectPassage(passage.id);input(win,'passage-notes','Peggy reading note');
    win=await choose(win,other);assert(!win.ReadingApp.snapshot().state.notes[passage.id],'Reading notes isolated');
    input(win,'passage-notes','Sam reading note');win=await choose(win,name);
    assert(win.ReadingApp.snapshot().state.notes[passage.id]==='Peggy reading note','Reading notes restored');
    report.push('Reading: each student resumes their own notes');
    win=await open('ssat_middle_writing.html');input(win,'essay','Peggy wrote this story.');
    const draftId=win.WritingApp.snapshot().active.id;
    win=await choose(win,other);assert(!win.document.getElementById('essay').value,'New student has a blank writing draft');
    input(win,'essay','Sam wrote a different story.');win=await choose(win,name);
    assert(win.document.getElementById('essay').value==='Peggy wrote this story.'&&win.WritingApp.snapshot().active.id===draftId,'Writing original draft resumes');
    report.push('Writing: separate drafts and autosaved text survive switching');
    win=await open('ssat_middle_vocabulary.html');
    const key='wordwise-ssat-middle-v1',v=JSON.parse(win.SSATUsers.storage.getItem(key));v.records.candid={seen:2,correct:2,wrong:0,level:2,due:123,last:123,star:true};v.settings.chinese=false;win.SSATUsers.storage.setItem(key,JSON.stringify(v));
    win=await loaded(()=>win.location.reload());assert(!win.document.getElementById('chineseToggle').checked,'Vocabulary settings loaded');
    win=await choose(win,other);assert(!JSON.parse(win.SSATUsers.storage.getItem(key)).records.candid,'Vocabulary reviews isolated');
    win=await choose(win,name);assert(JSON.parse(win.SSATUsers.storage.getItem(key)).records.candid.star,'Vocabulary reviews restored');
    assert(!win.document.getElementById('chineseToggle').checked,'Vocabulary settings are student-specific');
    report.push('Vocabulary: separate review records and language preferences');
    win=await choose(win,other);
    assert(win.SSATUsers.student===other,'Active tab identity remains correct');
    win.document.getElementById('student-settings').click();
    win=await loaded(()=>win.document.getElementById('student-signout').click());
    assert(!win.SSATUsers.student&&win.document.getElementById('student-dialog').open,'Sign out returns to required chooser');
    win=await choose(win,name);assert(win.SSATUsers.student===name,'Sign out keeps student available');
    report.push('Sign out and remembered students');
    // Invalid backups must not change the student's progress.
    win.document.getElementById('student-settings').click();
    const before=JSON.stringify(win.SSATUsers.exportStudent().subjects),file=new win.File(['{"kind":"wrong"}'],'invalid.json',{type:'application/json'});
    Object.defineProperty(win.document.getElementById('student-import-file'),'files',{value:[file],configurable:true});
    await win.document.getElementById('student-import-file').onchange({target:win.document.getElementById('student-import-file')});
    assert(win.document.getElementById('student-error').textContent.includes('SSAT student backup'),'Invalid backup rejected');
    assert(JSON.stringify(win.SSATUsers.exportStudent().subjects)===before,'Invalid backup preserves every subject');
    const backup=win.SSATUsers.exportStudent(),mathKey='ssat-middle-math-v1';
    const restoredMath=JSON.parse(backup.subjects[mathKey]);restoredMath.notes={'ivy-s1-q01':'Restored profile scratch'};backup.subjects[mathKey]=JSON.stringify(restoredMath);
    const valid=new win.File([JSON.stringify(backup)],'student.json',{type:'application/json'});
    Object.defineProperty(win.document.getElementById('student-import-file'),'files',{value:[valid],configurable:true});
    await win.document.getElementById('student-import-file').onchange({target:win.document.getElementById('student-import-file')});
    assert(!win.document.getElementById('student-restore-preview').hidden,'Valid backup shows a review step');
    assert(JSON.stringify(win.SSATUsers.exportStudent().subjects)===before,'Review step does not change progress');
    win=await loaded(()=>win.document.getElementById('student-restore-confirm').click());
    assert(JSON.parse(win.SSATUsers.storage.getItem(mathKey)).notes['ivy-s1-q01']==='Restored profile scratch','Confirmed student backup restores progress');
    assert(localStorage.getItem('ssatMiddleRestoreRecovery:'+win.SSATUsers.idFor(name)),'Recovery copy saved before restore');
    report.push('Student backups: invalid-file rejection, review before replacement, confirmed restore, and durable recovery copy');
    return {passed:true,report};
  } finally {
    frame.remove();
    for(const key of keys())if(!originals.has(key))localStorage.removeItem(key);
    for(const [key,value] of originals)localStorage.setItem(key,value);
  }
})();

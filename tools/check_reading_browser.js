// Run in the reading page's browser context. Leaves the original saved state intact.
(() => {
  const app=window.ReadingApp;
  const backup=localStorage.getItem('ssat-middle-reading-v1');
  const reports=[];
  const assert=(condition,message)=>{if(!condition)throw Error(message);};
  const $=id=>document.getElementById(id);
  try {
    assert(app,'App initialized');
    assert(app.data.passages.length===37,'37 passages');
    assert(app.data.passages.flatMap(p=>p.questions).length===182,'182 questions');
    assert(app.data.passages.every(p=>p.level==='Middle'),'Middle Level only');
    assert(!app.snapshot().state.session,'Start tests in guided mode');
    const first=app.data.passages[0];
    app.selectPassage(first.id);app.goQuestion(0);app.retryQuestion();
    assert(!$('question-card').querySelector('.feedback'),'No explanation before grading');
    document.querySelector(`input[name=answer][value="${first.questions[0].answer}"]`).click();
    $('check-answer').click();
    assert($('question-card').querySelector('.feedback:not(.wrong)'),'Radio click grades correct answer');
    const count=app.snapshot().stats.checked;app.checkAnswer();assert(app.snapshot().stats.checked===count,'Repeated grading does not double-count');
    app.retryQuestion();app.selectAnswer((first.questions[0].answer+1)%5);app.checkAnswer();
    assert($('question-card').querySelector('.feedback.wrong'),'Wrong answer explained');
    app.retryQuestion();app.checkAnswer(true);
    assert(app.snapshot().state.records[first.questions[0].id].selected===null,'Reveal is not counted as correct');
    assert($('question-card').textContent.includes('Answer revealed'),'Reveal feedback');
    reports.push('Guided correct, incorrect, reveal, retry, and duplicate-grading behavior');
    let checked=0;
    for(const p of app.data.passages){
      app.selectPassage(p.id);
      assert($('passage-title').textContent===p.title,'Passage title rendered');
      for(let i=0;i<p.questions.length;i++){
        const q=p.questions[i];app.goQuestion(i);app.retryQuestion();app.selectAnswer(q.answer);app.checkAnswer();
        assert($('question-card').querySelector('.feedback:not(.wrong)'),q.id+' correct grading');
        assert($('question-card').textContent.includes(q.explanation),q.id+' complete explanation');
        assert(document.querySelectorAll('input[name=answer]').length===q.options.length,q.id+' option count');
        checked++;
      }
    }
    assert(app.snapshot().stats.correct===182,'Every question can be graded correctly');
    reports.push(`${checked} questions rendered, graded, and explained across all five sources`);
    $('source-filter').value='kaplan';$('source-filter').dispatchEvent(new Event('change'));
    assert(document.querySelectorAll('.library-item').length===7,'Kaplan filter selects seven passages');
    $('search').value='no-such-passage-xyz';$('search').dispatchEvent(new Event('input'));
    assert(document.querySelector('.empty-library'),'Search empty state');
    $('search').value='';$('search').dispatchEvent(new Event('input'));
    $('source-filter').value='all';$('source-filter').dispatchEvent(new Event('change'));
    assert(document.querySelectorAll('.library-item').length===37,'Source filter reset');
    app.selectPassage(first.id);
    const oldBookmark=app.snapshot().state.bookmarks[first.id];$('bookmark-button').click();assert(app.snapshot().state.bookmarks[first.id]!==oldBookmark,'Bookmark saved');
    const notes=$('passage-notes');notes.value='<img src=x onerror=alert(1)> & reading note';notes.dispatchEvent(new Event('input'));app.selectPassage(first.id);
    assert($('passage-notes').value==='<img src=x onerror=alert(1)> & reading note','Notes safely restored');
    assert(!$('passage-card').querySelector('img'),'Notes are escaped');
    const oldFont=app.snapshot().state.fontSize;
    $('font-larger').click();assert(app.snapshot().state.fontSize===Math.min(24,oldFont+1),'Text size saved');
    reports.push('Source/search filters, bookmark, safe notes, and text size');
    for(const [setId,test] of Object.entries(app.data.timedSets)){
      app.startSession(setId);
      assert(!document.querySelector('.feedback'),'Prior guided answers hidden in timed test');
      assert(document.querySelectorAll('.library-item').length===7,'Timed library contains only seven passages');
      assert($('hero-passage-count').textContent==='7'&&$('hero-question-count').textContent==='40','Timed counters describe the test, not the full bank');
      assert(getComputedStyle(document.querySelector('.library-browse-controls')).display==='none','Unrelated browsing filters hidden in timed test');
      const before=app.snapshot().activeId;
      const outside=app.data.passages.find(p=>!test.passageIds.includes(p.id));
      app.selectPassage(outside.id);
      assert(app.snapshot().activeId===before,'Cannot navigate outside the selected timed set');
      const outsideSameSource=app.data.passages.find(p=>!test.passageIds.includes(p.id)&&p.sourceId===app.data.passages.find(p=>p.id===before).sourceId);
      if(outsideSameSource){app.selectPassage(outsideSameSource.id);assert(app.snapshot().activeId===before,'A shared publisher must not bypass test membership');}
      let correct=0,wrong=0,skipped=0,n=0;
      for(const p of test.passageIds.map(pid=>app.data.passages.find(p=>p.id===pid))){
        app.selectPassage(p.id);
        assert(app.snapshot().activeId===p.id,'Every assigned passage is reachable');
        for(let i=0;i<p.questions.length;i++,n++){
          const q=p.questions[i];app.goQuestion(i);
          assert(document.querySelector('.question-labels span').textContent===`Question ${n+1} of 40`,'Timed question numbers run 1–40');
          if(n%3===0){app.selectAnswer(q.answer);correct++;}
          else if(n%3===1){app.selectAnswer((q.answer+1)%q.options.length);wrong++;}
          else skipped++;
          assert(!document.querySelector('.feedback'),'No timed answer leak for '+q.id);
          assert(!$('check-answer'),'No timed grading control');
        }
      }
      assert(n===40,'Full timed set has 40 questions');
      app.checkAnswer(true);assert(!document.querySelector('.feedback'),'Reveal API cannot leak timed answers');
      app.finishSession();
      const score=app.sessionScore();
      assert(score.correct===correct&&score.wrong===wrong&&score.skipped===skipped,'Timed score matches selections');
      assert(score.raw===correct-wrong*.25,'Raw score formula');
      assert(document.querySelector('.feedback'),'Feedback available after finishing');
      const history=app.snapshot().state.history.length;app.finishSession();assert(app.snapshot().state.history.length===history,'Test cannot be submitted twice');
      $('modal').close();app.exitReview();
      assert(document.querySelectorAll('.library-item').length===37,'Exiting review restores the full practice bank');
      assert($('hero-passage-count').textContent==='37'&&$('hero-question-count').textContent==='182','Guided counters restored');
    }
    reports.push('Four timed sets: seven passages each, exactly forty questions, locked membership, global numbering, no answer leaks, correct scoring, and guided bank restored');
    app.startSession('kaplan');
    const now=Date.now;Date.now=()=>app.snapshot().state.session.deadline+1;
    try{app.tick();}finally{Date.now=now;}
    assert(app.snapshot().state.session.finished,'Expired session submits automatically');
    assert(app.sessionScore().skipped===40,'Expiry preserves unanswered questions as skipped');
    $('modal').close();app.exitReview();
    reports.push('Deadline expiry automatically submits');
    return {passed:true,reports};
  } finally {
    if(backup===null)localStorage.removeItem('ssat-middle-reading-v1');else localStorage.setItem('ssat-middle-reading-v1',backup);
  }
})();

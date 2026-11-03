'use strict';
(() => {
const DATA = JSON.parse(document.getElementById('reading-data').textContent);
const BANK = DATA.passages;
const SOURCES = DATA.sources;
const KEY = 'ssat-middle-reading-v1';
const LETTERS = 'ABCDE';
const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const questionMap = new Map(BANK.flatMap(p => p.questions.map(q => [q.id, q])));
const passageMap = new Map(BANK.map(p => [p.id, p]));
let storageAvailable = true;
let state = loadState();
let activeId = passageMap.has(state.lastPassage) ? state.lastPassage : BANK[0].id;
let questionIndex = 0;
let query = '', sourceFilter = 'all', statusFilter = 'all', genreFilter = 'all';
let toastTimer;
let lineView = true;

function blankState() { return {version:1,records:{},bookmarks:{},notes:{},positions:{},lastPassage:BANK[0].id,fontSize:18,session:null,history:[]}; }
function validRecord(record, q) {
  if (!record || typeof record !== 'object') return null;
  const selected = Number.isInteger(record.selected) && record.selected >= 0 && record.selected < q.options.length ? record.selected : null;
  return {selected,checked:record.checked === true};
}
function normalizeState(raw) {
  const next = blankState();
  if (!raw || raw.version !== 1) return next;
  for (const [id,q] of questionMap) {
    const record = validRecord(raw.records?.[id],q);
    if (record) next.records[id] = record;
  }
  for (const p of BANK) {
    if (raw.bookmarks?.[p.id] === true) next.bookmarks[p.id] = true;
    if (typeof raw.notes?.[p.id] === 'string') next.notes[p.id] = raw.notes[p.id].slice(0,20000);
    if (Number.isInteger(raw.positions?.[p.id])) next.positions[p.id] = Math.max(0,Math.min(p.questions.length-1,raw.positions[p.id]));
  }
  if (passageMap.has(raw.lastPassage)) next.lastPassage = raw.lastPassage;
  if (Number.isFinite(raw.fontSize)) next.fontSize = Math.max(16,Math.min(24,raw.fontSize));
  if (Array.isArray(raw.history)) next.history = raw.history.filter(h => SOURCES[h?.sourceId] && Number.isFinite(h.correct) && Number.isFinite(h.date)).slice(-20);
  const s = raw.session;
  if (s && SOURCES[s.sourceId]?.timed && Number.isFinite(s.deadline) && Number.isFinite(s.startedAt)) {
    next.session = {sourceId:s.sourceId,deadline:s.deadline,startedAt:s.startedAt,finished:s.finished === true,answers:{}};
    for (const p of BANK.filter(p=>p.sourceId===s.sourceId)) for (const q of p.questions) {
      const record = validRecord(s.answers?.[q.id],q);
      if (record) next.session.answers[q.id] = record;
    }
  }
  return next;
}
function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(KEY))); }
  catch { storageAvailable = false; return blankState(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch {
    if (storageAvailable) toast('Browser storage is unavailable. This session will still work, but progress cannot be saved.');
    storageAvailable = false;
    $('storage-warning').textContent = 'Progress cannot be saved in this browser.';
  }
}
function toast(message) {
  $('toast').textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').textContent = ''; },3600);
}
function timedActive() { return !!state.session && !state.session.finished; }
function currentPassage() { return passageMap.get(activeId); }
function currentQuestion() { return currentPassage().questions[questionIndex]; }
function recordFor(q) { return (state.session ? state.session.answers : state.records)[q.id] || {selected:null,checked:false}; }
function passageStats(p) {
  const records = state.session ? state.session.answers : state.records;
  return p.questions.reduce((s,q)=>{
    const r=records[q.id];
    if (r?.checked) { s.checked++; if (r.selected===q.answer) s.correct++; else s.missed++; }
    if (r?.selected != null) s.selected++;
    return s;
  },{checked:0,correct:0,missed:0,selected:0});
}
function globalStats() {
  let checked=0,correct=0;
  for (const [id,q] of questionMap) {
    const r=state.records[id];
    if (r?.checked) { checked++; if (r.selected===q.answer) correct++; }
  }
  return {checked,correct};
}
function visiblePassages() {
  const search=query.trim().toLowerCase();
  return BANK.filter(p=> {
    if (state.session && p.sourceId!==state.session.sourceId) return false;
    if (sourceFilter!=='all' && p.sourceId!==sourceFilter) return false;
    if (genreFilter!=='all' && p.genre!==genreFilter) return false;
    if (search && ![p.title,SOURCES[p.sourceId].name,p.genre,...p.paragraphs].join(' ').toLowerCase().includes(search)) return false;
    const s=passageStats(p);
    if (statusFilter==='new' && s.checked===p.questions.length) return false;
    if (statusFilter==='complete' && s.checked!==p.questions.length) return false;
    if (statusFilter==='missed' && !s.missed) return false;
    if (statusFilter==='saved' && !state.bookmarks[p.id]) return false;
    return true;
  });
}
function renderLibrary() {
  const visible=visiblePassages();
  $('library-count').textContent = `${visible.length} passages`;
  $('mobile-library-count').textContent = `${visible.length} passages`;
  $('genre-filters').innerHTML = ['all',...new Set(BANK.map(p=>p.genre))].map(g=>`<button class="genre-chip" data-genre="${escape(g)}" aria-pressed="${g===genreFilter}">${g==='all'?'All genres':escape(g)}</button>`).join('');
  $('passage-list').innerHTML = visible.length ? visible.map(p=>{
    const s=passageStats(p), complete=s.checked===p.questions.length;
    const count=timedActive()?s.selected:s.checked;
    const wordCount=p.paragraphs.join(' ').split(/\s+/).length;
    return `<button class="library-item${p.id===activeId?' active':''}" data-passage="${p.id}" ${p.id===activeId?'aria-current="true"':''} aria-label="${escape(p.title)}, ${p.questions.length} questions, ${count} ${timedActive()?'answered':'checked'}"><span class="item-top"><span class="item-title">${escape(p.title)}</span><span class="item-status" aria-hidden="true">${state.bookmarks[p.id]?'☆ ':''}${complete?'✓':`${count}/${p.questions.length}`}</span></span><span class="item-meta"><span>${escape(SOURCES[p.sourceId].short)}</span><span>${wordCount} words</span></span><span class="item-progress"><span style="width:${count/p.questions.length*100}%"></span></span></button>`;
  }).join('') : '<p class="empty-library">No passages match these filters. Try another source, genre, or search.</p>';
  const stats=globalStats();
  $('hero-completed').textContent=stats.checked;
  $('library-progress').textContent=`${stats.checked} of ${questionMap.size} questions checked`;
  $('library-progress-bar').style.width=`${stats.checked/questionMap.size*100}%`;
}
function sourceLink(p) {
  return `reading_materials/${encodeURIComponent(p.sourceFile)}${p.sourcePages.length?'#page='+p.sourcePages[0]:''}`;
}
function renderPassage() {
  const p=currentPassage(),source=SOURCES[p.sourceId];
  const words=p.paragraphs.join(' ').split(/\s+/).length;
  const paragraphs=p.paragraphs.map(t=>`<p>${escape(t)}</p>`).join('');
  let text;
  if (lineView && p.sourceLines?.length) {
    text=p.sourceLines.map((t,i)=>`<div class="source-line"><span class="line-number" aria-hidden="true">${i+1}</span><span class="line-text">${escape(t)}</span></div>`).join('');
  } else if (p.lines?.length) {
    text=`<pre class="poem">${escape(p.lines.join('\n'))}</pre>`;
  } else text=paragraphs;
  const author=p.author||p.attribution;
  const adaptation=p.adaptationNote||'';
  $('passage-card').innerHTML=`<div class="passage-heading"><div class="passage-kicker"><span class="source-tag">${escape(source.short)} · Middle Level</span><button class="bookmark" id="bookmark-button" aria-pressed="${!!state.bookmarks[p.id]}" aria-label="${state.bookmarks[p.id]?'Unsave':'Save'} this passage"><span aria-hidden="true">${state.bookmarks[p.id]?'★':'☆'}</span> ${state.bookmarks[p.id]?'Saved':'Save'}</button></div><h2 id="passage-title">${escape(p.title)}</h2><div class="passage-meta"><span class="badge">${escape(p.genre)}</span><span>${words} words</span><span>·</span><span>${p.questions.length} questions</span></div></div><div class="reading-controls"><span>Read for meaning. Look for evidence.</span><div class="text-tools"><button id="font-smaller" aria-label="Decrease passage text size" ${state.fontSize<=16?'disabled':''}>A−</button><button id="font-larger" aria-label="Increase passage text size" ${state.fontSize>=24?'disabled':''}>A+</button>${p.sourceLines?.length?`<button class="lines-button" id="lines-button" aria-pressed="${lineView}">Lines ${lineView?'on':'off'}</button>`:''}</div></div><div class="passage-scroll" id="passage-scroll">${p.note?`<aside class="source-note">${escape(p.note)}</aside>`:''}<div class="passage-text">${text}</div>${author?`<p class="attribution">${escape(author)}</p>`:''}</div><div class="passage-foot"><details><summary>Your notes &amp; source</summary><label class="notes-label" for="passage-notes">What is the main idea? Which details support it?</label><textarea id="passage-notes" maxlength="20000" placeholder="Leave yourself a reading note…">${escape(state.notes[p.id]||'')}</textarea><span class="note-status" id="note-status">${storageAvailable?'Saved only in this browser.':'Browser storage is unavailable.'}</span><div class="source-details"><a href="${sourceLink(p)}" target="_blank" rel="noopener">Open original${p.sourcePages.length?' · PDF p. '+p.sourcePages.join(', '):' page'}</a><p>${escape(p.answerProvenance||source.answerNote)}</p>${adaptation?`<p>${escape(adaptation)}</p>`:''}</div></details></div>`;
  $('bookmark-button').addEventListener('click',()=>{
    state.bookmarks[p.id]=!state.bookmarks[p.id];save();
    const button=$('bookmark-button');button.setAttribute('aria-pressed',String(!!state.bookmarks[p.id]));button.setAttribute('aria-label',`${state.bookmarks[p.id]?'Unsave':'Save'} this passage`);button.innerHTML=`<span aria-hidden="true">${state.bookmarks[p.id]?'★':'☆'}</span> ${state.bookmarks[p.id]?'Saved':'Save'}`;renderLibrary();
  });
  $('passage-notes').addEventListener('input',e=>{state.notes[p.id]=e.target.value;save();$('note-status').textContent=storageAvailable?'Note saved in this browser.':'Storage unavailable; keep a copy of your note.';});
  $('font-smaller').addEventListener('click',()=>setFont(-1));
  $('font-larger').addEventListener('click',()=>setFont(1));
  $('lines-button')?.addEventListener('click',()=>{lineView=!lineView;renderPassage();});
}
function setFont(delta) {
  state.fontSize=Math.max(16,Math.min(24,state.fontSize+delta));
  document.documentElement.style.setProperty('--reading-size',state.fontSize+'px');save();
  $('font-smaller').disabled=state.fontSize<=16;$('font-larger').disabled=state.fontSize>=24;
}
function renderQuestion() {
  const p=currentPassage(),q=currentQuestion(),r=recordFor(q),locked=r.checked&&!timedActive();
  const correct=r.selected===q.answer;
  const nav=p.questions.map((item,i)=>{
    const rec=recordFor(item);
    const status=timedActive() ? rec.selected!=null?'answered':'' : rec.checked?rec.selected===item.answer?'correct':'incorrect':rec.selected!=null?'answered':'';
    return `<button class="q-dot ${status}${i===questionIndex?' current':''}" data-question="${i}" aria-label="Question ${i+1}, ${status||'not answered'}" ${i===questionIndex?'aria-current="step"':''}>${i+1}</button>`;
  }).join('');
  const choices=q.options.map((option,i)=>`<label class="choice${r.selected===i?' selected':''}${locked?(i===q.answer?' correct':r.selected===i?' incorrect':'')+' locked':''}"><input type="radio" name="answer" value="${i}" ${r.selected===i?'checked':''} ${locked?'disabled':''} aria-label="${LETTERS[i]}. ${escape(option)}"><span class="choice-letter" aria-hidden="true">${LETTERS[i]}</span><span>${escape(option)}</span>${locked&&(i===q.answer||r.selected===i)?`<span class="choice-result" aria-hidden="true">${i===q.answer?'✓':'×'}</span>`:''}</label>`).join('');
  const feedback=locked?`<div class="feedback${correct?'':' wrong'}" role="status"><h3>${correct?'✓ Well read.':r.selected==null?'Answer revealed.':'A detail worth another look.'}</h3><p class="answer-summary">${correct?'Correct answer':r.selected==null?'Correct answer':'Your choice: '+LETTERS[r.selected]+'. Correct answer'}: ${LETTERS[q.answer]}.</p><p>${escape(q.explanation)}</p>${q.adaptationNote?`<details><summary>About this source question</summary><p>${escape(q.adaptationNote)}</p></details>`:''}</div>`:'';
  const nextLabel=questionIndex<p.questions.length-1?'Next question →':'Next passage →';
  $('question-card').innerHTML=`<div class="question-head"><div class="question-labels"><h2>Find your evidence</h2><span>Question ${questionIndex+1} of ${p.questions.length}</span></div><nav class="question-nav" aria-label="Questions in this passage">${nav}</nav></div><div class="question-body"><div class="skill-tag">${timedActive()?'Reading comprehension':escape(q.skill)}</div><h3 class="question-prompt" tabindex="-1" id="question-prompt">${escape(q.prompt)}</h3><fieldset class="choices" style="border:0;padding:0;margin:0"><legend class="sr-only">Choose one answer</legend>${choices}</fieldset><div class="question-actions">${timedActive()?`<button class="primary" id="next-question">${nextLabel}</button>`:locked?`<button class="primary" id="next-question">${nextLabel}</button><button class="quiet" id="retry-question" ${state.session?'hidden':''}>Try again</button>`:`<button class="primary" id="check-answer" ${r.selected==null?'disabled':''}>Check answer</button><button class="quiet" id="next-question">Next →</button>`}</div><div class="question-sub"><span>Source question ${q.number}${q.options.length===4?' · 4-choice practice':''}</span>${!timedActive()&&!locked?'<button class="text-link" id="reveal-answer">Show answer</button>':timedActive()?'<span>Answers appear after the test.</span>':'<button class="text-link" id="previous-question">← Previous</button>'}</div>${feedback}</div>`;
  $('question-card').querySelectorAll('input[name="answer"]').forEach(input=>input.addEventListener('change',()=>selectAnswer(Number(input.value))));
  $('check-answer')?.addEventListener('click',()=>checkAnswer(false));
  $('reveal-answer')?.addEventListener('click',()=>checkAnswer(true));
  $('retry-question')?.addEventListener('click',retryQuestion);
  $('next-question')?.addEventListener('click',nextQuestion);
  $('previous-question')?.addEventListener('click',()=>goQuestion(Math.max(0,questionIndex-1)));
  const s=passageStats(p);
  $('passage-result').innerHTML=!timedActive()&&s.checked===p.questions.length?`<div class="passage-result"><div><strong>Passage complete · ${s.correct} of ${p.questions.length} correct</strong><span>${s.missed?'Revisit the explanations, then try the missed questions again.':'You connected every answer with the passage.'}</span></div>${s.missed?'<button class="quiet small" id="review-passage">Review missed</button>':''}</div>`:'';
  $('review-passage')?.addEventListener('click',()=>goQuestion(p.questions.findIndex(item=>{const a=recordFor(item);return a.checked&&a.selected!==item.answer;})));
}
function selectAnswer(index) {
  if (timedActive() && Date.now()>=state.session.deadline) {finishSession(true);return;}
  const q=currentQuestion();
  if (!Number.isInteger(index)||index<0||index>=q.options.length) return;
  const records=state.session?state.session.answers:state.records;
  if (records[q.id]?.checked&&!timedActive()) return;
  records[q.id]={selected:index,checked:false};save();
  // Update selection without rebuilding radios, preserving keyboard focus.
  $('question-card').querySelectorAll('.choice').forEach((choice,i)=>{
    choice.classList.toggle('selected',i===index);
    choice.querySelector('input').checked=i===index;
  });
  if ($('check-answer')) $('check-answer').disabled=false;
  renderLibrary();renderSessionBanner();
}
function checkAnswer(reveal=false) {
  if (state.session) return;
  const q=currentQuestion(),old=recordFor(q);
  if (old.checked) return;
  if (!reveal&&old.selected==null) return;
  state.records[q.id]={selected:reveal?null:old.selected,checked:true};save();renderQuestion();renderLibrary();
}
function retryQuestion() {
  if (state.session) return;
  delete state.records[currentQuestion().id];save();renderQuestion();renderLibrary();
  $('question-prompt').focus({preventScroll:true});
}
function goQuestion(index) {
  questionIndex=Math.max(0,Math.min(currentPassage().questions.length-1,index));
  state.positions[activeId]=questionIndex;save();renderQuestion();
  $('question-prompt').focus({preventScroll:true});
}
function selectPassage(id, {focus=false}={}) {
  if (!passageMap.has(id)) return;
  if (state.session&&passageMap.get(id).sourceId!==state.session.sourceId) return;
  activeId=id;state.lastPassage=id;
  questionIndex=state.positions[id]||0;
  if (questionIndex>=currentPassage().questions.length) questionIndex=0;
  save();renderPassage();renderQuestion();renderLibrary();
  if (window.matchMedia('(max-width:980px)').matches) $('library').open=false;
  if (focus) $('passage-title').scrollIntoView({behavior:'smooth',block:'start'});
}
function nextQuestion() {
  if (questionIndex<currentPassage().questions.length-1) {goQuestion(questionIndex+1);return;}
  const visible=visiblePassages(),index=visible.findIndex(p=>p.id===activeId);
  if (index>=0&&index<visible.length-1) selectPassage(visible[index+1].id,{focus:window.matchMedia('(max-width:680px)').matches});
  else if (timedActive()) showFinishConfirm();
  else toast('You reached the last passage in this view. Choose another passage or change your filters.');
}
function openModal(title,content) {
  $('modal-content').innerHTML=`<div class="dialog-top"><h2 id="modal-title">${escape(title)}</h2><button id="close-modal" aria-label="Close dialog">×</button></div>${content}`;
  $('close-modal').addEventListener('click',()=>$('modal').close());
  if (!$('modal').open) $('modal').showModal();
}
function sourceSummary() {
  const counts=Object.fromEntries(Object.keys(SOURCES).map(id=>[id,{passages:BANK.filter(p=>p.sourceId===id).length,questions:BANK.filter(p=>p.sourceId===id).reduce((a,p)=>a+p.questions.length,0)}]));
  openModal('Sources & level filter',`<p class="dialog-lead">${BANK.length} passages and ${questionMap.size} questions, selected from the local reading_materials folder. Only explicitly labeled SSAT Middle Level reading is included. Prose and question wording are retained, with documented cleanup and clarifications.</p>${Object.entries(SOURCES).map(([id,s])=>`<section class="source-row"><div class="included">Included · ${counts[id].passages} passages · ${counts[id].questions} questions</div><h3>${escape(s.name)}</h3><p>${escape(s.selection)}</p><p>${escape(s.answerNote)}</p><a href="${sourceLink(BANK.find(p=>p.sourceId===id))}" target="_blank" rel="noopener">Local source ↗</a></section>`).join('')}<section class="source-row"><h3>Filtered out</h3><p>SSAT Upper Level, ISEE at every level, mixed Middle/Upper material without a clear split, and writing, math, verbal, and experimental sections. The Ivy full test repeats its separate reading section, so it is counted once. The Prep4SSAT file is a download listing with no practice content. The Ivy strategies PDF informs the reading guide rather than adding questions.</p><p>Kaplan: included only PDF pages 462–473 (SSAT Middle Reading). Excluded Upper SSAT pages 519–592, ISEE pages 603–732, and mixed-level chapter drills.</p></section><section class="source-row"><h3>Adaptations and attribution</h3><p>Display titles and explanations were prepared for this page. Printed line references are preserved with original numbered lines or replaced with explicit quoted context. Test Ninjas question 12’s paragraph reference was corrected to the speed-line discussion. Princeton question 9’s water-storage choice was clarified to “survive for days without drinking,” matching its passage. Some older passages describe historical conditions; answer according to their supplied text.</p><p>Source copyrights remain with their respective publishers. This page is intended for your local study.</p></section>`);
}
function showGuide() {
  openModal('Read with a purpose',`<p class="dialog-lead">A short routine adapted from the Ivy Global reading strategies in your materials.</p><section class="source-row"><h3>1. Name the main idea</h3><p>After each paragraph, put its point into a short phrase. Ask how the paragraph contributes to the passage as a whole.</p></section><section class="source-row"><h3>2. Notice the author’s purpose</h3><p>Is the author explaining, persuading, remembering, describing, or telling a story? Notice the words that establish the tone.</p></section><section class="source-row"><h3>3. Find evidence before deciding</h3><p>Return to the relevant sentence and read its surrounding context. For an inference, connect what the text establishes without adding an unsupported assumption.</p></section><section class="source-row"><h3>4. Try a word in context</h3><p>Substitute the answer choices into the original sentence. Choose the meaning that fits this passage, even if the word has other familiar meanings.</p></section><section class="source-row"><h3>5. Learn from the explanation</h3><p>Look for choices that are too broad, too narrow, too extreme, or unsupported. Write one useful observation in your passage notes.</p></section><p class="dialog-lead">Guided practice gives feedback as you go. Timed practice saves all feedback until you finish.</p>`);
}
function showProgress() {
  const stats=globalStats();
  const skills=[...new Set([...questionMap.values()].map(q=>q.skill))];
  openModal('Your reading progress',`<p class="dialog-lead">Your latest checked attempt for each question. Revealing an answer counts as checked, but never as correct. Trying again clears that question’s latest result.</p><div class="score-hero"><div><strong>${stats.checked}</strong><span>of ${questionMap.size} checked</span></div><div><strong>${stats.correct}</strong><span>correct answers</span></div><div><strong>${stats.checked?Math.round(stats.correct/stats.checked*100)+'%':'—'}</strong><span>accuracy</span></div></div><h3 style="font-size:13px;margin-top:25px">Skills you’re building</h3>${skills.map(skill=>{
    const qs=[...questionMap.values()].filter(q=>q.skill===skill),checked=qs.filter(q=>state.records[q.id]?.checked),correct=checked.filter(q=>state.records[q.id].selected===q.answer).length;
    return `<div class="skill-row"><span>${escape(skill)}</span><div class="skill-track"><span style="width:${checked.length?correct/checked.length*100:0}%"></span></div><span class="skill-score">${correct}/${checked.length} correct</span></div>`;
  }).join('')}${state.history.length?`<section class="source-row"><h3>Recent timed practice</h3>${state.history.slice(-5).reverse().map(h=>`<p>${escape(SOURCES[h.sourceId].short)} · ${h.correct}/40 correct · ${new Date(h.date).toLocaleDateString()}</p>`).join('')}</section>`:''}<div class="data-actions"><button id="export-progress">Back up progress</button><button id="import-progress">Restore backup</button><button class="danger" id="reset-progress">Reset progress</button><input type="file" id="import-file" accept="application/json,.json" hidden></div><p class="dialog-lead" style="font-size:11px;margin-bottom:0">${storageAvailable?'Progress and notes stay in this browser. A backup lets you move them to another browser.':'This browser is not allowing local storage. Download a backup to keep your work.'}</p>`);
  $('export-progress').addEventListener('click',exportProgress);
  $('import-progress').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',importProgress);
  $('reset-progress').addEventListener('click',()=>{
    openModal('Reset your reading progress?',`<p class="dialog-lead">This clears your answers, notes, saved passages, and timed practice history in this browser. Download a backup first if you want to keep them.</p><div class="dialog-actions"><button id="cancel-reset">Keep progress</button><button class="primary" id="confirm-reset">Reset progress</button></div>`);
    $('cancel-reset').addEventListener('click',showProgress);
    $('confirm-reset').addEventListener('click',()=>{state=blankState();activeId=BANK[0].id;questionIndex=0;save();$('modal').close();restoreFilters();render();toast('Reading progress reset.');});
  });
}
function exportProgress() {
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ssat-reading-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importProgress(event) {
  const file=event.target.files?.[0];if (!file) return;
  try {
    if (file.size>5*1024*1024) throw Error('This backup is too large.');
    const parsed=JSON.parse(await file.text());
    if (parsed.version!==1||!parsed.records) throw Error('Choose an SSAT reading progress backup.');
    if (timedActive()) throw Error('Finish the active timed test before restoring a backup.');
    state=normalizeState(parsed);activeId=state.lastPassage;questionIndex=state.positions[activeId]||0;save();$('modal').close();restoreFilters();render();tick();toast('Reading progress restored.');
  } catch(error) {toast(error.message||'This backup could not be read.');}
}
function showTimedSetup() {
  if (timedActive()) {showFinishConfirm();return;}
  openModal('A little focus. Forty minutes.',`<p class="dialog-lead">Choose a complete Middle Level reading set: 40 questions, 40 minutes. You can move between passages and change your answers. Explanations appear after you finish. The clock keeps running if you leave the page.</p><label class="dialog-field" for="test-source">Reading set<select id="test-source">${Object.entries(SOURCES).filter(([,s])=>s.timed).map(([id,s])=>`<option value="${id}">${escape(s.name)} · 40 questions</option>`).join('')}</select></label><p class="dialog-lead" style="font-size:11px">Your guided-practice answers stay saved. Finishing a test updates your latest results for its questions. This is an independent practice exercise, not an official score prediction.</p><div class="dialog-actions"><button id="cancel-test">Keep practicing</button><button class="primary" id="start-test">Start 40-minute practice →</button></div>`);
  $('cancel-test').addEventListener('click',()=>$('modal').close());
  $('start-test').addEventListener('click',()=>startSession($('test-source').value));
}
function restoreFilters() {
  query='';sourceFilter=state.session?state.session.sourceId:'all';statusFilter='all';genreFilter='all';
  $('search').value='';$('source-filter').value=sourceFilter;$('status-filter').value='all';
  $('source-filter').disabled=!!state.session;
}
function startSession(sourceId) {
  if (!SOURCES[sourceId]?.timed) return;
  if (timedActive()) return;
  const now=Date.now();
  state.session={sourceId,startedAt:now,deadline:now+40*60*1000,finished:false,answers:{}};
  for (const p of BANK.filter(p=>p.sourceId===sourceId)) state.positions[p.id]=0;
  activeId=BANK.find(p=>p.sourceId===sourceId).id;questionIndex=0;state.lastPassage=activeId;
  save();$('modal').close();restoreFilters();render();tick();
}
function sessionScore() {
  const qs=BANK.filter(p=>p.sourceId===state.session.sourceId).flatMap(p=>p.questions);
  let correct=0,wrong=0,skipped=0;
  for (const q of qs) {const r=state.session.answers[q.id];if (r?.selected==null) skipped++;else if (r.selected===q.answer) correct++;else wrong++;}
  return {correct,wrong,skipped,total:qs.length,raw:correct-wrong*.25};
}
function showFinishConfirm() {
  if (!timedActive()) return;
  const s=sessionScore();
  openModal('Ready to review your answers?',`<p class="dialog-lead">You have answered ${s.total-s.skipped} of ${s.total} questions.${s.skipped?' '+s.skipped+' unanswered questions will be scored as skipped.':''} Finish now to see your results and explanations.</p><div class="dialog-actions"><button id="keep-testing">Keep working</button><button class="primary" id="finish-test">Finish & review</button></div>`);
  $('keep-testing').addEventListener('click',()=>$('modal').close());
  $('finish-test').addEventListener('click',()=>finishSession(false));
}
function finishSession(expired=false) {
  if (!timedActive()) return;
  state.session.finished=true;
  const s=sessionScore();
  for (const p of BANK.filter(p=>p.sourceId===state.session.sourceId)) for (const q of p.questions) {
    const old=state.session.answers[q.id]||{selected:null};
    state.session.answers[q.id]={selected:old.selected,checked:true};
    state.records[q.id]={selected:old.selected,checked:true};
  }
  state.history.push({sourceId:state.session.sourceId,correct:s.correct,wrong:s.wrong,skipped:s.skipped,raw:s.raw,date:Date.now()});state.history=state.history.slice(-20);
  save();render();showResults(expired);
}
function showResults(expired=false) {
  if (!state.session?.finished) return;
  const s=sessionScore();
  openModal(expired?'Time’s up. Let’s learn from it.':'Your reading practice, reviewed.',`<p class="dialog-lead">${escape(SOURCES[state.session.sourceId].name)} · 40 questions. Select any question to read its explanation.</p><div class="score-hero"><div><strong>${s.correct}</strong><span>correct</span></div><div><strong>${s.wrong}</strong><span>incorrect</span></div><div><strong>${s.skipped}</strong><span>skipped</span></div></div><p class="dialog-lead">Practice raw score: <strong>${s.raw.toFixed(2).replace(/\.00$/,'')}</strong> / ${s.total}<br><span style="font-size:11px">+1 per correct answer, −0.25 per incorrect answer, 0 per skip. This is a practice calculation, not an official scaled score or percentile.</span></p><div class="dialog-actions"><button id="all-review">Review all questions</button><button class="primary" id="missed-review">${s.wrong+s.skipped?'Review missed questions':'Explore your answers'} →</button></div>`);
  $('all-review').addEventListener('click',()=>$('modal').close());
  $('missed-review').addEventListener('click',()=>{
    const p=BANK.filter(p=>p.sourceId===state.session.sourceId).find(p=>p.questions.some(q=>state.session.answers[q.id].selected!==q.answer));
    if (p) {selectPassage(p.id);goQuestion(p.questions.findIndex(q=>state.session.answers[q.id].selected!==q.answer));}
    $('modal').close();
  });
}
function exitReview() {
  if (!state.session?.finished) return;
  state.session=null;save();restoreFilters();render();
}
function renderSessionBanner() {
  const session=state.session;
  document.body.classList.toggle('active-session',!!session);
  $('test-banner').hidden=!session;
  $('timer').hidden=!session||session.finished;
  $('exit-test-button').hidden=!session?.finished;
  $('mode-label').textContent=!session?'Guided practice':session.finished?'Test review':'Timed practice';
  $('mode-description').textContent=!session?'· go at your own pace':session.finished?'· learn from every answer':'· 40 questions';
  $('timed-button').textContent=timedActive()?'Finish practice':session?.finished?'New timed practice ↗':'40-minute practice ↗';
  if (session) {
    const s=sessionScore();
    $('test-banner').innerHTML=`<div><strong>${escape(SOURCES[session.sourceId].short)} · ${session.finished?'Practice complete':`${s.total-s.skipped} of ${s.total} answered`}</strong><p>${session.finished?`${s.correct} correct · ${s.wrong} incorrect · ${s.skipped} skipped`:'Take your time with the evidence. Your answers are saved as you go.'}</p></div><button class="quiet small" id="banner-test-action">${session.finished?'See results':'Finish & review'}</button>`;
    $('banner-test-action').addEventListener('click',()=>session.finished?showResults():showFinishConfirm());
  }
}
function tick() {
  if (!timedActive()) return;
  const remaining=Math.max(0,Math.ceil((state.session.deadline-Date.now())/1000));
  $('timer').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  $('timer').classList.toggle('urgent',remaining<=300);
  if (!remaining) finishSession(true);
}
function render() {
  document.documentElement.style.setProperty('--reading-size',state.fontSize+'px');
  renderLibrary();renderPassage();renderQuestion();renderSessionBanner();
}
for (const [id,source] of Object.entries(SOURCES)) {
  const option=document.createElement('option');option.value=id;option.textContent=source.name;$('source-filter').append(option);
}
$('search').addEventListener('input',event=>{query=event.target.value;renderLibrary();});
$('source-filter').addEventListener('change',event=>{sourceFilter=event.target.value;renderLibrary();});
$('status-filter').addEventListener('change',event=>{statusFilter=event.target.value;renderLibrary();});
$('genre-filters').addEventListener('click',event=>{const button=event.target.closest('[data-genre]');if (button) {genreFilter=button.dataset.genre;renderLibrary();}});
$('passage-list').addEventListener('click',event=>{const button=event.target.closest('[data-passage]');if (button) selectPassage(button.dataset.passage,{focus:window.matchMedia('(max-width:680px)').matches});});
$('question-card').addEventListener('click',event=>{const button=event.target.closest('[data-question]');if (button) goQuestion(Number(button.dataset.question));});
$('focus-button').addEventListener('click',()=>{const focused=document.body.classList.toggle('focused');$('focus-button').textContent=focused?'Exit focus':'Focus view';$('focus-button').setAttribute('aria-pressed',String(focused));});
$('sources-button').addEventListener('click',sourceSummary);
$('guide-button').addEventListener('click',showGuide);
$('progress-button').addEventListener('click',()=>timedActive()?toast('Finish the timed practice before viewing progress.'):showProgress());
$('timed-button').addEventListener('click',showTimedSetup);
$('exit-test-button').addEventListener('click',exitReview);
$('modal').addEventListener('click',event=>{if(event.target===$('modal')) {const r=$('modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) $('modal').close();}});
window.addEventListener('focus',tick);
document.addEventListener('visibilitychange',()=>{if (!document.hidden) tick();});
if (window.matchMedia('(max-width:980px)').matches) $('library').open=false;
if (state.session) {
  if (currentPassage().sourceId!==state.session.sourceId) activeId=BANK.find(p=>p.sourceId===state.session.sourceId).id;
}
questionIndex=state.positions[activeId]||0;
restoreFilters();render();tick();setInterval(tick,1000);
// A read-only snapshot and actions support offline regression checks.
window.ReadingApp={
  data:DATA,
  snapshot:()=>({state:JSON.parse(JSON.stringify(state)),activeId,questionIndex,stats:globalStats()}),
  selectPassage,goQuestion,selectAnswer,checkAnswer,retryQuestion,startSession,finishSession,exitReview,sessionScore,tick,
};
})();

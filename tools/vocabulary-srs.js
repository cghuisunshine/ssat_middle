// FSRS-7, ts-fsrs 6.0.0. The bundled scheduler is MIT licensed.
var srsRecoveryBlocked=false;
var srsScheduler = null;
var SRS_READY = FSRS.DefaultScheduler({version:'FSRS-7',desiredRetention:0.9,enableShortTerm:true,learningSteps:['1m','10m'],relearningSteps:['10m'],enableFuzz:false,maximumInterval:36500}).then(s => {srsScheduler=s; if(typeof state!=='undefined') render(); return s;});
const srsBuiltWords=new Map(WORDS.map(w=>[w.id,w]));
var srsCustomLookup=[];
const legacySanitizeSrs = sanitizeState;
sanitizeState = function(input) {
  const out = legacySanitizeSrs(input);
  const previousLookup=srsCustomLookup;
  srsCustomLookup=out.custom;
  out.schedulingVersion=1; out.cards={}; out.reviewLog=[];
  out.settings.studyMode=['recognition','spelling','mixed'].includes(input.settings?.studyMode)?input.settings.studyMode:'recognition';
  if(input.schedulingVersion===1) {
    if(input.cards && typeof input.cards==='object') for(const [id,c] of Object.entries(input.cards)) {
      if(!srsDescriptor(id) || !c || typeof c!=='object') continue;
      if(c.pendingLegacy===true && Number.isFinite(c.eligibleAt)) out.cards[id]={pendingLegacy:true,eligibleAt:c.eligibleAt};
      else if(c.cardId===id && ['new','learning','review'].includes(c.scheduleStatus) && [c.stability,c.stabilityFast,c.difficulty,c.reps,c.lapses,c.scheduledDays].every(n=>Number.isFinite(n)&&n>=0) && Number.isFinite(Date.parse(c.dueAt)) && (c.lastReviewAt===null||Number.isFinite(Date.parse(c.lastReviewAt))) && c.difficulty<=10 && c.stability<=1000000 && c.stabilityFast<=1000000 && (c.learningStep===undefined||Number.isInteger(c.learningStep)&&c.learningStep>=0&&c.learningStep<=100) && [0,1,2,3].includes(c.state)) out.cards[id]={...c};
    }
    if(Array.isArray(input.reviewLog)) out.reviewLog=input.reviewLog.filter(r=>r && srsDescriptor(r.cardId) && [1,2,3,4].includes(r.rating) && Number.isFinite(Date.parse(r.reviewTime)));
    const q=input.srsSession;
    if(q && Array.isArray(q.queue) && q.queue.length<=20 && q.queue.every(id=>srsDescriptor(id)) && new Set(q.queue).size===q.queue.length) out.srsSession={queue:[...q.queue],completed:Math.min(20,Math.max(0,Number(q.completed)||0)),total:Math.min(20,Math.max(q.queue.length,Number(q.total)||0))};
  } else {
    for(const [word,r] of Object.entries(out.records)) if(r.seen && studyEligible(srsBuiltWords.get(word)||out.custom.find(w=>w.id===word))) out.cards[srsId(word,0,'recognition')]={pendingLegacy:true,eligibleAt:r.due};
  }
  srsCustomLookup=previousLookup;
  return out;
};
function srsId(word,index,skill) {return JSON.stringify([word,index,skill]);}
function srsDescriptor(id) {
  try {const [word,index,skill]=JSON.parse(id);let w=srsBuiltWords.get(word)||srsCustomLookup.find(w=>w.id===word);try{w=w||state.custom.find(w=>w.id===word);}catch{}if(!w||!studyEligible(w)||!Number.isInteger(index)||index<0||!wordSenses(w)[index]||!['recognition','spelling'].includes(skill))return null;return {id,word,index,skill,sense:wordSenses(w)[index]};}catch{return null;}
}
function srsAllCards() {
  const skills=state.settings.studyMode==='mixed'?['recognition','spelling']:[state.settings.studyMode||'recognition'];
  return filtered().filter(studyEligible).flatMap(w=>wordSenses(w).flatMap((s,i)=>skills.map(skill=>srsDescriptor(srsId(w.id,i,skill)))));
}
function srsDue(d) {const c=state.cards[d.id];return c?.pendingLegacy?c.eligibleAt:c?Date.parse(c.dueAt):0;}
function srsStatus(d) {const c=state.cards[d.id];return c?.pendingLegacy?'Review':!c||c.scheduleStatus==='new'?'New':c.scheduleStatus==='learning'?'Learning':'Review';}
function srsCurrent() {return (state.srsSession?.queue||[]).map(srsDescriptor).find(d=>d&&srsDue(d)<=Date.now());}
function srsCard(d,now) {const c=state.cards[d.id];return !c||c.pendingLegacy?srsScheduler.newCard({cardId:d.id,now}):{...c,dueAt:new Date(c.dueAt),lastReviewAt:c.lastReviewAt?new Date(c.lastReviewAt):null};}
function srsInterval(date,now=Date.now()) {const seconds=Math.max(1,Math.round((new Date(date)-now)/1000));return seconds<60?seconds+' sec':seconds<3600?Math.ceil(seconds/60)+' min':seconds<86400?Math.round(seconds/3600)+' hr':Math.round(seconds/86400)+' days';}
newDeck = function() {
  const now=Date.now(),cards=srsAllCards(),due=cards.filter(d=>state.cards[d.id]&&srsDue(d)<=now).sort((a,b)=>Number(srsStatus(b)==='Learning')-Number(srsStatus(a)==='Learning')||srsDue(a)-srsDue(b));
  const fresh=shuffle(cards.filter(d=>!state.cards[d.id]));const chosen=[],introduced=new Set();
  for(const d of [...due,...fresh]) {if(!state.cards[d.id]&&introduced.has(d.word))continue;chosen.push(d);if(!state.cards[d.id])introduced.add(d.word);if(chosen.length===20)break;}
  state.srsSession={queue:chosen.map(d=>d.id),total:chosen.length,completed:0};
  deck=chosen.map(d=>wordById(d.word));deckIndex=0;revealed=false;save();
};
function rateSrs(grade) {
  const d=srsCurrent();if(!d||!revealed||!srsScheduler||![1,2,3,4].includes(grade))return;
  if(d.skill==='spelling'&&!state.srsSession.spellingCorrect&&grade!==1)return;
  const now=new Date(),result=srsScheduler.review({card:srsCard(d,now),grade,now});
  state.cards[d.id]=JSON.parse(JSON.stringify(result.card));state.reviewLog.push(JSON.parse(JSON.stringify(result.revlog)));
  const q=state.srsSession;q.queue=q.queue.filter(id=>id!==d.id);
  if(result.card.scheduleStatus==='learning')q.queue.push(d.id);else q.completed++;
  delete q.spellingCorrect;revealed=false;
  const day=dayKey();state.days[day]=(state.days[day]||0)+1;save();render();
}
function srsCheckSpelling() {
  const d=srsCurrent();if(!d||d.skill!=='spelling'||revealed)return;
  const answer=$('srsSpelling').value.trim().normalize('NFC').toLowerCase();if(!answer)return;
  state.srsSession.spellingCorrect=answer===d.word.normalize('NFC').toLowerCase();revealed=true;
  if(!state.srsSession.spellingCorrect) {rateSrs(1);toast('Answer: '+d.word+'. Scheduled for relearning.');}else render();
}
studyCard = function() {
  if(!state.srsSession)newDeck();
  const q=state.srsSession,d=srsCurrent();
  if(!d) {
    const waits=q.queue.map(srsDescriptor).filter(Boolean).map(srsDue),next=waits.length?Math.min(...waits):null;
    return '<section class="panel empty"><h2>'+(next?'Relearning is scheduled.':'Session complete.')+'</h2><p>'+(next?'Next card in <strong id="srsWait">'+srsInterval(next)+'</strong>. You can leave and return; the deadline is saved.':'No more eligible cards in this session.')+'</p><button data-action="new-deck">Start another session</button></section>';
  }
  const w=d.sense;const previews=srsScheduler?[...srsScheduler.preview({card:srsCard(d,new Date()),now:new Date()})]:[];
  const controls=previews.map(p=>'<button data-srs-grade="'+p.grade+'" '+(d.skill==='spelling'&&p.grade===1?'disabled':'')+'>'+['','Again','Hard','Good','Easy'][p.grade]+'<br><small>'+srsInterval(p.card.dueAt)+'</small></button>').join('');
  return '<div class="study-head">'+esc(d.skill==='recognition'?'Recognize the meaning':'Recall the spelling')+' · Meaning '+(d.index+1)+' · '+q.completed+' completed / '+q.total+' cards</div><article class="panel card"><div class="word-area">'+
    (d.skill==='recognition'?'<div class="word">'+esc(d.word)+'</div><div class="pos">'+esc(w.pos)+'</div>'+(w.example?exampleMarkup(w.example):''):'<h2>'+esc(w.def)+'</h2><p>'+esc(w.pos)+'. · Spell the word matching this meaning.</p>')+
    (revealed?'<div class="meaning">'+(d.skill==='spelling'?'<div class="word">'+esc(d.word)+'</div>':'')+esc(w.def)+'</div>'+(state.settings.chinese?'<p lang="zh">'+esc(w.zh)+'</p>':'')+'<p>Closest synonym: '+esc(w.syn)+'</p>'+(d.skill==='spelling'&&w.example?exampleMarkup(w.example):'')+'<button data-action="speak" data-id="'+esc(d.word)+'">'+icon('sound')+' Hear word</button>':d.skill==='spelling'?'<input id="srsSpelling" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Spell the word"><button data-action="srs-check">Check spelling</button>':'<p>Recall the meaning before revealing it.</p>')+'</div><div class="card-foot">'+(revealed?(srsScheduler?controls:'Loading scheduler…'):d.skill==='recognition'?'<button data-action="reveal" class="primary">Reveal meaning</button>':'')+'<button data-action="skip-card">Skip for this session</button></div></article>';
};
learn = function() {
  if(!state.srsSession)newDeck();
  $('app').innerHTML=hero('Spaced review','Build lasting vocabulary.','FSRS adapts each meaning and skill separately. Quizzes and listening do not change your review schedule.')+coverage()+filterBar()+
    '<label>Study mode <select id="srsMode">'+[['recognition','Recognition'],['spelling','Spelling'],['mixed','Mixed']].map(([v,t])=>'<option value="'+v+'" '+(state.settings.studyMode===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label><div class="layout" style="margin-top:18px"><section id="studyArea">'+studyCard()+'</section><aside>'+dailyPanel()+'</aside></div><details class="help"><summary>How FSRS reviews work</summary><p>Again means forgotten. Hard, Good, and Easy mean correct recall with increasing ease. The buttons show your next interval. Learning and forgotten cards return when due, including within this session. Recognition and spelling have independent schedules for each meaning. Target retention: 90%. Existing totals are preserved as legacy history.</p></details>';
};
// Existing word-level records remain historical and retain stars; quizzes do not schedule cards.
recordWord = function() {};
checkAnswer = function(skip=false) {const s=session;if(!s||s.finished||s.deadline||s.checked[s.index]||(!skip&&s.answers[s.index]===null))return;s.checked[s.index]=true;render();};
stats=function(){const all=allWords().filter(studyEligible),cards=all.flatMap(w=>wordSenses(w).flatMap((s,i)=>['recognition','spelling'].map(skill=>srsDescriptor(srsId(w.id,i,skill)))));return {total:all.length,seen:new Set(cards.filter(d=>state.cards[d.id]).map(d=>d.word)).size,secure:cards.filter(d=>srsStatus(d)==='Review').length,due:cards.filter(d=>state.cards[d.id]&&srsDue(d)<=Date.now()).length,today:state.days[dayKey()]||0};};
paths=function(){return '';};
dailyPanel=function(){const s=stats();return '<div class="panel"><h3>Daily review</h3><p>'+s.today+' / 20 reviews today</p><p>'+s.due+' cards due</p><p>Word meanings and skills have separate schedules.</p></div>';};
progress=function(){const rows=['recognition','spelling'].map(skill=>{const ds=allWords().filter(studyEligible).flatMap(w=>wordSenses(w).map((s,i)=>srsDescriptor(srsId(w.id,i,skill))));return '<tr><td>'+skill+'</td>'+['New','Learning','Review'].map(status=>'<td>'+ds.filter(d=>srsStatus(d)===status).length+'</td>').join('')+'<td>'+ds.filter(d=>state.cards[d.id]&&srsDue(d)<=Date.now()).length+'</td></tr>';}).join('');$('app').innerHTML=hero('Your progress','Review by skill.','Counts below are cards; each meaning has recognition and spelling cards.')+'<section class="panel"><table><thead><tr><th>Skill</th><th>New</th><th>Learning</th><th>Review</th><th>Due</th></tr></thead><tbody>'+rows+'</tbody></table><p>'+state.reviewLog.length+' FSRS reviews · '+Object.keys(state.records).filter(id=>rec(id).seen).length+' words with preserved legacy history.</p></section><section class="panel"><h2>Quiz history</h2>'+state.history.slice(-10).reverse().map(h=>'<p>'+esc(h.mode)+': '+h.correct+' / '+h.total+'</p>').join('')+'<button data-action="export">Back up progress</button> <button data-action="import">Restore</button> <button data-action="reset">Reset</button></section>';};
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action],[data-srs-grade]');if(!b||b.disabled)return;const a=b.dataset.action;
 if(b.dataset.srsGrade){e.stopImmediatePropagation();rateSrs(Number(b.dataset.srsGrade));return;}
 if(a==='srs-check'){e.stopImmediatePropagation();srsCheckSpelling();return;}
 if(a==='reset'){e.stopImmediatePropagation();if(confirm('Reset reviews, stars, and quiz history? Added words are kept.')){state.records={};state.cards={};state.reviewLog=[];state.days={};state.history=[];state.srsSession=null;revealed=false;save();render();}return;}
 if(a==='study-word'){e.stopImmediatePropagation();const word=b.dataset.id;if(!studyEligible(wordById(word)))return;$('detailDialog').close();state.srsSession={queue:[srsId(word,0,state.settings.studyMode==='spelling'?'spelling':'recognition')],total:1,completed:0};revealed=false;save();navigate('learn');return;}
 if(view!=='learn')return;
 if(a==='reveal'){e.stopImmediatePropagation();if(srsCurrent()){revealed=true;render();}return;}
 if(a==='skip-card'){e.stopImmediatePropagation();const d=srsCurrent();if(d){state.srsSession.queue=state.srsSession.queue.filter(id=>id!==d.id);revealed=false;save();render();}return;}
},true);
document.addEventListener('change',e=>{if(e.target.id==='srsMode'){state.settings.studyMode=e.target.value;newDeck();render();}});
document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||view!=='learn'||$('detailDialog').open||$('addDialog').open)return;if(e.target.id==='srsSpelling'&&e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();srsCheckSpelling();return;}if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName))return;if(['1','2','3','4'].includes(e.key)&&revealed){e.preventDefault();e.stopImmediatePropagation();rateSrs(Number(e.key));}else if((e.code==='Space'||e.key==='Enter')&&!revealed&&srsCurrent()?.skill==='recognition'){e.preventDefault();e.stopImmediatePropagation();revealed=true;render();}},true);
setInterval(()=>{if(typeof state==='undefined'||view!=='learn'||!state.srsSession)return;const waiting=$('srsWait');if(waiting){if(srsCurrent())render();else{const dues=state.srsSession.queue.map(srsDescriptor).filter(Boolean).map(srsDue);waiting.textContent=srsInterval(Math.min(...dues));}}},1000);

function srsWordCards(w) {const skills=state.settings.studyMode==='mixed'?['recognition','spelling']:[state.settings.studyMode||'recognition'];return wordSenses(w).flatMap((s,i)=>skills.map(skill=>srsDescriptor(srsId(w.id,i,skill))));}
filtered=function(){return allWords().filter(w=>{const ds=studyEligible(w)?srsWordCards(w):[],status=ds.some(d=>srsStatus(d)==='Learning')?'Learning':ds.length&&ds.every(d=>srsStatus(d)==='Review')?'Review':'New';return matchesOrigin(w)&&(filters.tier==='All'||w.tier===filters.tier)&&(filters.topic==='All'||w.topic===filters.topic)&&(filters.status==='All'||filters.status===status||filters.status==='Starred'&&rec(w.id).star||filters.status==='Review due'&&ds.some(d=>state.cards[d.id]&&srsDue(d)<=Date.now()));});};

function srsWordStatus(w){const ds=studyEligible(w)?srsWordCards(w):[];return ds.some(d=>srsStatus(d)==='Learning')?'Learning':ds.length&&ds.every(d=>srsStatus(d)==='Review')?'Review':'New';}

const legacySrsSave=save;
save=function(){if(srsRecoveryBlocked){storageAvailable=false;$('storageAlert').hidden=false;return;}legacySrsSave();};

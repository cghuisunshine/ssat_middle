// Verify that all generated question variants use local, complete explanations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'ssat_middle_vocabulary.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|AI_ENDPOINT|grade-service/.test(script), 'Practice must contain no endpoint calls');
assert.ok(!/Preparing a further explanation|Retry AI explanation|ai-explain|aiExplanationPanel/.test(html));
const nodes = new Map();
const node = id => {
  if (!nodes.has(id)) nodes.set(id, {innerHTML:'',textContent:'',hidden:false,classList:{toggle(){}},addEventListener(){},showModal(){},close(){}});
  return nodes.get(id);
};
let requests = 0;
const context = vm.createContext({
  assert, console, navigator:{onLine:false},
  document:{getElementById:node,querySelector:()=>node('query'),addEventListener(){}},
  window:{scrollTo(){},addEventListener(){}},
  localStorage:{getItem:()=>null,setItem(){}},
  fetch:()=>{requests++;throw Error('Network is forbidden in this test');},
  setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},confirm:()=>true,
});
vm.runInContext(script, context, {timeout:10000});
vm.runInContext(`
  let variants = 0, meanings = 0;
  assert.equal(Object.keys(PREBUILT_WORD_LESSONS).length, 950);
  assert.equal(Object.keys(PREBUILT_ANALOGY_LESSONS).length, 85);
  for (const word of WORDS) {
    const senses = wordSenses(word);
    assert.equal(PREBUILT_WORD_LESSONS[word.id].length, senses.length, word.id);
    for (const [index, sense] of senses.entries()) {
      meanings++;
      for (const mode of ['synonyms','definitions','context','spelling']) {
        const q = wordQuestion(word,mode,sense);
        assert.equal(q.lesson, PREBUILT_WORD_LESSONS[word.id][index], word.id+' uses the prebuilt sense');
        assert.ok(q.lesson.why[mode] && q.lesson.memory && q.lesson.grammar && q.lesson.chinese);
        assert.equal(q.lesson.definition, sense.def);
        assert.equal(q.lesson.zh, sense.zh);
        for (const choice of q.options) {
          const note = q.optionExplanations.find(item=>item.choice===choice);
          assert.ok(note && note.explanation && note.zh, word.id+' missing choice comparison');
        }
        const answer = mode==='spelling'?'wrong-spelling':q.options.find(x=>x!==q.correct);
        const panel = prebuiltExplanationPanel(q,answer);
        assert.ok(panel.includes('Why this answer fits') && panel.includes('Remember it'));
        assert.ok(!panel.includes('undefined'));
        assert.ok(panel.includes('lang="zh"'));
        variants++;
      }
    }
  }
  assert.equal(meanings,990);
  assert.equal(variants,3960);
  for (const a of ANALOGIES) {
    const q = analogyQuestion(a);
    assert.equal(q.lesson,PREBUILT_ANALOGY_LESSONS[a.id]);
    assert.equal(q.lesson.stem,q.prompt);
    assert.equal(q.optionExplanations.length,5);
    assert.ok(q.lesson.guide && q.lesson.chinese && q.lesson.memory);
    for (const choice of q.options) assert.ok(q.optionExplanations.find(n=>n.choice===choice)?.explanation);
    assert.ok(prebuiltExplanationPanel(q,q.correct).includes('Compare the choices'));
  }
  assert.ok(ANALOGIES[54].wrong.includes('heat : flame'));
  assert.ok(ANALOGIES[3].wrong.includes('cold : hot'));
  assert.ok(ANALOGIES[52].wrong.includes('goal : target'));
  assert.ok(ANALOGIES[55].wrong.includes('rainfall : cloud'));
  assert.ok(ANALOGIES[83].wrong.includes('angle : degree'));
  const first=wordQuestion(wordById('impeccable'),'synonyms');
  assert.ok(first.lesson.why.synonyms.includes('clever, fair, or sensible'));
  const second=wordQuestion(wordById('partial'),'context',wordSenses(wordById('partial'))[1]);
  assert.ok(second.lesson.why.context.includes('biased in favor of one side'));
  view='practice';
  session={mode:'synonyms',qs:[first,second],index:0,answers:[first.options.find(x=>x!==first.correct),null],checked:[false,false],flags:[false,false],finished:false,deadline:0};
  assert.ok(!questionView().includes('Why this answer fits'), 'Do not reveal the lesson before checking');
  checkAnswer();
  assert.equal(rec('impeccable').seen,1);
  assert.ok($('app').innerHTML.includes('Why this answer fits'), 'Feedback is available synchronously while offline');
  checkAnswer();
  assert.equal(rec('impeccable').seen,1, 'Viewing a lesson must not record another review');
  session.index=1;checkAnswer(true);
  assert.ok($('app').innerHTML.includes('You skipped this question'));
  state.settings.chinese=false;
  assert.ok(!prebuiltExplanationPanel(second,second.correct).includes('lang="zh"'));
  state.settings.chinese=true;
  const spelling=wordQuestion(wordById('candid'),'spelling');
  const spellingPanel=prebuiltExplanationPanel(spelling,'<img src=x onerror=alert(1)>');
  assert.ok(spellingPanel.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!spellingPanel.includes('<img src=x'));
  assert.ok(spellingPanel.includes('c · a · n · d · i · d'));
  const custom={id:'customtest',word:'customtest',pos:'n',def:'a learner-supplied meaning',syn:'custom item',zh:'自定义',tier:'Custom',topic:'My words'};
  assert.ok(wordQuestion(custom,'definitions').lesson.meaning.includes('learner-supplied meaning'));
  practiceMode='timed';startPractice();
  assert.equal(session.qs.length,60);
  assert.ok(!questionView().includes('Why this answer fits'));
  finishPractice();
  const review=resultView();
  assert.ok(review.includes('Detailed explanation') && review.includes('Why this answer fits'), 'Timed results include offline lessons');
  assert.ok(!review.includes('undefined'));
  console.log('PASS: 990 prebuilt word senses, 3,960 question variants, 85 analogy lessons, every displayed choice explained, immediate offline feedback, timed-review lessons, bilingual support, and preserved grades.');
`, context, {timeout:30000});
assert.equal(requests,0,'No network requests occurred');

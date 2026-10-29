// Data and quiz-behavior checks for the standalone offline page.
// Run with: node tools/check_vocabulary.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'ssat_middle_vocabulary.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const benchmarks = JSON.parse(fs.readFileSync(path.join(__dirname, 'vocabulary-benchmarks.json'), 'utf8'));
const nodes = new Map();
const element = id => {
  if (!nodes.has(id)) nodes.set(id, {innerHTML: '', textContent: '', hidden: false, open: false, addEventListener() {}, showModal() {this.open = true;}, close() {this.open = false;}});
  return nodes.get(id);
};
const saved = {
  version: 1,
  records: {
    candid: {seen: 8, correct: 7, wrong: 1, level: 3, due: 1234, last: 123, star: true},
    tact: {seen: 4, correct: 4, wrong: 0, level: 3, due: 1234, last: 123, star: true},
    testword: {seen: 1, correct: 0, wrong: 1, level: 0, due: 1234, last: 123, star: false},
  },
  custom: [
    {word: 'tact', pos: 'n', def: 'skill in avoiding offense', zh: '得体', syn: 'diplomacy'},
    {word: 'testword', pos: 'n', def: 'a custom entry used for validation', zh: '测试', syn: 'custom item'},
  ],
  days: {'2026-10-28': 12},
  history: [{mode: 'context', total: 10, correct: 8, date: 123}],
  settings: {chinese: true, goal: 20},
};
let storage = JSON.stringify(saved);
const context = vm.createContext({
  assert, benchmarks, console,
  document: {getElementById: element, querySelector: () => element('query'), addEventListener() {}},
  window: {scrollTo() {}, addEventListener() {}},
  localStorage: {getItem: () => storage, setItem: (_, value) => {storage = value;}},
  setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {}, confirm: () => true,
});
vm.runInContext(script, context, {timeout: 10000});
vm.runInContext(`
  const ids = new Set(WORDS.map(w => w.id));
  assert.equal(ids.size, WORDS.length, 'Duplicate headwords');
  assert.equal(WORDS.length, 950);
  assert.equal(Object.keys(EXAMPLES).length, WORDS.length);
  assert.equal(benchmarks.core75.length, 75);
  assert.equal(benchmarks.essential125.length, 125);
  for (const [name, words] of Object.entries(benchmarks)) {
    assert.equal(new Set(words).size, words.length);
    for (const id of words) assert.ok(ids.has(id), name + ' missing ' + id);
  }
  let questionChecks = 0, senseCount = 0;
  for (const w of WORDS) {
    for (const key of ['word','pos','def','zh','syn','tier','topic']) assert.ok(w[key], w.id + ' missing ' + key);
    for (const sense of wordSenses(w)) {
      senseCount++;
      assert.ok(sense.example && sense.def && sense.syn && sense.zh, w.id + ' incomplete sense');
      const hits = sense.example.match(new RegExp('\\\\b' + w.word + '\\\\b', 'gi')) || [];
      assert.equal(hits.length, 1, w.id + ' sentence must have exactly one target');
      for (const mode of ['synonyms','definitions','context','spelling']) {
        const q = wordQuestion(w, mode, sense);
        assert.equal(q.wordId, w.id);
        assert.ok(q.explanation.includes(sense.def), w.id + ' wrong sense in feedback');
        assert.equal(q.zh, sense.zh);
        if (mode === 'context') {
          assert.ok(q.prompt.includes('________'), w.id + ' has no blank');
          assert.ok(!new RegExp('\\\\b' + w.word + '\\\\b', 'i').test(q.prompt), w.id + ' leaks target');
        }
        if (mode === 'synonyms' && wordSenses(w).length > 1) assert.equal(q.cue, sense.example);
        if (mode === 'spelling') assert.equal(q.options.length, 0);
        else {
          assert.equal(q.options.length, 5, w.id + ' needs five choices');
          assert.equal(new Set(q.options.map(s => s.toLowerCase())).size, 5, w.id + ' has repeated choices');
          assert.equal(q.options.filter(s => s === q.correct).length, 1);
        }
        questionChecks++;
      }
    }
  }
  for (const family of WORD_FAMILIES) {
    assert.ok(family.length >= 2);
    for (const id of family) assert.ok(ids.has(id), 'Missing family entry ' + id);
  }
  assert.ok(relatedWords(wordById('courtesy')).some(w => w.id === 'courteous'));
  assert.ok(relatedWords(wordById('tact')).some(w => w.id === 'tactful'));
  assert.ok(related(wordById('fiasco'), wordById('debacle')), 'Do not use close synonyms as distractors');
  assert.ok(related(wordById('tact'), wordById('discretion')), 'Exclude overlapping meanings');
  for (const [type, count] of Object.entries(ANALOGIES.reduce((a,q) => (a[q.type]=(a[q.type]||0)+1,a), {}))) assert.ok(count >= 5, type);
  for (const q of ANALOGIES) {
    assert.equal(q.wrong.length, 4);
    assert.equal(new Set([q.correct,...q.wrong]).size, 5);
    assert.ok(q.explanation);
  }
  assert.equal(ANALOGIES.length, 85);
  assert.equal(KEY, 'wordwise-ssat-middle-v1');
  assert.equal(rec('candid').seen, 8);
  assert.equal(rec('candid').star, true);
  assert.equal(rec('tact').seen, 4, 'New built-in entry must preserve earlier custom progress');
  assert.equal(state.custom.length, 1, 'Remove the newly built-in word from custom duplicates');
  assert.equal(state.custom[0].id, 'testword');
  assert.equal(rec('testword').wrong, 1);
  assert.equal(state.days['2026-10-28'], 12);
  assert.equal(state.history[0].correct, 8);
  assert.equal(allWords().length, 951);
  filters = {tier:'Core',topic:'Emotions & attitudes',status:'All'};
  practiceMode = 'context'; practiceCount = 30; startPractice();
  assert.equal(session.qs.length, 30);
  assert.ok(session.qs.every(q => wordById(q.wordId).tier === 'Core' && wordById(q.wordId).topic === 'Emotions & attitudes'));
  assert.ok(session.qs.every(q => q.prompt.includes('________')));
  session.answers[0] = session.qs[0].correct;
  checkAnswer();
  assert.equal(session.checked[0], true);
  filters = {tier:'All',topic:'All',status:'All'};
  practiceMode = 'timed'; startPractice();
  assert.equal(session.qs.length, 60);
  assert.equal(session.qs.filter(q => q.mode === 'synonyms').length, 30);
  assert.equal(session.qs.filter(q => q.mode === 'analogies').length, 30);
  finishPractice();
  assert.equal(session.finished, true);
  assert.ok(resultView().includes('Answers & explanations'));
  state.settings.chinese = false;
  assert.ok(!extraWordDetails(wordById('partial')).includes('lang="zh"'));
  state.settings.chinese = true;
  showDetail('partial');
  assert.ok($('detailDialog').innerHTML.includes('biased'));
  console.log('PASS: ' + WORDS.length + ' words, ' + senseCount + ' senses, ' + questionChecks + ' quiz variants, all benchmark headwords, saved-progress migration, filtered context practice, and timed drill.');
`, context, {timeout: 30000});

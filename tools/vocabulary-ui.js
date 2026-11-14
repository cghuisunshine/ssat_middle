// @function wordSenses
function wordSenses(w) {
  return [{...w, example: EXAMPLES[w.id]}, ...(SECONDARY_MEANINGS[w.id] || []).map(s => ({...w, ...s}))];
}

// @function relatedWords
function relatedWords(w) {
  const ids = new Set(WORD_FAMILIES.filter(f => f.includes(w.id)).flat());
  ids.delete(w.id);
  return WORDS.filter(v => ids.has(v.id));
}

// @function extraWordDetails
function extraWordDetails(w) {
  const senses = SECONDARY_MEANINGS[w.id] || [], family = relatedWords(w), sources = READING_WORD_SOURCES[w.id] || [];
  const online = (ONLINE_WORD_SOURCES[w.id] || []).map(id => ONLINE_SOURCES[id]);
  const note = ONLINE_USAGE_NOTES[w.id];
  if (!senses.length && !family.length && !sources.length && !online.length && !note) return '';
  return (note ? '<p class="usage-note"><strong>' + (studyEligible(w) ? 'Usage note: ' : 'Needs review: ') + '</strong>' + esc(note) + '</p>' : '') +
    '<details class="extra-meanings"><summary>More meanings, related words &amp; sources</summary>' +
    senses.map(s => '<div class="sense"><strong>' + esc(s.pos) + '.</strong> ' + esc(s.def) +
      (state.settings.chinese ? '<div class="zh" lang="zh">' + esc(s.zh) + '</div>' : '') +
      '<div class="sub">Closest synonym: ' + esc(s.syn) + '</div><p class="example">' + esc(s.example) + '</p></div>').join('') +
    (family.length ? '<div class="sense"><strong>Related words</strong><p class="sub">Compare their meanings and parts of speech.</p><div class="family-links">' +
      family.map(v => '<button class="text-btn" data-action="detail" data-id="' + esc(v.id) + '">' + esc(v.word) + ' <span class="sub">' + esc(v.pos) + '.</span></button>').join('') + '</div></div>' : '') +
    (sources.length ? '<div class="sense"><strong>From your reading materials</strong>' + sources.map(s =>
      '<p class="sub">' + esc(s.title) + ' · form in the reading: “' + esc(s.form) + '”<br>' + esc(s.file) +
      (s.pages.length ? ' · PDF page' + (s.pages.length === 1 ? ' ' : 's ') + esc(s.pages.join(', ')) : '') + '</p>').join('') + '</div>' : '') +
    (online.length ? '<div class="sense"><strong>Online Middle Level source labels</strong><p class="sub">Source labels describe the list or deck; they do not certify exam frequency or difficulty. Definitions and examples here are original.</p>' + online.map(s =>
      '<p class="sub"><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a><br>' +
      esc(s.scope === 'mixed_middle_ssat_isee' ? 'Middle Level SSAT / ISEE combined' : 'SSAT Middle Level–labeled') + ' · ' +
      esc(s.kind.replaceAll('_', ' ')) + ' · ' + esc(s.status.replaceAll('_', ' ')) +
      (s.notes ? '<br>' + esc(s.notes) : '') + '</p>').join('') + '</div>' : '') + '</details>';
}

// @function coverage
function coverage() {
  return '<div class="coverage"><strong>' + WORDS.length + ' entries · ' + WORDS.filter(studyEligible).length + ' study words</strong><br>' +
    'Added all 1,598 Middle Level–labeled candidates. Use the SOURCE filter to focus your study.<details><summary>Coverage &amp; source labels</summary>' +
    'The expansion includes 219 published-list and practice-test additions plus 1,379 other online candidates. One unverified source spelling is visible in the library and excluded from study sessions. ' +
    'Core and Stretch are editorial study tiers; community and mixed SSAT/ISEE labels are shown in word details. ' +
    'Includes all headwords in Ivy Global’s <a href="https://www.ssatprep.com/ssat-vocabulary/" target="_blank" rel="noopener">75-word core and 125-word essential samples</a>, plus related forms. ' +
    Object.keys(READING_WORD_SOURCES).length + ' entries also connect to the 37 passages in your reading materials. ' +
    'Both samples serve more than one test level; they are preparation benchmarks. This is a broad study bank, not an official or exhaustive exam list.</details></div>';
}

// @function studyEligible
function studyEligible(w) {
  return !Object.prototype.hasOwnProperty.call(ONLINE_WORD_WARNINGS, w.id);
}

// @function wordPattern
function wordPattern(word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?<![\\p{L}\\p{N}_])' + escaped + '(?![\\p{L}\\p{N}_])', 'giu');
}

// @function matchesOrigin
function matchesOrigin(w) {
  const origin = filters.origin || 'All';
  return origin === 'All' ||
    origin === 'Earlier bank' && w.tier !== 'Custom' && !ONLINE_WORD_SOURCES[w.id] ||
    origin === 'All 1,598 additions' && !!ONLINE_WORD_SOURCES[w.id] ||
    origin === '219 published additions' && ONLINE_PRIORITY.includes(w.id) ||
    origin === 'Other online additions' && !!ONLINE_WORD_SOURCES[w.id] && !ONLINE_PRIORITY.includes(w.id) ||
    origin === 'Needs review' && !studyEligible(w) ||
    origin === 'My added words' && w.tier === 'Custom';
}

// @function filtered
function filtered() {
  return allWords().filter(w => {
    const r = rec(w.id);
    return matchesOrigin(w) && (filters.tier === 'All' || w.tier === filters.tier) &&
      (filters.topic === 'All' || w.topic === filters.topic) &&
      (filters.status === 'All' || filters.status === statusOf(w) || filters.status === 'Starred' && r.star || filters.status === 'Review due' && r.seen > 0 && r.due <= Date.now());
  });
}

// @function filterBar
function filterBar() {
  const topics = [...new Set(allWords().filter(w => matchesOrigin(w) && (filters.tier === 'All' || w.tier === filters.tier)).map(w => w.topic))].sort();
  return '<div class="filters"><label>SOURCE<select data-filter="origin" aria-label="Vocabulary source">' +
    options(['All','Earlier bank','All 1,598 additions','219 published additions','Other online additions','Needs review',...(state.custom.length ? ['My added words'] : [])],filters.origin || 'All') + '</select></label>' +
    '<label>LEVEL<select data-filter="tier" aria-label="Vocabulary level">' + options(['All','Foundation','Core','Stretch',...(state.custom.length?['Custom']:[])],filters.tier) + '</select></label>' +
    '<label>TOPIC<select data-filter="topic" aria-label="Vocabulary topic">' + options(['All',...topics],filters.topic) + '</select></label>' +
    '<label>WORD POOL<select data-filter="status" aria-label="Word pool">' + options(['All','New','Learning','Secure','Review due','Starred'],filters.status) + '</select></label></div>';
}

// @function newDeck
function newDeck() {
  const pool = filtered().filter(studyEligible);
  const due = shuffle(pool.filter(w => rec(w.id).seen && rec(w.id).due <= Date.now())).sort((a,b) => rec(a.id).due - rec(b.id).due);
  const fresh = shuffle(pool.filter(w => !rec(w.id).seen)), later = shuffle(pool.filter(w => rec(w.id).seen && rec(w.id).due > Date.now()));
  deck = [...due,...fresh,...later].slice(0,20); deckIndex = 0; revealed = false;
}

// @function startPractice
function startPractice() {
  let qs = [];
  const pool = filtered().filter(studyEligible);
  if (practiceMode === 'timed') qs = [...shuffle(WORDS.filter(studyEligible)).slice(0,30).map(w => wordQuestion(w,'synonyms')), ...shuffle(ANALOGIES).slice(0,30).map(analogyQuestion)];
  else if (practiceMode === 'analogies') qs = shuffle(ANALOGIES).slice(0,practiceCount).map(analogyQuestion);
  else qs = shuffle(pool.filter(w => practiceMode !== 'context' || EXAMPLES[w.id])).slice(0,practiceCount).map(w => wordQuestion(w,practiceMode));
  if (!qs.length) { toast('No eligible words. Try a different source, pool, or practice type.'); return; }
  session = {mode:practiceMode,qs,index:0,answers:Array(qs.length).fill(null),checked:Array(qs.length).fill(false),flags:Array(qs.length).fill(false),finished:false,started:Date.now(),deadline:practiceMode === 'timed' ? Date.now()+1800000 : 0};
  clearInterval(tick); if (session.deadline) tick = setInterval(updateTimer,250); render();
}

// @function related
function related(a, b) {
  const parts = w => {
    if (RELATION_CACHE.has(w.id)) return RELATION_CACHE.get(w.id);
    const labels = wordSenses(wordById(w.id) || w).flatMap(s => [s.word, s.syn]).map(s => s.toLowerCase());
    const groups = new Set();
    [...FAMILIES, ...EXTRA_SYNONYM_FAMILIES, ...WORD_FAMILIES].forEach((f, i) => { if (labels.some(v => f.includes(v))) groups.add(i); });
    const result = {labels, groups};
    RELATION_CACHE.set(w.id, result);
    return result;
  };
  const x = parts(a), y = parts(b);
  return x.labels.some(v => y.labels.includes(v)) || [...x.groups].some(g => y.groups.has(g));
}

// @function wordQuestion
function wordQuestion(original, mode, chosenSense = null) {
  if (!studyEligible(original)) throw new Error('This source spelling is awaiting review.');
  const senses = wordSenses(original), w = chosenSense || senses[Math.floor(Math.random() * senses.length)];
  const correct = ['synonyms'].includes(mode) ? w.syn : w.word;
  const eligible = v => v.id !== w.id && studyEligible(v) && !related(original, v);
  const candidates = shuffle(WORDS.filter(v => v.pos === w.pos && eligible(v)))
    .sort((a,b) => Number(a.topic === w.topic) - Number(b.topic === w.topic));
  const labels = new Set(candidates.map(v => (mode === 'synonyms' ? v.syn : v.word).toLowerCase()));
  labels.delete(correct.toLowerCase());
  // Conjunctions and interjections have too few same-part-of-speech entries.
  if (labels.size < 4) candidates.push(...shuffle(WORDS.filter(v => v.pos !== w.pos && eligible(v))));
  const lesson = wordLesson(w);
  const seen = new Set([correct.toLowerCase()]), wrong = [];
  const optionExplanations = [{choice:correct, explanation:lesson.meaning, zh:lesson.zh}];
  for (const v of candidates) {
    const label = mode === 'synonyms' ? v.syn : v.word;
    if (!seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase()); wrong.push(label);
      const other = wordLesson(v);
      optionExplanations.push({choice:label, explanation:mode === 'synonyms' ? 'Here “'+label+'” expresses “'+other.definition+'” (as in '+other.word+').' : other.meaning, zh:other.zh});
    }
    if (wrong.length === 4) break;
  }
  let prompt = w.word.toUpperCase(), type = 'Synonym';
  if (mode === 'definitions' || mode === 'spelling') { prompt = w.def; type = mode === 'spelling' ? 'Active recall' : 'Meaning'; }
  if (mode === 'context') { prompt = w.example.replace(wordPattern(w.word), '________'); type = 'Word in context'; }
  const multipleSenses = senses.length > 1;
  return {mode, type, prompt, wordId: w.id, correct, lesson, optionExplanations,
    options: mode === 'spelling' ? [] : shuffle([correct, ...wrong]),
    // Synonym stems need a sense cue when the same spelling has distinct meanings.
    cue: mode === 'synonyms' && multipleSenses ? w.example : '',
    explanation: w.word + ' (' + w.pos + '.) means ' + w.def + '. Closest synonym: ' + w.syn + '. Example: ' + (w.example || 'Use this meaning in your own sentence.'),
    zh: w.zh};
}

// @function checkAnswer
function checkAnswer(skip = false) {
  const s = session;
  if (!s || s.finished || s.deadline || s.checked[s.index]) return;
  const q = s.qs[s.index];
  if (!skip && s.answers[s.index] === null) return;
  s.checked[s.index] = true;
  if (q.wordId) recordWord(q.wordId, s.answers[s.index] === q.correct ? 'correct' : 'wrong');
  render();
}

// @function render
function render() {
  stopWordAudio();
  ({learn, library, practice, roots, progress}[view])();
}

// @function analogyQuestion
function analogyQuestion(a) {
  const lesson = PREBUILT_ANALOGY_LESSONS[a.id];
  return {mode:'analogies',type:a.type+' analogy',prompt:a.stem,correct:a.correct,
    options:shuffle([a.correct,...a.wrong]),explanation:a.explanation,lesson,optionExplanations:lesson.choices};
}

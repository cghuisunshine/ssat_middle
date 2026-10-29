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
  const senses = SECONDARY_MEANINGS[w.id] || [], family = relatedWords(w);
  if (!senses.length && !family.length) return '';
  return '<details class="extra-meanings"><summary>More meanings &amp; related words</summary>' +
    senses.map(s => '<div class="sense"><strong>' + esc(s.pos) + '.</strong> ' + esc(s.def) +
      (state.settings.chinese ? '<div class="zh" lang="zh">' + esc(s.zh) + '</div>' : '') +
      '<div class="sub">Closest synonym: ' + esc(s.syn) + '</div><p class="example">' + esc(s.example) + '</p></div>').join('') +
    (family.length ? '<div class="sense"><strong>Related words</strong><p class="sub">Compare their meanings and parts of speech.</p><div class="family-links">' +
      family.map(v => '<button class="text-btn" data-action="detail" data-id="' + esc(v.id) + '">' + esc(v.word) + ' <span class="sub">' + esc(v.pos) + '.</span></button>').join('') + '</div></div>' : '') + '</details>';
}

// @function coverage
function coverage() {
  return '<div class="coverage"><strong>' + WORDS.length + ' words · context practice for every word</strong><br>' +
    'Includes all headwords in Ivy Global’s <a href="https://www.ssatprep.com/ssat-vocabulary/" target="_blank" rel="noopener">75-word core and 125-word essential samples</a>, plus related forms. ' +
    'Both samples serve more than one test level; they are preparation benchmarks. This is a broad study bank, not an official or exhaustive exam list.</div>';
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
  const senses = wordSenses(original), w = chosenSense || senses[Math.floor(Math.random() * senses.length)];
  const candidates = shuffle(WORDS.filter(v => v.id !== w.id && v.pos === w.pos && !related(original, v)))
    .sort((a, b) => Number(a.topic === w.topic) - Number(b.topic === w.topic));
  const correct = ['synonyms'].includes(mode) ? w.syn : w.word;
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
  if (mode === 'context') { prompt = w.example.replace(new RegExp('\\b' + w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), '________'); type = 'Word in context'; }
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
  ({learn, library, practice, roots, progress}[view])();
}

// @function analogyQuestion
function analogyQuestion(a) {
  const lesson = PREBUILT_ANALOGY_LESSONS[a.id];
  return {mode:'analogies',type:a.type+' analogy',prompt:a.stem,correct:a.correct,
    options:shuffle([a.correct,...a.wrong]),explanation:a.explanation,lesson,optionExplanations:lesson.choices};
}

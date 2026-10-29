// These lessons are compiled into this page; checking answers needs no network.
function wordLesson(w) {
  const built = PREBUILT_WORD_LESSONS[w.id]?.find(s => s.pos === w.pos && s.definition === w.def && s.syn === w.syn);
  if (built) return built;
  // Learner-added words can only use the meaning supplied by the learner.
  const meaning = w.word + ' (' + w.pos + '.) means “' + w.def + '”.';
  return {word:w.word,pos:w.pos,definition:w.def,syn:w.syn,zh:w.zh,meaning,
    why:{synonyms:meaning+' The supplied closest expression is “'+w.syn+'”.',definitions:meaning,context:meaning,spelling:meaning},
    example:EXAMPLES[w.id]||'',memory:'Cover your definition and recall the word, then write a sentence using this meaning.',
    grammar:'Use the part of speech and the precise meaning recorded in your word bank.',
    chinese:w.zh ? w.word+'：'+w.zh+'。请按你添加的释义复习。' : ''};
}

function prebuiltExplanationPanel(q, answer) {
  const lesson = q.lesson;
  if (!lesson) return '';
  const analogy = q.mode === 'analogies';
  const why = analogy ? lesson.why : lesson.why[q.mode];
  const notes = q.optionExplanations || [];
  const choiceList = q.options.map(choice => {
    const note = notes.find(item => item.choice === choice);
    const labels = [choice === q.correct ? 'Answer' : '', choice === answer ? 'Your choice' : ''].filter(Boolean).join(' · ');
    return '<li><strong>'+esc(choice)+'</strong>'+(labels?' <span class="sub">('+labels+')</span>':'')+': '+esc(note?.explanation || '')+
      (state.settings.chinese && note?.zh ? '<div class="sub" lang="zh">'+esc(note.zh)+'</div>' : '')+'</li>';
  }).join('');
  let reflection = answer === null ? '<p>You skipped this question. Read the matching rule, then compare the choices.</p>' : '';
  if (q.mode === 'spelling') {
    reflection = '<p><strong>Spelling check</strong><br>Expected: '+esc(q.correct)+' ('+q.correct.length+' letters).'+
      (answer !== null ? ' Your entry: '+esc(answer)+'.' : '')+'<br>'+esc([...q.correct].join(' · '))+'</p>';
    if (answer && answer !== q.correct) {
      const other = wordById(answer);
      reflection += '<p>'+(other ? '“'+esc(other.word)+'” means “'+esc(other.def)+'”. Compare that meaning with the definition in the question.' : 'Compare your entry with the letter sequence above, then cover it and spell the word again.')+'</p>';
    }
  }
  return '<aside class="answer-explanation" aria-label="Detailed explanation"><h3>Why this answer fits</h3><p>'+esc(why)+'</p>'+reflection+
    '<p>'+esc(analogy ? lesson.guide : lesson.grammar)+'</p>'+
    (choiceList ? '<h4>Compare the choices</h4><ul class="explanation-choices">'+choiceList+'</ul>' : '')+
    (!analogy && lesson.example ? '<h4>Meaning in context</h4><p class="example">'+esc(lesson.example)+'</p>' : '')+
    '<h4>Remember it</h4><p>'+esc(lesson.memory)+'</p>'+
    (state.settings.chinese && lesson.chinese ? '<p lang="zh">'+esc(lesson.chinese)+'</p>' : '')+'</aside>';
}

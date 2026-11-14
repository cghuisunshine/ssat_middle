// Pre-generated Edge TTS recordings; no browser speech engine or cloud call.
function stopWordAudio() {
  const track = speak.current;
  if (!track) return;
  speak.current = null;
  cancelAnimationFrame(track.frame);
  track.audio.pause();
  track.audio.removeAttribute('src');
  track.audio.load();
  for (const span of track.spans) span.classList.remove('is-speaking');
  for (const button of track.buttons) {
    button.removeAttribute('aria-busy');
    button.setAttribute('aria-pressed','false');
    button.title = track.resetTitle;
  }
}

function prepareTimedText(nodes, text, timings) {
  const spans = [];
  for (const node of nodes) {
    if (node.textContent !== text) continue;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const [index, timing] of timings.entries()) {
      fragment.append(document.createTextNode(text.slice(cursor,timing.start_char)));
      const span = document.createElement('span');
      span.className = 'tts-word';
      span.dataset.index = String(index);
      span.textContent = text.slice(timing.start_char,timing.end_char);
      fragment.append(span);
      spans.push(span);
      cursor = timing.end_char;
    }
    fragment.append(document.createTextNode(text.slice(cursor)));
    node.replaceChildren(fragment);
  }
  return spans;
}

function prepareWordHighlight(word, timings) {
  return prepareTimedText(document.querySelectorAll('.word, .table-word'),word,timings);
}

function exampleMarkup(text, extraClass = '') {
  if (!exampleMarkup.index) exampleMarkup.index = new Map(Object.entries(EXAMPLE_AUDIO.examples).map(([id,record]) => [record.text,id]));
  const id = exampleMarkup.index.get(text) || '';
  return '<p class="example '+esc(extraClass)+'"><span class="example-text" data-example-id="'+esc(id)+'">'+esc(text)+'</span> '+
    '<button class="example-read" data-action="read-example" data-example-id="'+esc(id)+'" aria-label="Read example sentence" aria-pressed="false" title="'+(id?'Read example aloud':'No recording available')+'" '+(id?'':'disabled')+'>'+icon('sound')+' Read</button></p>';
}

async function speak(id) {
  const word = wordById(id);
  if (!word) return;
  const recording = WORD_AUDIO.words[id];
  if (!recording) {
    stopWordAudio();
    toast(studyEligible(word) ? 'This added word has no recording yet.' : 'This source spelling is awaiting review.');
    return;
  }
  const buttons = [...document.querySelectorAll('[data-action="speak"]')].filter(b => b.dataset.id === id);
  return playRecording(id,recording,buttons,() => prepareWordHighlight(word.word,recording.words),'Hear word');
}

async function readExample(id) {
  const recording = EXAMPLE_AUDIO.examples[id];
  if (!recording) { stopWordAudio(); toast('This example has no recording yet.'); return; }
  const buttons = [...document.querySelectorAll('[data-action="read-example"]')].filter(b => b.dataset.exampleId === id);
  const nodes = [...document.querySelectorAll('.example-text')].filter(n => n.dataset.exampleId === id);
  return playRecording('example:'+id,recording,buttons,() => prepareTimedText(nodes,recording.text,recording.words),'Read example aloud');
}

async function playRecording(id, recording, buttons, makeSpans, resetTitle) {
  if (speak.current?.id === id) { stopWordAudio(); return; }
  stopWordAudio();
  const audio = new Audio(recording.file);
  audio.preload = 'auto';
  const track = {id,audio,buttons,spans:makeSpans(),frame:0,resetTitle};
  speak.current = track;
  for (const button of buttons) {
    button.setAttribute('aria-busy','true');
    button.setAttribute('aria-pressed','true');
    button.title = 'Stop reading';
  }
  function failed() {
    if (speak.current !== track) return;
    stopWordAudio();
    toast('Could not load the recording. For offline listening, keep the audio folder beside this HTML page.');
  }
  function paint() {
    track.frame = 0;
    if (speak.current !== track) return;
    if (track.spans.length && !track.spans.some(span => span.isConnected)) { stopWordAudio(); return; }
    const time = audio.currentTime;
    for (const span of track.spans) {
      const timing = recording.words[Number(span.dataset.index)];
      span.classList.toggle('is-speaking',!audio.paused && time >= timing.start && time < timing.end);
    }
    if (!audio.paused && !audio.ended) track.frame = requestAnimationFrame(paint);
  }
  audio.onplaying = () => {
    if (speak.current !== track) return;
    for (const button of buttons) button.removeAttribute('aria-busy');
    if (!track.frame) paint();
  };
  audio.onended = () => { if (speak.current === track) stopWordAudio(); };
  audio.onerror = failed;
  const dialog = $('detailDialog');
  if (dialog.open && !dialog.wordAudioBound) {
    dialog.wordAudioBound = true;
    dialog.addEventListener('close',stopWordAudio);
  }
  try { await audio.play(); }
  catch { failed(); }
}

window.addEventListener('pagehide',stopWordAudio);

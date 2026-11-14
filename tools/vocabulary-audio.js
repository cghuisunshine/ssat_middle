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
    button.title = 'Hear word';
  }
}

function prepareWordHighlight(word, timings) {
  const spans = [];
  for (const node of document.querySelectorAll('.word')) {
    if (node.textContent !== word) continue;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const [index, timing] of timings.entries()) {
      fragment.append(document.createTextNode(word.slice(cursor,timing.start_char)));
      const span = document.createElement('span');
      span.className = 'tts-word';
      span.dataset.index = String(index);
      span.textContent = word.slice(timing.start_char,timing.end_char);
      fragment.append(span);
      spans.push(span);
      cursor = timing.end_char;
    }
    fragment.append(document.createTextNode(word.slice(cursor)));
    node.replaceChildren(fragment);
  }
  return spans;
}

async function speak(id) {
  const word = wordById(id);
  if (!word) return;
  if (speak.current?.id === id) { stopWordAudio(); return; }
  stopWordAudio();
  const recording = WORD_AUDIO.words[id];
  if (!recording) {
    toast(studyEligible(word) ? 'This added word has no recording yet.' : 'This source spelling is awaiting review.');
    return;
  }
  const audio = new Audio(recording.file);
  audio.preload = 'auto';
  const buttons = [...document.querySelectorAll('[data-action="speak"]')].filter(b => b.dataset.id === id);
  const track = {id,audio,buttons,spans:prepareWordHighlight(word.word,recording.words),frame:0};
  speak.current = track;
  for (const button of buttons) {
    button.setAttribute('aria-busy','true');
    button.setAttribute('aria-pressed','true');
    button.title = 'Stop pronunciation';
  }
  function failed() {
    if (speak.current !== track) return;
    stopWordAudio();
    toast('Could not load the word recording. For offline listening, keep the audio folder beside this HTML page.');
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

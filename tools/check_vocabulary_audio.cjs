// Verify real recording coverage and the audio player's interruption/error behavior.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const manifest = JSON.parse(fs.readFileSync(path.join(root,'audio/vocabulary-manifest.json'),'utf8'));
const html = fs.readFileSync(path.join(root,'ssat_middle_vocabulary.html'),'utf8');
const embedded = name => JSON.parse(html.match(new RegExp('^const '+name+'=([\\s\\S]*?);\\n','m'))[1]);
const raw = embedded('RAW_WORDS'), warnings = embedded('ONLINE_WORD_WARNINGS');
const expected = raw.split('\n').filter(l=>l && !l.startsWith('@')).map(l=>l.split('|')[0]).filter(w=>!Object.hasOwn(warnings,w)).sort();
assert.equal(manifest.provider,'edge-tts');
assert.equal(manifest.voice,'en-US-AriaNeural');
assert.equal(manifest.boundary,'WordBoundary');
assert.equal(expected.length,2697);
assert.deepEqual(Object.keys(manifest.words).sort(),expected);
assert.ok(!/speechSynthesis|SpeechSynthesisUtterance/.test(html),'No browser speech engine');
assert.ok(!manifest.words.obstrusion,'Unverified spelling has no recording');
const runtime = embedded('WORD_AUDIO');
assert.equal(runtime.voice,manifest.voice);
assert.deepEqual(Object.keys(runtime.words).sort(),expected);
const assetNames = new Set();
for (const word of expected) {
  const record = manifest.words[word];
  const {sha256,...publicRecord} = record;
  assert.deepEqual(runtime.words[word],publicRecord,word+' embedded playback metadata');
  assert.equal(record.text,word);
  assert.match(record.file,/^audio\/words\/[a-f0-9]{20}\.mp3$/);
  assert.ok(!assetNames.has(record.file),'No accidental reused clip');
  assetNames.add(record.file);
  const data=fs.readFileSync(path.join(root,record.file));
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),record.sha256,word+' checksum');
  assert.ok(data.length>1000 && data.length%144===0,word+' complete MP3 frames');
  for(let i=0;i<data.length;i+=144) assert.ok(data[i]===0xff && (data[i+1]&0xe0)===0xe0,word+' MP3 frame header');
  assert.equal(record.duration,data.length*8/48000,word+' CBR duration');
  assert.ok(record.words.length>=1,word+' Edge boundaries');
  let lastChar=0,lastTime=0;
  for(const timing of record.words){
    assert.ok(timing.start>=lastTime && timing.end>timing.start && timing.end<=record.duration,word+' timing range');
    assert.ok(timing.start_char>=lastChar && timing.end_char>timing.start_char && timing.end_char<=word.length,word+' character range');
    assert.equal(word.slice(timing.start_char,timing.end_char),timing.text,word+' exact visible text');
    assert.ok(!/[\p{L}\p{N}]/u.test(word.slice(lastChar,timing.start_char)),word+' missed spoken letters');
    lastChar=timing.end_char;lastTime=timing.end;
  }
  assert.ok(!/[\p{L}\p{N}]/u.test(word.slice(lastChar)),word+' incomplete spoken text');
}
const actualFiles = fs.readdirSync(path.join(root,'audio/words')).filter(f=>f.endsWith('.mp3')).map(f=>'audio/words/'+f);
assert.deepEqual(actualFiles.sort(),[...assetNames].sort(),'No orphan recordings');

const sentenceManifest = JSON.parse(fs.readFileSync(path.join(root,'audio/example-manifest.json'),'utf8'));
const sentenceRuntime = embedded('EXAMPLE_AUDIO');
const primary = embedded('EXAMPLES'), secondary = embedded('SECONDARY_MEANINGS');
const sentences = Object.fromEntries(Object.entries(primary).filter(([w])=>!Object.hasOwn(warnings,w)).map(([w,text])=>[w+'#0',text]));
for(const [word,senses] of Object.entries(secondary)) senses.forEach((s,i)=>sentences[word+'#'+(i+1)]=s.example);
assert.equal(Object.keys(sentences).length,2744);
assert.deepEqual(Object.keys(sentenceManifest.examples).sort(),Object.keys(sentences).sort());
assert.deepEqual(Object.keys(sentenceRuntime.examples).sort(),Object.keys(sentences).sort());
assert.equal(sentenceManifest.provider,'edge-tts');
assert.equal(sentenceRuntime.voice,sentenceManifest.voice);
const exampleFiles = new Set();
for(const [id,text] of Object.entries(sentences)) {
  const record=sentenceManifest.examples[id],{sha256,...publicRecord}=record;
  assert.equal(record.text,text,id+' exact sentence');
  assert.deepEqual(sentenceRuntime.examples[id],publicRecord,id+' embedded sentence timings');
  assert.equal(record.wordId,id.split('#')[0]);
  assert.equal(record.senseIndex,Number(id.split('#')[1]));
  assert.match(record.file,/^audio\/examples\/[a-f0-9]{20}\.mp3$/);
  assert.ok(!exampleFiles.has(record.file),'No reused sentence clip');exampleFiles.add(record.file);
  const data=fs.readFileSync(path.join(root,record.file));
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),sha256,id+' checksum');
  assert.ok(data.length>1000 && data.length%144===0,id+' complete frames');
  for(let i=0;i<data.length;i+=144) assert.ok(data[i]===0xff && (data[i+1]&0xe0)===0xe0,id+' frame header');
  assert.equal(record.duration,data.length*8/48000);
  let lastChar=0,lastTime=0;
  for(const timing of record.words) {
    assert.ok(timing.start>=lastTime && timing.end>timing.start && timing.end<=record.duration,id+' timing range');
    assert.ok(timing.start_char>=lastChar && timing.end_char>timing.start_char && timing.end_char<=text.length,id+' character range');
    assert.equal(text.slice(timing.start_char,timing.end_char),timing.text,id+' exact spoken token');
    assert.ok(!/[\p{L}\p{N}]/u.test(text.slice(lastChar,timing.start_char)),id+' omitted letters');
    lastChar=timing.end_char;lastTime=timing.end;
  }
  assert.ok(record.words.length && !/[\p{L}\p{N}]/u.test(text.slice(lastChar)),id+' complete sentence');
}
assert.deepEqual(fs.readdirSync(path.join(root,'audio/examples')).filter(f=>f.endsWith('.mp3')).map(f=>'audio/examples/'+f).sort(),[...exampleFiles].sort(),'No orphan sentence clips');

function element(text=''){
  return {textContent:text,children:[],dataset:{},attrs:{},isConnected:true,
    classList:{values:new Set(),remove(v){this.values.delete(v)},toggle(v,on){on?this.values.add(v):this.values.delete(v)}},
    append(child){this.children.push(child)},replaceChildren(fragment){this.children=fragment.children;},
    setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},addEventListener(){}};
}
let wordNode=element('ad hoc'),button=element();button.dataset.id='ad hoc';
const exampleId='partial#1',exampleRecord=sentenceManifest.examples[exampleId];
let exampleNode=element(exampleRecord.text),exampleButton=element();
exampleNode.dataset.exampleId=exampleId;exampleButton.dataset.exampleId=exampleId;
let dialog={open:false,addEventListener(){}};
const audios=[],frames=new Map(),toasts=[];
let frameId=0,failNext=false;
class FakeAudio{
  constructor(src){this.src=src;this.currentTime=0;this.paused=true;this.ended=false;audios.push(this);}
  async play(){if(failNext){failNext=false;throw Error('Decoder failure')}this.paused=false;this.onplaying?.();}
  pause(){this.paused=true;}
  load(){}
  removeAttribute(name){if(name==='src')this.src='';}
}
const context=vm.createContext({WORD_AUDIO:manifest,EXAMPLE_AUDIO:sentenceManifest,Audio:FakeAudio,
  icon:()=>'<svg></svg>',esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  wordById:id=>id==='customword'?{id,word:id}:manifest.words[id]?{id,word:id}:id==='obstrusion'?{id,word:id}:null,
  studyEligible:w=>w.id!=='obstrusion',toast:m=>toasts.push(m),$:()=>dialog,
  window:{addEventListener(){}},document:{querySelectorAll:q=>q==='.word, .table-word'?[wordNode]:q==='.example-text'?[exampleNode]:q==='[data-action="read-example"]'?[exampleButton]:[button],
    createDocumentFragment:()=>element(),createTextNode:text=>element(text),createElement:()=>element()},
  requestAnimationFrame:callback=>{frames.set(++frameId,callback);return frameId},cancelAnimationFrame:id=>frames.delete(id),
});
vm.runInContext(fs.readFileSync(path.join(root,'tools/vocabulary-audio.js'),'utf8'),context);
async function main(){
  await vm.runInContext("speak('ad hoc')",context);
  assert.equal(audios[0].src,manifest.words['ad hoc'].file);
  assert.equal(button.attrs['aria-pressed'],'true');
  assert.equal(wordNode.children.filter(n=>n.className==='tts-word').length,2,'Multiword highlighting spans');
  audios[0].currentTime=manifest.words['ad hoc'].words[0].start+0.01;
  const [id,paint]=frames.entries().next().value;frames.delete(id);paint();
  assert.ok(wordNode.children.some(n=>n.classList.values.has('is-speaking')),'Actual boundary drives highlight');
  await vm.runInContext("speak('ad hoc')",context);
  assert.ok(audios[0].paused && audios[0].src==='','Repeat click stops');
  assert.equal(button.attrs['aria-pressed'],'false');
  assert.ok(!wordNode.children.some(n=>n.classList.values.has('is-speaking')),'Stop clears highlight');
  await vm.runInContext("speak('able')",context);
  const previous=audios.at(-1);await vm.runInContext("speak('abandon')",context);
  assert.ok(previous.paused && previous.src==='','Another word interrupts');
  const current=audios.at(-1);previous.onerror();
  assert.equal(vm.runInContext('speak.current.audio',context),current,'Stale error cannot stop new recording');
  current.onended();assert.equal(vm.runInContext('speak.current',context),null,'Ended resets');
  failNext=true;await vm.runInContext("speak('able')",context);
  assert.ok(toasts.at(-1).includes('Could not load'));
  assert.equal(vm.runInContext('speak.current',context),null);
  const count=audios.length;
  await vm.runInContext("speak('customword')",context);
  assert.ok(toasts.at(-1).includes('no recording yet'));
  await vm.runInContext("speak('obstrusion')",context);
  assert.ok(toasts.at(-1).includes('awaiting review'));
  assert.equal(audios.length,count,'Unavailable words never invoke another speech engine');
  await vm.runInContext("speak('able')",context);const wordTrack=audios.at(-1);
  await vm.runInContext("readExample('partial#1')",context);
  assert.ok(wordTrack.paused && wordTrack.src==='','Sentence interrupts word playback');
  assert.equal(audios.at(-1).src,exampleRecord.file,'Alternate-meaning example uses its own recording');
  assert.equal(exampleButton.attrs['aria-pressed'],'true');
  assert.equal(exampleNode.children.filter(n=>n.className==='tts-word').length,exampleRecord.words.length,'Sentence gets a span per Edge boundary');
  const sentenceTrack=audios.at(-1);
  await vm.runInContext("speak('able')",context);
  assert.ok(sentenceTrack.paused && sentenceTrack.src==='','Word interrupts sentence playback');
  await vm.runInContext("readExample('partial#1')",context);
  await vm.runInContext("readExample('partial#1')",context);
  assert.equal(vm.runInContext('speak.current',context),null,'Repeat sentence click stops');
  assert.equal(exampleButton.attrs['aria-pressed'],'false');
  assert.equal(exampleButton.title,'Read example aloud');
  assert.ok(vm.runInContext("exampleMarkup(EXAMPLE_AUDIO.examples['partial#1'].text)",context).includes('data-example-id="partial#1"'));
  assert.ok(vm.runInContext("exampleMarkup('<img src=x onerror=alert(1)>')",context).includes('&lt;img'));
  assert.ok(vm.runInContext("exampleMarkup('unrecorded sentence')",context).includes('disabled'));
  assert.equal(frames.size,0,'No animation loops left running');
  console.log('PASS: 2,697 word and 2,744 sentence Edge TTS MP3s, every asset checksum/frame, exact text/timings, highlighting, word/sentence interruption, stop/replay, stale errors, unavailable content, and no speech-synthesis fallback.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

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

function element(text=''){
  return {textContent:text,children:[],dataset:{},attrs:{},isConnected:true,
    classList:{values:new Set(),remove(v){this.values.delete(v)},toggle(v,on){on?this.values.add(v):this.values.delete(v)}},
    append(child){this.children.push(child)},replaceChildren(fragment){this.children=fragment.children;},
    setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},addEventListener(){}};
}
let wordNode=element('ad hoc'),button=element();button.dataset.id='ad hoc';
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
const context=vm.createContext({WORD_AUDIO:manifest,Audio:FakeAudio,
  wordById:id=>id==='customword'?{id,word:id}:manifest.words[id]?{id,word:id}:id==='obstrusion'?{id,word:id}:null,
  studyEligible:w=>w.id!=='obstrusion',toast:m=>toasts.push(m),$:()=>dialog,
  window:{addEventListener(){}},document:{querySelectorAll:q=>q==='.word'?[wordNode]:[button],
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
  assert.equal(frames.size,0,'No animation loops left running');
  console.log('PASS: 2,697 Edge TTS MP3s, exact embedded timing data, every asset checksum/frame, multiword highlighting, stop/replay/interruption, stale errors, unavailable words, and no speech-synthesis fallback.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

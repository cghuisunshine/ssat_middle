// Offline structural, scope, and publisher-key checks for the reading page.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'ssat_middle_reading.html'),'utf8');
const data=JSON.parse(html.match(/<script type="application\/json" id="reading-data">([\s\S]*?)<\/script>/)[1]);
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
assert.equal(data.passages.length,37);
assert.equal(data.passages.flatMap(p=>p.questions).length,182);
assert.equal(Object.keys(data.sources).length,5);
// Published keys transcribed from the included source key pages, in question order.
const expected={
 ivy:'ADCBCDDBAABDD BABDEC BACDBA EECBC CBABB ABBCE'.replace(/ /g,''),
 ninjas:'BBCAAAEACDEBDCAACDEAAEDCCDBDEABBCDBCEEDE',
 kaplan:'ADADBBACDCDDCACECCCAAACBAAECCADCB CDCDAEB'.replace(/ /g,''),
 gotestprep:'CDACBADCB CDADABBCBABBC'.replace(/ /g,''),
};
const ids=new Set();
for(const p of data.passages){
 assert.equal(p.level,'Middle',p.id);
 assert.ok(data.sources[p.sourceId]);
 assert.ok(!/mixed|upper|isee/i.test(p.sourceFile),p.id+' excluded source');
 if(p.sourceId==='kaplan')assert.ok(p.sourcePages.every(n=>n>=462&&n<=473),'Kaplan Middle Reading only');
 if(p.sourceId==='princeton')assert.ok(p.sourcePages.every(n=>n>=12&&n<=19),'Princeton Reading only');
 if(p.sourceId==='ninjas')assert.ok(p.sourcePages.every(n=>n>=15&&n<=32),'Test Ninjas Reading only');
 for(const q of p.questions){
  assert.ok(!ids.has(q.id),'Duplicate '+q.id);ids.add(q.id);
  assert.equal(q.options.length,p.sourceId==='gotestprep'?4:5);
  assert.ok(q.explanation.length>40);
  if(/\blines? \d/.test(q.prompt))assert.ok(p.sourceLines?.length,'Source line references must resolve');
 }
}
for(const id of Object.keys(expected)){
 const questions=data.passages.filter(p=>p.sourceId===id).flatMap(p=>p.questions).sort((a,b)=>a.number-b.number);
 const actual=questions.map(q=>'ABCDE'[q.answer]).join('');
 assert.equal(actual,expected[id],id+' published answer key');
}
for(const id of ['ivy','ninjas','kaplan','princeton'])assert.equal(data.passages.filter(p=>p.sourceId===id).flatMap(p=>p.questions).length,40);
assert.equal(data.sources.princeton.answerNote.includes('no publisher answer key'),true);
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//.test(script),'No runtime network/API calls');
assert.ok(!/<(?:script|link|img)[^>]+(?:src|href)=["']https?:/.test(html),'No external assets');
assert.ok(fs.readFileSync(path.join(root,'content.html'),'utf8').includes('ssat_middle_reading.html'),'Contents link');
console.log('PASS: 37 Middle Level passages, 182 unique questions, four complete timed sets, four publisher keys, source boundaries, usable line references, standalone offline page.');

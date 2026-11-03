const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'ssat_middle_writing.html'),'utf8');
const data=JSON.parse(html.match(/<script type="application\/json" id="writing-data">([\s\S]*?)<\/script>/)[1]);
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
assert.equal(data.level,'SSAT Middle Level');assert.equal(data.minutes,25);
assert.equal(data.prompts.length,20);assert.equal(new Set(data.prompts.map(p=>p.id)).size,20);
assert.equal(data.prompts.filter(p=>p.file).length,8);
assert.equal(data.prompts.filter(p=>p.source==='Original practice').length,12);
const sources={ivy_middle_full_test:3,princeton_middle_full_test:3,ssat_prep:451,test_ninjas_middle_full_test:6};
for(const p of data.prompts){assert.ok(['story','personal'].includes(p.type));assert.ok(p.text.length>15);if(p.file)assert.equal(p.page,sources[p.file.replace('.pdf','')]);}
assert.equal(data.timedSets.length,7);
for(const pair of data.timedSets){assert.equal(new Set(pair.promptIds).size,2);assert.deepEqual(pair.promptIds.map(id=>data.prompts.find(p=>p.id===id)?.type),['story','personal']);}
assert.equal(data.checklist.length,6);
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(script),'No runtime network calls');
assert.ok(!/<(?:script|img|link)[^>]+(?:src|href)=["']https?:/.test(html),'No external runtime assets');
assert.ok(fs.readFileSync(path.join(root,'content.html'),'utf8').includes('ssat_middle_writing.html'));
console.log('PASS: 20 Middle Level prompts, 8 verified source prompts, 12 labeled originals, 7 story/personal pairs, 25-minute format, six self-review criteria, offline assets, and contents link.');

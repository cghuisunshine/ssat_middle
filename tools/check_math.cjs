const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'ssat_middle_math.html'),'utf8');
const data=JSON.parse(html.match(/<script type="application\/json" id="math-data">([\s\S]*?)<\/script>/)[1]);
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(script);
assert.equal(data.level,'SSAT Middle Level');assert.equal(data.questions.length,150);assert.equal(new Set(data.questions.map(q=>q.id)).size,150);assert.equal(data.minutes,30);assert.equal(data.questionsPerSet,25);assert.equal(Object.keys(data.sets).length,6);
// Publisher keys independently read from the source key pages.
const keys={'ivy-1':'BADCDEBEEABCCEBCDDDECCCDD','ivy-4':'BCDCCCDAAACDDECAABCEADCBB','ninjas-1':'DCDDEECADEADBCACAEEBDBCEB','ninjas-2':'CEADAEDECCDDECAEBCDDBBBEA','kaplan-1':'BECCEDDAEDCBADAADDCBADBDD','kaplan-2':'CADBBBDDDCADDACCACDAEADCA'};
const pageRanges={'ivy-1':[5,12],'ivy-4':[35,42],'ninjas-1':[9,14],'ninjas-2':[40,45],'kaplan-1':[453,460],'kaplan-2':[482,489]};
for(const [id,s] of Object.entries(data.sets)){
 assert.equal(s.questionIds.length,25);assert.equal(new Set(s.questionIds).size,25);
 const qs=s.questionIds.map(qid=>data.questions.find(q=>q.id===qid));
 assert.deepEqual(qs.map(q=>q.number),Array.from({length:25},(_,i)=>i+1));
 assert.equal(qs.map(q=>'ABCDE'[q.answer]).join(''),keys[id],id+' publisher key');
 for(const q of qs){assert.equal(q.level,'Middle');assert.equal(q.options.length,5);assert.equal(new Set(q.options).size,5);assert.ok(q.steps.length>=2&&q.steps.every(step=>step.trim().length>0));assert.ok(q.tip.length>10);assert.ok(data.topics.includes(q.topic));assert.ok(q.sourcePages.every(n=>n>=pageRanges[id][0]&&n<=pageRanges[id][1]));}
}
const answer=id=>{const q=data.questions.find(q=>q.id===id);return q.options[q.answer];};
assert.equal(answer('ivy-s1-q20'),String((5+2/5)/(1/5)));
assert.equal(answer('ivy-s4-q22'),String(8*8-4*4/2-2*4*8/2));
assert.equal(answer('ninjas-s1-q01'),String(11*5*4));
assert.equal(answer('kaplan-s4-q24'),'11/36');
const repaired=data.questions.find(q=>q.id==='ninjas-s2-q06');assert.equal(repaired.options[0],'57');assert.ok(repaired.sourceNote.includes('27.50'));
assert.equal(data.questions.filter(q=>q.diagramSvg).length,35);
for(const q of data.questions.filter(q=>q.diagramSvg)){assert.ok(/viewBox=/.test(q.diagramSvg)&&/role="img"/.test(q.diagramSvg)&&/aria-label=/.test(q.diagramSvg));assert.ok(!/<(?:script|image|foreignObject)\b|\bon\w+=|(?:href|src)=/i.test(q.diagramSvg),q.id+' unsafe SVG');}
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(script));assert.ok(!/<(?:script|img|link)[^>]+(?:src|href)=["']https?:/.test(html));assert.ok(fs.readFileSync(path.join(root,'content.html'),'utf8').includes('ssat_middle_math.html'));
console.log('PASS: 150 Middle Level questions, six 25-question/30-minute sections, all publisher keys, independent numeric checks, 35 accessible safe SVGs, source boundaries, and offline page.');

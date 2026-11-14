const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync('ssat_middle_vocabulary.html','utf8');
const data=name=>JSON.parse(html.match(new RegExp('^const '+name+'=([\\s\\S]*?);\\n','m'))[1]);
const bank=data('PREBUILT_ARTICLES'),warnings=data('ONLINE_WORD_WARNINGS');
const expected=new Map(data('RAW_WORDS').split('\n').filter(l=>l&&!l.startsWith('@')).map(l=>{const a=l.split('|');return [a[0],a[2]]}).filter(([w])=>!Object.hasOwn(warnings,w)));
const files=fs.readdirSync('tools/prebuilt-articles').filter(f=>f.endsWith('.json')).sort();
assert.equal(bank.length,361);assert.equal(files.length,bank.length);
const coverage=new Set(),ids=new Set();
for(const article of bank){
 assert.ok(!ids.has(article.id));ids.add(article.id);
 const original=JSON.parse(fs.readFileSync(path.join('tools/prebuilt-articles',article.id+'.json'),'utf8'));
 assert.equal(original.source,'local-context-composition');assert.ok(!original.provider);
 for(const key of ['id','title','paragraphs','targets','createdAt'])assert.deepEqual(article[key],original[key]);
 assert.ok(article.targets.length>=1&&article.targets.length<=8);assert.equal(new Set(article.targets.map(t=>t.word)).size,article.targets.length);
 const text=article.paragraphs.join(' ');assert.ok(text.split(/\s+/).length>=150&&text.split(/\s+/).length<=650);
 for(const t of article.targets){assert.equal(t.index,0);assert.equal(t.definition,expected.get(t.word));const escaped=t.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');assert.ok(new RegExp('(?<![\\p{L}\\p{N}_])'+escaped+'(?![\\p{L}\\p{N}_])','iu').test(text),t.word+' missing');coverage.add(t.word);}
}
assert.deepEqual([...coverage].sort(),[...expected.keys()].sort());
console.log('PASS: 361 locally composed, embedded articles; 2,697-word coverage; at most eight focus words; exact meanings/text; no remote-generated source files.');

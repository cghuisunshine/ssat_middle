// Profile isolation, migration, and sync conflicts without network access.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'student-store.js'),'utf8');
const data=new Map();
let failKey=null;
const localStorage={getItem:k=>data.get(k)??null,setItem(k,v){if(k===failKey)throw Error('Quota exceeded');data.set(k,String(v));},removeItem:k=>data.delete(k)};
function page(extra={}){const window={localStorage,dispatchEvent(){},Event:class{},...extra};vm.runInNewContext(source,{window,console});return window.SSATUsers;}
let store=page();
const subjects=Array.from(store.SUBJECTS);
for(const [i,key] of subjects.entries())data.set(key,JSON.stringify({legacy:i}));
assert.equal(store.storage.getItem(subjects[0]),null,'No progress exposed before sign in');
assert.throws(()=>store.storage.setItem(subjects[0],'anonymous'),'Anonymous startup cannot overwrite progress');
store.login('  Peggy   Chen  ');store=page();
assert.equal(store.student,'Peggy Chen');
for(const [i,key] of subjects.entries()){
 assert.equal(store.storage.getItem(key),JSON.stringify({legacy:i}),'Each subject migrates');
 assert.equal(data.get(key),JSON.stringify({legacy:i}),'Legacy recovery copy retained');
}
store.storage.setItem(subjects[0],'peggy-vocabulary');
const peggysTab=store;
store.login('Sam');store=page();
assert.equal(store.storage.getItem(subjects[0]),null,'New student starts empty');
store.storage.setItem(subjects[0],'sam-vocabulary');
peggysTab.storage.setItem(subjects[1],'peggy-reading');
assert.equal(store.storage.getItem(subjects[1]),null,'Other tab cannot write into current student');
store.login('pEGGy  cHEN');store=page();
assert.equal(store.student,'Peggy Chen','Case-insensitive sign in retains original spelling');
assert.equal(store.known().length,2);
assert.equal(store.storage.getItem(subjects[0]),'peggy-vocabulary');
assert.equal(store.storage.getItem(subjects[1]),'peggy-reading');
store.forget('PEGGY CHEN');assert.equal(store.known().length,1);
assert.equal(store.storage.getItem(subjects[0]),'peggy-vocabulary','Removing shortcut keeps progress');
store.logout();assert.equal(page().student,'');
store.login('Peggy Chen');store=page();assert.equal(store.storage.getItem(subjects[0]),'peggy-vocabulary','Sign out keeps progress');
assert.throws(()=>store.login('   '));assert.throws(()=>store.login('a'.repeat(41)));assert.throws(()=>store.login('a\x00b'));

// Migration failures retain originals and can be retried.
data.clear();for(const key of subjects)data.set(key,'{"version":1}');
failKey=page().keyFor('Retry',subjects[1]);
assert.throws(()=>page().login('Retry'));
assert.equal(data.has('ssatMiddleLegacyOwner'),false);
assert.equal(data.has('ssatMiddleStudent'),false);
assert.equal(data.get(subjects[0]),'{"version":1}');
failKey=null;page().login('Retry');store=page();
assert.equal(store.storage.getItem(subjects[3]),'{"version":1}');
// Three-way sync preserves independent subjects and reports divergent edits.
const key=subjects[0],key2=subjects[3];
const vocabulary=n=>JSON.stringify({version:1,records:{n},custom:[],settings:{}});
const math=n=>JSON.stringify({version:1,kind:'ssat-middle-math',records:{n}});
let merged=store.mergeSubjects({[key]:vocabulary(1)},{[key]:vocabulary(2)},{[key]:vocabulary(1)});
assert.equal(merged.merged[key],vocabulary(2),'Remote-only change accepted');
merged=store.mergeSubjects({[key]:vocabulary(2)},{[key]:vocabulary(1)},{[key]:vocabulary(1)});
assert.equal(merged.merged[key],vocabulary(2),'Local-only change accepted');
merged=store.mergeSubjects({[key]:vocabulary(2)},{[key2]:math(3)},{});
assert.equal(merged.conflicts.length,0,'Changes in separate subjects merge');
assert.equal(merged.merged[key],vocabulary(2));assert.equal(merged.merged[key2],math(3));
const a={[key]:vocabulary(2)},b={[key]:vocabulary(3)},base={[key]:vocabulary(1)};
assert.equal(store.mergeSubjects(a,b,base).conflicts.length,1,'Both changed: never silently overwrite');
assert.equal(store.mergeSubjects(a,b,base,'device').merged[key],a[key]);
assert.equal(store.mergeSubjects(a,b,base,'cloud').merged[key],b[key]);
assert.throws(()=>store.mergeSubjects(a,{[key]:'garbage'},base));
// Every delivered HTML embeds identical assets, before the studio reads storage.
for(const filename of ['content.html','ssat_middle_vocabulary.html','ssat_middle_reading.html','ssat_middle_writing.html','ssat_middle_math.html']){
 const html=fs.readFileSync(path.join(__dirname,'..',filename),'utf8');
 assert.equal((html.match(/id="student-profile-script"/g)||[]).length,1);
 assert.ok(html.includes(source),filename+' contains current shared profile code');
 if(filename!=='content.html'){
  assert.ok(html.indexOf('id="student-profile-script"')<html.indexOf('const progressStorage='));
  assert.ok(!/localStorage\.(?:getItem|setItem)\(KEY/.test(html));
 }
}
console.log('PASS: four-subject isolation, case-insensitive profiles, sign-out/recent removal preservation, safe legacy migration and retry, cross-tab identity, three-way sync/conflicts, and embedded offline assets.');

(async()=>{
 data.clear();page().login('Cloud Tester');
 let cloud=null,afterWrite=null,writes=0;
 const database={collection(name){assert.equal(name,'ssatMiddleStudents');return {doc(id){assert.equal(id,'cloud%20tester');return {};}};},async runTransaction(fn){
  const result=await fn({get:async()=>({exists:!!cloud,data:()=>cloud}),set(_ref,value){cloud=structuredClone(value);writes++;}});
  if(afterWrite){const callback=afterWrite;afterWrite=null;callback();}return result;
 }};
 const firebase={initializeApp:()=>({firestore:()=>database}),firestore(){}};
 const client=page({firebase});
 client.storage.setItem(key,vocabulary(1));
 let result=await client.sync('test-key');
 assert.equal(result.conflicts.length,0);assert.equal(cloud.subjects[key],vocabulary(1),'Initial upload');
 cloud.subjects[key2]=math(2);
 result=await client.sync('test-key');assert.equal(result.changed,true);assert.equal(client.storage.getItem(key2),math(2),'Download remote subject');
 client.storage.setItem(key,vocabulary(3));cloud.subjects[key]=vocabulary(4);
 const previousWrites=writes;result=await client.sync('test-key');
 assert.equal(result.conflicts.length,1);assert.equal(writes,previousWrites,'Conflict makes no cloud writes');
 assert.equal(client.storage.getItem(key),vocabulary(3),'Conflict keeps local data');
 await client.sync('test-key','device');assert.equal(cloud.subjects[key],vocabulary(3),'Explicit resolution uploads chosen version');
 // A local edit made in flight must survive the response from the server.
 cloud.subjects[key]=vocabulary(5);afterWrite=()=>client.storage.setItem(key,vocabulary(6));
 result=await client.sync('test-key');assert.equal(result.pending,true);assert.equal(client.storage.getItem(key),vocabulary(6));
 await client.sync('test-key');assert.equal(cloud.subjects[key],vocabulary(6),'In-flight edits upload on next sync');
 // A missing cloud document is treated as a new upload, never a reset command.
 cloud=null;await client.sync('test-key');assert.equal(cloud.subjects[key],vocabulary(6),'Deleted cloud document does not erase local work');
 const denied=page({firebase:{initializeApp:()=>({firestore:()=>({...database,runTransaction:async()=>{throw Object.assign(Error('Denied'),{code:'permission-denied'});}})}),firestore(){}}});
 await assert.rejects(()=>denied.sync('denied-key'));assert.equal(denied.storage.getItem(key),vocabulary(6),'Permission error preserves local progress');
 const restricted={dispatchEvent(){},Event:class{}};Object.defineProperty(restricted,'localStorage',{get(){throw Error('Disabled');}});
 vm.runInNewContext(source,{window:restricted});assert.throws(()=>restricted.SSATUsers.login('Student'));
 console.log('PASS: Firebase transaction adapter: upload/download, independent subjects, conflicts without writes, explicit resolution, edits during sync, missing cloud documents, permission errors, and blocked storage.');
})().catch(error=>{console.error(error);process.exitCode=1;});

const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('ssat_middle_vocabulary.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
let clock=Date.parse('2026-11-14T12:00:00Z');
class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
const key='wordwise-ssat-middle-v1';const legacy={version:1,records:{partial:{seen:9,correct:8,wrong:1,level:3,due:clock+3600000,last:clock-86400000,star:true}},custom:[],history:[],days:{},settings:{chinese:true,goal:20}};
function context(storage=new Map([[key,JSON.stringify(legacy)]]),blocked=false){const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',hidden:false,value:'',addEventListener(){},showModal(){},close(){},classList:{toggle(){}}});return nodes.get(id);};const c=vm.createContext({assert,console,Date:Clock,window:{scrollTo(){},addEventListener(){}},document:{getElementById:node,querySelector:()=>node('query'),addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(blocked)throw Error('quota');storage.set(k,v)}},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},confirm:()=>true});vm.runInContext(script,c,{timeout:10000});return c;}
(async()=>{const storage=new Map([[key,JSON.stringify(legacy)]]),c=context(storage);await c.SRS_READY;
vm.runInContext(`
 const migrated=srsId('partial',0,'recognition');
 assert.equal(state.cards[migrated].eligibleAt,Date.now()+3600000);
 assert.equal(state.reviewLog.length,0);assert.equal(rec('partial').seen,9);assert.ok(rec('partial').star);
 assert.ok(!state.cards[srsId('partial',1,'recognition')]);assert.ok(!state.cards[srsId('partial',0,'spelling')]);
 const copy=sanitizeState(JSON.parse(JSON.stringify(state)));assert.equal(JSON.stringify(copy.cards),JSON.stringify(state.cards));
 for(const grade of [1,2,3,4]) {
   const id=srsId('candid',0,'recognition'),baseline=JSON.parse(JSON.stringify(state.cards)),logs=state.reviewLog.length;
   state.srsSession={queue:[id],total:1,completed:0};revealed=true;
   const expected=srsScheduler.review({card:srsCard(srsDescriptor(id),new Date()),grade,now:new Date()});
   rateSrs(grade);assert.equal(JSON.stringify(state.cards[id]),JSON.stringify(expected.card));
   state.cards=baseline;state.reviewLog.length=logs;
 }
 const id=srsId('able',0,'recognition');state.srsSession={queue:[id],total:1,completed:0};revealed=true;
 const expected=srsScheduler.review({card:srsCard(srsDescriptor(id),new Date()),grade:1,now:new Date()});
 rateSrs(1);assert.equal(JSON.stringify(state.cards[id]),JSON.stringify(expected.card));assert.equal(state.reviewLog.length,1);
 rateSrs(1);assert.equal(state.reviewLog.length,1,'Duplicate rating ignored');assert.ok(!srsCurrent());
 assert.ok(state.srsSession.queue.includes(id));assert.ok(studyCard().includes('srsWait'));
 const before=JSON.stringify(state.cards);recordWord('able','correct');assert.equal(JSON.stringify(state.cards),before,'Quizzes cannot schedule');
 const saved=sanitizeState(JSON.parse(JSON.stringify(state)));assert.equal(saved.srsSession.queue[0],id);assert.equal(saved.cards[id].dueAt,state.cards[id].dueAt);
 state.settings.studyMode='mixed';state.cards={};newDeck();assert.equal(state.srsSession.queue.length,20);assert.equal(new Set(state.srsSession.queue.map(id=>srsDescriptor(id).word)).size,20);
 const spelling=srsId('partial',1,'spelling');state.srsSession={queue:[spelling],total:1,completed:0};revealed=false;
 assert.ok(!studyCard().includes('class="word"'));assert.ok(!studyCard().includes('read-example'));assert.ok(!studyCard().includes('data-action="speak"'));
 $('srsSpelling').value='wrong';srsCheckSpelling();assert.ok(state.cards[spelling]);assert.ok(!state.cards[srsId('partial',0,'spelling')]);assert.ok(!state.cards[srsId('partial',1,'recognition')]);
`,c);
clock+=600001;vm.runInContext(`assert.ok(srsCurrent(),'Forgotten card becomes eligible in same session');$('srsSpelling').value='partial';srsCheckSpelling();rateSrs(3);assert.equal(state.reviewLog.length,3);`,c);
assert.ok(storage.has(key+'-pre-fsrs'));const reloaded=context(storage);await reloaded.SRS_READY;assert.equal(vm.runInContext('state.reviewLog.length',reloaded),3);
const failed=context(new Map([[key,JSON.stringify(legacy)]]),true);await failed.SRS_READY;assert.equal(vm.runInContext("rec('partial').seen",failed),9);assert.equal(vm.runInContext('srsRecoveryBlocked',failed),true);
console.log('PASS: FSRS reference parity, legacy recovery and idempotence, separate skills/senses, queue deadlines and reloads, duplicate ratings, spelling answer hiding, quiz independence, mixed-mode sibling limits, and blocked storage.');
})().catch(e=>{console.error(e);process.exitCode=1});

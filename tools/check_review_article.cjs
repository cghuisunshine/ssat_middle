const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const sample=Array.from({length:36},()=> 'The able team made careful progress.').join(' ');
const targets=[{word:'able',index:0,definition:'capable'}];
const descriptor={word:'able',index:0,sense:{def:'capable'}};
const article={title:'A team discovery',paragraphs:[sample]};
const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',open:false,showModal(){this.open=true},close(){this.open=false}});return nodes.get(id)};
let calls=[],pending=null,reply={response:JSON.stringify(article)},status=200,saved=0;
const timers=new Map();let next=0;
const context=vm.createContext({console,AbortController,Date,Map,Set,JSON,Error,TypeError,
 state:{reviewLog:[],srsSession:{queue:['able']},cards:{},days:{}},
 dayKey:d=>(d||new Date()).toISOString().slice(0,10),srsDescriptor:id=>id==='able'||id==='able#0'?descriptor:null,srsId:()=> 'able#0',
 wordPattern:w=>new RegExp('\\b'+w+'\\b','gi'),esc:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 $:node,save:()=>saved++,toast(){},document:{addEventListener(){},querySelector:()=>null},window:{addEventListener(){}},
 setTimeout:fn=>{timers.set(++next,fn);return next},clearTimeout:id=>timers.delete(id),
 fetch:async(url,options)=>{calls.push({url,options});if(pending)return new Promise((resolve,reject)=>{pending.resolve=resolve;options.signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'})));});return {ok:status===200,status,json:async()=>reply};},
});
vm.runInContext(fs.readFileSync('tools/vocabulary-article.js','utf8'),context);
(async()=>{
 assert.equal(calls.length,0,'No automatic request');
 assert.equal(vm.runInContext('articleTargets().length',context),1);
 context.targets=targets;context.article=article;
 assert.equal(vm.runInContext('parseArticleResponse({response:JSON.stringify(article)},targets).title',context),article.title);
 assert.throws(()=>vm.runInContext('parseArticleResponse({response:"not json"},targets)',context),/unreadable/);
 assert.throws(()=>vm.runInContext('parseArticleResponse({ok:false},targets)',context),/service/);
 assert.throws(()=>vm.runInContext('parseArticleResponse(article,[{word:"candid",index:0,definition:"honest"}])',context),/omitted/);
 assert.throws(()=>vm.runInContext('parseArticleResponse({title:"short",paragraphs:["able"]},targets)',context),/length/);
 await vm.runInContext('generateReviewArticle()',context);
 assert.equal(calls[0].url,'https://lakesideart.gochatus.org/grade-service/general');
 assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.method,'POST');
 const body=JSON.parse(calls[0].options.body);assert.deepEqual(Object.keys(body),['message']);assert.ok(body.message.includes('capable'));assert.ok(!body.message.includes('reviewLog'));
 assert.equal(saved,1);assert.equal(vm.runInContext('state.reviewArticle.title',context),article.title);
 assert.equal(vm.runInContext('state.reviewLog.length',context),0);
 status=500;await vm.runInContext('generateReviewArticle()',context);assert.equal(saved,1,'Failure keeps old article');
 status=200;pending={};const job=vm.runInContext('generateReviewArticle()',context);await vm.runInContext('generateReviewArticle()',context);assert.equal(calls.length,3,'Double click creates one request');
 vm.runInContext('cancelArticle()',context);await job;assert.equal(saved,1);assert.equal(vm.runInContext('articleRequest',context),null);
 pending={};const stale=vm.runInContext('generateReviewArticle()',context);vm.runInContext('state={reviewLog:[],cards:{}}',context);pending.resolve({ok:true,status:200,json:async()=>reply});await stale;assert.equal(saved,1,'Stale response cannot overwrite imported/reset state');
 assert.equal(timers.size,0);
 console.log('PASS: exact AMC endpoint/request contract, explicit requests only, review/session word selection, safe parsing, length/word coverage, failures, cancellation, duplicate/stale responses, and unchanged FSRS progress.');
})().catch(e=>{console.error(e);process.exitCode=1});

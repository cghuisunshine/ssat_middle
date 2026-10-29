// Exercise asynchronous AI feedback without contacting the service.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'ssat_middle_vocabulary.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness({ignoreAbort = false, online = true} = {}) {
  const requests = [], timers = new Map(), nodes = new Map();
  let serial = 0;
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {innerHTML: '', textContent: '', hidden: false, addEventListener() {}, showModal() {}, close() {}});
    return nodes.get(id);
  }
  const context = vm.createContext({
    console, AbortController, navigator: {onLine: online},
    document: {getElementById: node, querySelector: () => node('query'), addEventListener() {}},
    window: {addEventListener() {}, scrollTo() {}},
    localStorage: {getItem: () => null, setItem() {}},
    setTimeout: (fn, delay) => {const id = ++serial; timers.set(id, {fn, delay}); return id;},
    clearTimeout: id => timers.delete(id), setInterval: () => 0, clearInterval() {}, confirm: () => true,
    fetch: (url, options) => new Promise((resolve, reject) => {
      const request = {url, options, resolve, reject}; requests.push(request);
      if (!ignoreAbort) options.signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), {name: 'AbortError'})));
    }),
  });
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  function setup() {
    run(`
      view = 'practice';
      const first = wordQuestion(wordById('candid'), 'synonyms');
      first.options = ['frank', 'timid', 'noisy', 'brittle', 'swift'];
      session = {mode:'synonyms',qs:[first, wordQuestion(wordById('prudent'),'synonyms')],index:0,
        answers:['timid',null],checked:[false,false],flags:[false,false],finished:false,deadline:0};
      render();
    `);
  }
  const respond = (index, body, status = 200) => requests[index].resolve({ok: status >= 200 && status < 300, status, json: async () => body});
  const status = () => run('session.qs[session.index].aiExplanations?.[aiExplanationKey(session,session.index)]?.status');
  return {run, setup, requests, timers, nodes, respond, status};
}

async function main() {
  const h = harness(); h.setup();
  h.run('checkAnswer()');
  assert.equal(h.requests.length, 1, 'Check answer automatically requests an explanation');
  assert.equal(h.status(), 'loading');
  assert.ok(h.nodes.get('app').innerHTML.includes('Not quite.'));
  assert.ok(h.nodes.get('app').innerHTML.includes('Preparing a further explanation'));
  assert.equal(h.run("rec('candid').seen"), 1, 'Answer is recorded before the request finishes');
  const request = h.requests[0];
  assert.equal(request.url, 'https://lakesideart.gochatus.org/grade-service/general');
  assert.equal(request.options.credentials, 'omit');
  assert.equal(request.options.mode, 'cors');
  const payload = JSON.parse(request.options.body);
  assert.deepEqual(Object.keys(payload), ['message']);
  const question = JSON.parse(payload.message.split('QUESTION_DATA:\n')[1]);
  assert.equal(question.learner_answer, 'timid');
  assert.equal(question.practice_answer, 'frank');
  assert.equal(question.reference_explanation, h.run('session.qs[0].explanation'));
  h.run('checkAnswer(); void requestAIExplanation();');
  assert.equal(h.requests.length, 1, 'Repeated actions cannot duplicate the active request');
  h.respond(0, {response: '```json\n' + JSON.stringify({
    explanation: '<img src=x onerror=alert(1)> Candid means honest and direct.',
    choice_notes: [{choice:'timid',explanation:'Shy or fearful, rather than honest.'}, {choice:'invented option',explanation:'Do not show this.'}],
    example:'Give a candid opinion.', memory_tip:'Think honest and direct.', chinese:'candid 表示坦率。',
  }) + '\n```'});
  await flush();
  assert.equal(h.status(), 'done');
  const output = h.nodes.get('app').innerHTML;
  assert.ok(output.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!output.includes('<img src=x'));
  assert.ok(!output.includes('invented option'));
  assert.ok(output.includes('坦率'));
  assert.equal(h.run("rec('candid').seen"), 1, 'AI must not change the recorded grade');
  h.run('void requestAIExplanation()');
  assert.equal(h.requests.length, 1, 'Finished explanations are reused');
  h.run('state.settings.chinese=false; render(); void requestAIExplanation();');
  assert.equal(h.requests.length, 2, 'English-only support has a separate response');
  assert.ok(JSON.parse(h.requests[1].options.body).message.includes('Use English only'));
  h.respond(1, {response:'A plain-text explanation is also supported.'}); await flush();
  assert.ok(h.nodes.get('app').innerHTML.includes('A plain-text explanation'));
  assert.ok(!h.nodes.get('app').innerHTML.includes('lang="zh"'));

  const fail = harness(); fail.setup(); fail.run('checkAnswer()');
  fail.respond(0, {error:'service busy'}, 429); await flush();
  assert.equal(fail.status(), 'error');
  assert.ok(fail.nodes.get('app').innerHTML.includes('Retry AI explanation'));
  assert.ok(fail.nodes.get('app').innerHTML.includes('Not quite.'));
  fail.run('void requestAIExplanation()');
  assert.equal(fail.requests.length, 2);
  fail.respond(1, {response:{explanation:'Try linking candid with honest speech.'}}); await flush();
  assert.equal(fail.status(), 'done');
  assert.equal(fail.run("rec('candid').seen"), 1);

  const timeout = harness(); timeout.setup(); timeout.run('checkAnswer()');
  const timer = [...timeout.timers.values()].find(t => t.delay === 60000);
  assert.ok(timer); timer.fn(); await flush();
  assert.equal(timeout.status(), 'error');
  assert.ok(timeout.nodes.get('app').innerHTML.includes('took too long'));
  assert.equal(timeout.run('activeAIRequests.size'), 0);

  const stale = harness({ignoreAbort:true}); stale.setup(); stale.run('checkAnswer()');
  stale.run('session.index=1; render();');
  assert.equal(stale.requests[0].options.signal.aborted, true, 'Moving on cancels the request');
  stale.respond(0, {response:{explanation:'OLD QUESTION RESPONSE'}}); await flush();
  assert.ok(!stale.nodes.get('app').innerHTML.includes('OLD QUESTION RESPONSE'));
  assert.equal(stale.run('session.qs[0].aiExplanations[aiExplanationKey(session,0)].status'), 'idle');

  const leave = harness({ignoreAbort:true}); leave.setup(); leave.run('checkAnswer()');
  leave.run("navigate('library')");
  assert.equal(leave.requests[0].options.signal.aborted, true);
  leave.respond(0, {response:{explanation:'RESPONSE AFTER LEAVING'}}); await flush();
  assert.ok(!leave.nodes.get('app').innerHTML.includes('RESPONSE AFTER LEAVING'));

  const skip = harness(); skip.setup(); skip.run('session.answers[0]=null; checkAnswer(true)');
  assert.equal(skip.requests.length, 0, 'Skipping does not automatically call AI');
  assert.ok(skip.nodes.get('app').innerHTML.includes('Explain with AI'));
  skip.run('void requestAIExplanation()');
  assert.equal(skip.requests.length, 1, 'Skipped answers can explicitly request help');
  skip.respond(0, {response:''}); await flush();
  assert.equal(skip.status(), 'error', 'Empty responses allow a retry');

  const offline = harness({online:false}); offline.setup(); offline.run('checkAnswer()'); await flush();
  assert.equal(offline.requests.length, 0);
  assert.equal(offline.status(), 'error');
  assert.ok(offline.nodes.get('app').innerHTML.includes('You are offline'));

  const timed = harness(); timed.setup(); timed.run('session.deadline=Date.now()+10000; checkAnswer(); void requestAIExplanation();');
  assert.equal(timed.requests.length, 0, 'Timed questions cannot reveal answers before submission');
  assert.equal(timed.run('session.checked[0]'), false);

  const sense = harness();
  const prompt = sense.run("aiExplanationPrompt(wordQuestion(wordById('partial'),'context',wordSenses(wordById('partial'))[1]), 'impartial', false)");
  assert.ok(prompt.includes('favoring one side unfairly'), 'Use the selected sense, not a different dictionary meaning');
  assert.ok(sense.run("parseAIExplanation({response:{feedback:'Alternative feedback format.'}}).explanation") === 'Alternative feedback format.');
  assert.throws(() => sense.run("parseAIExplanation({ok:false})"));
  console.log('PASS: automatic AI feedback, text-only endpoint contract, cached results, bilingual support, escaped output, retries, timeouts, offline fallback, cancellation, selected word senses, and grade preservation.');
}
main().catch(error => {console.error(error); process.exitCode=1;});

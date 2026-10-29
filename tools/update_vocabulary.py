#!/usr/bin/env python3
"""Rebuild the vocabulary expansion inside the standalone, offline HTML page."""
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = Path(__file__).resolve().parent
PAGE = ROOT / 'ssat_middle_vocabulary.html'
html = PAGE.read_text()


def constant(name, value=None):
    global html
    match = re.search(r'^const ' + name + r'=', html, re.M)
    if match:
        old, end = json.JSONDecoder().raw_decode(html[match.end():])
        if value is None:
            return old
        html = html[:match.end()] + json.dumps(value, ensure_ascii=False, indent=2) + html[match.end() + end:]
    elif value is not None:
        html = html.replace('const WORDS=[];', 'const ' + name + '=' + json.dumps(value, ensure_ascii=False, indent=2) + ';\nconst WORDS=[];', 1)
    else:
        raise ValueError('Missing constant: ' + name)


def replace(old, new):
    global html
    if new in html:
        return
    if html.count(old) != 1:
        raise ValueError(f'Expected one UI target, found {html.count(old)}: {old[:100]}')
    html = html.replace(old, new, 1)


raw = constant('RAW_WORDS')
examples = constant('EXAMPLES')
additions = []
tier = topic = ''
for line in (TOOLS / 'vocabulary-additions.txt').read_text().splitlines():
    if not line:
        continue
    if line.startswith('@'):
        tier, topic = line[1:].split('|')
        continue
    fields = line.split('|')
    assert len(fields) == 6, line
    word, pos, definition, zh, synonym, example = fields
    assert tier in ['Foundation', 'Core', 'Stretch'] and topic
    additions.append((word, pos, definition, zh, synonym, tier, topic))
    examples[word] = example
assert len({w[0] for w in additions}) == len(additions)
updates = {w[0]: w for w in additions}
primary_updates = {
    'lofty': 'lofty|adj|noble or ambitious in purpose|崇高的|exalted',
    'obscure': 'obscure|adj|not widely known|鲜为人知的|little-known',
    'cultivate': 'cultivate|v|to prepare and work land for growing crops|耕作|farm',
}
lines, seen = [], set()
current_tier = current_topic = ''
for line in raw.splitlines():
    if line.startswith('@'):
        current_tier, current_topic = line[1:].split('|')
    elif line:
        word = line.split('|')[0]
        assert word not in seen, 'Duplicate: ' + word
        seen.add(word)
        if word in updates:
            item = updates[word]
            assert (current_tier, current_topic) == item[5:7], 'Tier/topic changed: ' + word
            line = '|'.join(item[:5])
        elif word in primary_updates:
            line = primary_updates[word]
    lines.append(line)
for word, pos, definition, zh, synonym, tier, topic in additions:
    if word not in seen:
        if (current_tier, current_topic) != (tier, topic):
            lines.append('@' + tier + '|' + topic)
            current_tier, current_topic = tier, topic
        lines.append('|'.join([word, pos, definition, zh, synonym]))
        seen.add(word)
constant('RAW_WORDS', '\n'.join(lines))

for line in (TOOLS / 'context-examples.txt').read_text().splitlines():
    if line:
        word, example = line.split('|', 1)
        examples[word] = example
assert set(examples) == seen, ('Example coverage mismatch', seen - set(examples), set(examples) - seen)
for word, example in examples.items():
    assert len(re.findall(r'\b' + re.escape(word) + r'\b', example, re.I)) == 1, ('Example needs one exact target', word)
constant('EXAMPLES', dict(sorted(examples.items())))

senses = {}
for line in (TOOLS / 'secondary-meanings.txt').read_text().splitlines():
    if not line:
        continue
    word, pos, definition, zh, synonym, example = line.split('|')
    assert word in seen, word
    assert len(re.findall(r'\b' + re.escape(word) + r'\b', example, re.I)) == 1, word
    senses.setdefault(word, []).append(dict(pos=pos, def_=definition, zh=zh, syn=synonym, example=example))
senses = {word: [{('def' if k == 'def_' else k): v for k, v in sense.items()} for sense in items] for word, items in senses.items()}
constant('SECONDARY_MEANINGS', senses)
families = json.loads((TOOLS / 'word-families.json').read_text())
assert all(len(f) >= 2 and set(f) <= seen for f in families)
constant('WORD_FAMILIES', families)

# Exclude close alternatives from distractors; learning families alone do not
# cover all semantic neighbors introduced by the new entries and meanings.
constant('EXTRA_SYNONYM_FAMILIES', [
    ['courteous', 'polite', 'gracious', 'cordial', 'courtesy', 'politeness'],
    ['tact', 'tactful', 'discreet', 'diplomacy', 'diplomatic', 'discretion'],
    ['industrious', 'diligent', 'hardworking', 'toil', 'labor', 'laborious', 'strenuous', 'arduous', 'demanding'],
    ['resolute', 'steadfast', 'tenacious', 'determined', 'determination', 'resolve', 'unwavering', 'loyal', 'loyalty', 'faithfulness', 'fidelity', 'faithful', 'devoted', 'allegiance'],
    ['apathetic', 'apathy', 'indifferent', 'indifference', 'unconcerned', 'nonchalant', 'casual'],
    ['tired', 'fatigue', 'exhaustion', 'weary', 'exhausted', 'feeble', 'weak', 'faint'],
    ['robust', 'strong', 'healthy', 'sturdy', 'resilient', 'resilience', 'vigorous'],
    ['plight', 'predicament', 'dilemma', 'trouble', 'adversity', 'hardship'],
    ['exasperate', 'irritate', 'aggravate', 'annoy', 'pester', 'bother repeatedly', 'infuriate', 'enrage', 'provoke'],
    ['mock', 'ridicule', 'jeer', 'taunt', 'scoff', 'sneer', 'belittle', 'disparage', 'sarcastic', 'mocking', 'satirical'],
    ['disdain', 'contempt', 'scorn', 'condescend', 'patronize', 'snub', 'slight'],
    ['fiasco', 'debacle', 'disaster', 'catastrophe', 'calamity', 'gaffe', 'blunder', 'glitch', 'malfunction'],
    ['initiate', 'start', 'commence', 'begin', 'instigate', 'establish'],
    ['cooperate', 'collaborate', 'cooperation', 'collaboration', 'teamwork', 'joint effort'],
    ['modify', 'modification', 'alter', 'alteration', 'adapt', 'change'],
    ['emulate', 'imitate', 'mimic', 'copy'],
    ['admonish', 'reprove', 'reprimand', 'rebuke', 'scold'],
    ['courageous', 'valiant', 'brave', 'bold', 'audacious', 'daring'],
    ['passive', 'subdued', 'submissive', 'unresisting', 'restrained', 'reserved', 'reticent', 'meek', 'docile'],
    ['vivacious', 'animated', 'lively', 'spirited', 'boisterous', 'rowdy', 'gregarious', 'extrovert', 'outgoing person', 'zestful', 'energetic'],
    ['malicious', 'spiteful', 'wicked', 'evil', 'cruel', 'malice', 'ill will', 'animosity', 'hostility', 'antagonism', 'resentment', 'bitterness'],
    ['genial', 'congenial', 'agreeable', 'amiable', 'affable', 'charismatic', 'magnetic', 'engaging', 'captivating', 'friendly'],
    ['practical', 'pragmatic', 'useful', 'workable', 'feasible', 'practicality', 'usefulness', 'utilize', 'use'],
    ['blend', 'combine', 'mix', 'assimilate', 'absorb'],
    ['dearth', 'shortage', 'scarcity', 'scarce', 'deficiency', 'lack'],
    ['laud', 'praise', 'commend', 'exalt', 'glorify', 'acclaim'],
    ['raze', 'demolish', 'destroy', 'eradicate', 'efface', 'obliterate'],
    ['enigma', 'mystery', 'puzzle', 'anomaly', 'peculiarity', 'idiosyncrasy'],
    ['skeptic', 'doubter', 'skeptical', 'dubious'],
    ['query', 'question', 'inquire', 'ask'],
    ['bypass', 'circumvent', 'evade', 'avoid', 'shun'],
    ['capitulate', 'surrender', 'submit', 'yield'],
    ['claim', 'conjecture', 'supposition', 'hypothesis', 'assumption', 'speculate'],
    ['erratic', 'unpredictable', 'sporadic', 'intermittent', 'occasional', 'uncertain', 'tentative', 'provisional'],
    ['reserved', 'introvert', 'reserved person', 'shy', 'reticent', 'aloof'],
    ['impeccable', 'flawless', 'perfect'],
    ['loquacious', 'talkative', 'verbose', 'wordy'],
    ['medley', 'mixture', 'assortment', 'diverse'],
    ['serene', 'tranquil', 'placid', 'calm', 'peaceful', 'serenity'],
    ['livid', 'furious', 'enraged', 'angry', 'hysterical', 'frantic'],
    ['tolerance', 'tolerant', 'acceptance', 'accepting', 'tolerate'],
    ['goal', 'aim', 'objective', 'purpose', 'intention', 'motive'],
    ['trait', 'attribute', 'feature', 'characteristic'],
    ['settle', 'resolve', 'solve', 'reconcile'],
    ['protected', 'secure', 'safe'],
    ['elaborate', 'intricate', 'complex'],
    ['hoax', 'deception', 'deceitful', 'dishonest'],
    ['vulnerable', 'vulnerability', 'susceptible', 'fragile'],
    ['painstaking', 'meticulous', 'scrupulous', 'careful', 'methodical'],
    ['hoard', 'greedy', 'avaricious'],
])
if 'const RELATION_CACHE = new Map();' not in html:
    html = html.replace('const WORDS=[];', 'const RELATION_CACHE = new Map();\nconst WORDS=[];', 1)

analogies = constant('RAW_ANALOGIES').splitlines()
extra = [line for line in (TOOLS / 'extra-analogies.txt').read_text().splitlines() if line]
existing_stems = {line.split('|')[1] for line in analogies}
for line in extra:
    fields = line.split('|')
    assert len(fields) == 8 and len(set(fields[2:7])) == 5, line
    if fields[1] not in existing_stems:
        analogies.append(line)
        existing_stems.add(fields[1])
assert min(Counter(line.split('|')[0] for line in analogies).values()) >= 5
constant('RAW_ANALOGIES', '\n'.join(analogies))

ai_block = '// BEGIN vocabulary-ai\n' + (TOOLS / 'vocabulary-ai.js').read_text().strip() + '\n// END vocabulary-ai'
if '// BEGIN vocabulary-ai\n' in html:
    html = re.sub(r'^// BEGIN vocabulary-ai\n.*?^// END vocabulary-ai', lambda _: ai_block, html, count=1, flags=re.M | re.S)
else:
    html = html.replace('const WORDS=[];', ai_block + '\nconst WORDS=[];', 1)

parts = re.split(r'^// @function (\w+)\n', (TOOLS / 'vocabulary-ui.js').read_text(), flags=re.M)
for name, body in zip(parts[1::2], parts[2::2]):
    block = '// BEGIN vocabulary:' + name + '\n' + body.strip() + '\n// END vocabulary:' + name
    marker = r'^// BEGIN vocabulary:' + name + r'\n.*?^// END vocabulary:' + name
    if re.search(marker, html, re.M | re.S):
        html = re.sub(marker, lambda _: block, html, count=1, flags=re.M | re.S)
    elif re.search(r'^function ' + name + r'\(', html, re.M):
        html = re.sub(r'^function ' + name + r'\([^\n]*$', lambda _: block, html, count=1, flags=re.M)
    else:
        html = html.replace('const WORDS=[];', block + '\nconst WORDS=[];', 1)

replace("+'</div><div class=\"card-foot\">'+(revealed?", "+(revealed?extraWordDetails(w):'')+'</div><div class=\"card-foot\">'+(revealed?")
replace("+(EXAMPLES[id]?'<p class=\"example\">'+esc(EXAMPLES[id])+'</p>':'')+'<p class=\"small muted\">'", "+(EXAMPLES[id]?'<p class=\"example\">'+esc(EXAMPLES[id])+'</p>':'')+extraWordDetails(w)+'<p class=\"small muted\">'")
replace("[w.word,w.def,w.zh,w.syn].some(s=>s.toLowerCase().includes(q))", "[w.word,w.def,w.zh,w.syn,...(SECONDARY_MEANINGS[w.id]||[]).flatMap(s=>[s.def,s.zh,s.syn]),...relatedWords(w).map(v=>v.word)].some(s=>s.toLowerCase().includes(q))")
replace("esc(w.syn)+'</div></td><td>'+tierChip(w)", "esc(w.syn)+'</div>'+((SECONDARY_MEANINGS[w.id]||[]).length?'<div class=\"sub\">+ '+SECONDARY_MEANINGS[w.id].length+' additional meaning(s) · open word details</div>':'')+'</td><td>'+tierChip(w)")
replace("'Start small, get instant feedback, and revisit what needs another look.')+filterBar()", "'Start small, get instant feedback, and revisit what needs another look.')+coverage()+filterBar()")
replace("contextCount+' selected words have original context sentences. Short sessions use as many eligible words as available.'", "contextCount+' selected words have original context sentences. Additional meanings are included where available. Short sessions use as many eligible words as available.'")
replace("q.mode==='synonyms'?'Choose the closest meaning.'", "q.mode==='synonyms'?(q.cue?'Choose the closest meaning as used in the sentence.':'Choose the closest meaning.')")
replace("+'</div>'+(q.mode==='spelling'?", "+'</div>'+(q.cue?'<p class=\"example sense-cue\">'+esc(q.cue)+'</p>':'')+(q.mode==='spelling'?")
replace('Each word focuses on one selected sense. Continue reading widely and use official practice alongside this page.', 'Every built-in word includes an original context sentence. Common alternate meanings and related word forms are included for selected entries. Continue reading widely and use official practice alongside this page.')
replace("+'</div>':'')+'<div class=\"question-foot\">'", "+'</div>'+aiExplanationPanel(s,s.index):'')+'<div class=\"question-foot\">'")
replace("if(a==='check-answer'){checkAnswer();return}", "if(a==='ai-explain'){void requestAIExplanation();return}if(a==='check-answer'){checkAnswer();return}")
replace("+'</p><div class=\"setup-options\">'", "+'</p>'+(practiceMode==='timed'?'':'<p class=\"small muted\">After Check answer, the question and your answer are sent for an AI explanation. AI help needs internet; built-in feedback remains available offline.</p>')+'<div class=\"setup-options\">'")

css = '.extra-meanings{width:100%;max-width:560px;text-align:left;margin-top:20px;font-size:13px}.extra-meanings summary{cursor:pointer;color:var(--green);font-weight:650}.sense{border-top:1px solid var(--line);padding-top:12px;margin-top:12px}.sense .example{font-size:14px;margin-top:8px;padding-top:0;border:0}.sense .zh{font-size:12px}.family-links{display:flex;flex-wrap:wrap;gap:7px 18px}.family-links button{font-size:14px}.sense-cue{font-size:18px;margin:0 0 22px;padding:0 0 16px;border-top:0;border-bottom:1px solid var(--line)}'
if css not in html:
    html = html.replace('</style>', css + '\n</style>', 1)
ai_css = '.ai-explanation{margin-top:20px;padding:20px;border:1px solid #dbe5d0;border-radius:12px;background:#fafcf7;font-size:14px;overflow-wrap:anywhere}.ai-explanation h3{font:normal 22px var(--serif);margin:0 0 12px}.ai-explanation p{margin:10px 0}.ai-text{white-space:pre-wrap}.ai-choices{padding-left:22px;margin:12px 0}.ai-choices li{margin:7px 0}.ai-explanation[aria-busy=true]{border-left:3px solid var(--green)}'
if ai_css not in html:
    html = html.replace('</style>', ai_css + '\n</style>', 1)
html = re.sub(r'An offline SSAT Middle Level vocabulary studio: \d+ curated words', 'An offline SSAT Middle Level vocabulary studio: ' + str(len(seen)) + ' curated words', html)
PAGE.write_text(html)
contents = (ROOT / 'content.html').read_text()
contents = re.sub(r'<li>\d+ vocabulary words</li>', '<li>' + str(len(seen)) + ' vocabulary words with context sentences</li>', contents)
contents = re.sub(r'Words in context and \d+ analogies', 'Words in context and ' + str(len(analogies)) + ' analogies', contents)
if 'Alternate meanings and related word forms' not in contents:
    contents = contents.replace('<li>54 prefixes, roots, and suffixes</li>', '<li>Alternate meanings and related word forms</li>\n        <li>54 prefixes, roots, and suffixes</li>')
if 'AI explanations after checking answers' not in contents:
    contents = contents.replace('<li>Synonym, meaning, and spelling quizzes</li>', '<li>Synonym, meaning, and spelling quizzes</li>\n        <li>AI explanations after checking answers (online)</li>')
contents = contents.replace('Works offline. Progress is saved in your browser, with backup and restore options.', 'Core practice works offline; AI explanations need internet. Progress is saved in your browser, with backup and restore options.')
(ROOT / 'content.html').write_text(contents)
print(f'Updated {len(seen)} words, {len(examples)} examples, {sum(map(len, senses.values()))} alternate meanings, {len(families)} related-word groups, {len(analogies)} analogies.')

#!/usr/bin/env python3
"""Rebuild the vocabulary expansion inside the standalone, offline HTML page."""
import json
import re
from collections import Counter
from pathlib import Path
from prebuild_explanations import build_lessons
from online_vocabulary import load_online_expansion

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
reading_entries = json.loads((TOOLS / 'reading-vocabulary.json').read_text())
passages = {p['id']: p for file in sorted(TOOLS.glob('reading-data-*.json')) for p in json.loads(file.read_text())}
reading_sources, reading_notes, reading_keys = {}, {}, set()
for entry in reading_entries:
    word = entry['word']
    key = (word, entry.get('kind', 'new'))
    assert key not in reading_keys, key
    reading_keys.add(key)
    refs = []
    for ref in entry['sources']:
        passage = passages[ref['passageId']]
        source_text = passage['title'] + '\n' + '\n'.join(passage['paragraphs'])
        assert re.search(r'\b' + re.escape(ref['form']) + r'\b', source_text, re.I), (word, ref)
        refs.append(dict(passageId=passage['id'], title=passage['title'], file=passage['sourceFile'], pages=passage['sourcePages'], form=ref['form']))
    assert refs, word
    reading_sources.setdefault(word, []).extend(ref for ref in refs if ref not in reading_sources.get(word, []))
constant('READING_WORD_SOURCES', reading_sources)
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
for entry in reading_entries:
    if entry.get('kind') == 'secondary':
        continue
    word = entry['word']
    assert entry['tier'] in ['Foundation', 'Core', 'Stretch'] and entry['topic'], word
    additions.append(tuple(entry[k] for k in ['word', 'pos', 'definition', 'zh', 'synonym', 'tier', 'topic']))
    examples[word] = entry['example']
    reading_notes[word] = (entry['note'], entry['memory'])
online_rows, online_examples, online_notes, online_sources, online_refs, online_priority, online_warnings = load_online_expansion()
additions.extend(online_rows)
examples.update(online_examples)
reading_notes.update(online_notes)
constant('ONLINE_SOURCES', online_sources)
constant('ONLINE_WORD_SOURCES', online_refs)
constant('ONLINE_PRIORITY', online_priority)
constant('ONLINE_USAGE_NOTES', {word: note[0] for word, note in online_notes.items()})
constant('ONLINE_WORD_WARNINGS', online_warnings)
audio_manifest = json.loads((ROOT / 'audio' / 'vocabulary-manifest.json').read_text())
expected_audio = ({line.split('|')[0] for line in raw.splitlines() if line and not line.startswith('@')} | {row[0] for row in additions}) - set(online_warnings)
assert set(audio_manifest['words']) == expected_audio, 'Regenerate the word audio after changing the vocabulary bank.'
for word, recording in audio_manifest['words'].items():
    assert recording['text'] == word and (ROOT / recording['file']).is_file(), word
constant('WORD_AUDIO', {**{k: audio_manifest[k] for k in ['provider', 'voice', 'rate']},
    'words': {word: {k: value for k, value in recording.items() if k != 'sha256'} for word, recording in audio_manifest['words'].items()}})
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

# The checked-in article library is self-contained and requires no generation at runtime.
prebuilt_articles = []
article_coverage = set()
word_definitions = {line.split('|')[0]: line.split('|')[2] for line in lines if line and not line.startswith('@')}
for article_file in sorted((TOOLS / 'prebuilt-articles').glob('*.json')):
    article = json.loads(article_file.read_text())
    targets = article['targets']
    assert 1 <= len(targets) <= 8 and len({t['word'] for t in targets}) == len(targets), article_file
    text = ' '.join(article['paragraphs'])
    assert 150 <= len(text.split()) <= 650 and article['title'] and len(article['title']) <= 160, article_file
    for target in targets:
        assert target['index'] == 0 and target['definition'] == word_definitions[target['word']], article_file
        assert re.search(r'(?<!\w)' + re.escape(target['word']) + r'(?!\w)', text, re.I), (article_file, target['word'])
        article_coverage.add(target['word'])
    prebuilt_articles.append({k: article[k] for k in ['id','title','paragraphs','targets','createdAt']})
assert article_coverage == seen - set(online_warnings), ('Incomplete prebuilt article coverage', len(article_coverage), len(seen - set(online_warnings)))
constant('PREBUILT_ARTICLES', prebuilt_articles)

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
for entry in reading_entries:
    if entry.get('kind') != 'secondary':
        continue
    word = entry['word']
    assert word in seen, word
    assert len(re.findall(r'\b' + re.escape(word) + r'\b', entry['example'], re.I)) == 1, word
    primary = next(line.split('|') for line in lines if line.startswith(word + '|'))
    existing_meanings = [(primary[1], primary[2])] + [(s['pos'], s['def']) for s in senses.get(word, [])]
    assert (entry['pos'], entry['definition']) not in existing_meanings, ('Duplicate reading sense', word)
    index = len(senses.get(word, [])) + 1
    senses.setdefault(word, []).append({'pos': entry['pos'], 'def': entry['definition'], 'zh': entry['zh'], 'syn': entry['synonym'], 'example': entry['example']})
    reading_notes[f'{word}#{index}'] = (entry['note'], entry['memory'])
constant('SECONDARY_MEANINGS', senses)
example_manifest = json.loads((ROOT / 'audio' / 'example-manifest.json').read_text())
expected_examples = {word+'#0': text for word, text in examples.items() if word not in online_warnings}
expected_examples.update({word+'#'+str(index): sense['example'] for word, items in senses.items() if word not in online_warnings for index, sense in enumerate(items, 1)})
assert set(example_manifest['examples']) == set(expected_examples), 'Regenerate example audio after changing the vocabulary bank.'
for identifier, recording in example_manifest['examples'].items():
    assert recording['text'] == expected_examples[identifier] and (ROOT / recording['file']).is_file(), identifier
constant('EXAMPLE_AUDIO', {**{k: example_manifest[k] for k in ['provider', 'voice', 'rate']},
    'examples': {identifier: {k: value for k, value in recording.items() if k != 'sha256'} for identifier, recording in example_manifest['examples'].items()}})
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
    ['stout', 'sturdy', 'robust', 'strong'],
    ['considerable', 'substantial', 'large', 'significant'],
    ['furnish', 'supply', 'provide'],
    ['inhabit', 'reside', 'occupy', 'live', 'dwell'],
    ['inhabitant', 'resident', 'dweller'],
    ['abundance', 'plenty', 'profusion'],
    ['notify', 'inform', 'tell'],
    ['teem', 'abound'],
    ['paltry', 'meager', 'scant', 'inadequate'],
    ['opulent', 'luxurious', 'lavish'],
    ['confine', 'restrict', 'limit', 'restrain'],
    ['depict', 'portray', 'represent'],
    ['incorporate', 'integrate', 'include', 'assimilate'],
    ['reveal', 'disclose', 'expose', 'unveil'],
    ['counter', 'oppose', 'resist', 'withstand'],
    ['shroud', 'veil', 'conceal', 'hide', 'obscure'],
    ['commendable', 'praiseworthy', 'admirable'],
    ['artificial', 'human-made', 'synthetic'],
    ['illumination', 'lighting', 'light'],
    ['questionable', 'doubtful', 'dubious', 'uncertain'],
    ['assistance', 'aid', 'help', 'support'],
    ['reluctantly', 'unwillingly', 'hesitantly'],
    ['indefinite', 'unspecified', 'uncertain', 'vague'],
    ['idyllic', 'blissful', 'peaceful'],
    ['searing', 'scorching', 'burning', 'hot'],
    ['participation', 'involvement'],
    ['appreciate', 'value', 'esteem', 'admire'],
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
# These changes remove alternative answers that matched the stem's rule.
analogy_fixes = {
    'enormous : immense': ('cold : frigid', 'cold : hot'),
    'practice : improvement': ('goal : attempt', 'goal : target'),
    'spark : fire': ('flame : heat', 'heat : flame'),
    'erosion : land loss': ('cloud : rainfall', 'rainfall : cloud'),
    'degree Celsius : temperature': ('degree : angle', 'angle : degree'),
}
for i, line in enumerate(analogies):
    fields = line.split('|')
    if fields[1] in analogy_fixes:
        old, new = analogy_fixes[fields[1]]
        assert old in fields[3:7] or new in fields[3:7]
        fields[3:7] = [new if value == old else value for value in fields[3:7]]
        analogies[i] = '|'.join(fields)
constant('RAW_ANALOGIES', '\n'.join(analogies))

html = re.sub(r'^// BEGIN vocabulary-ai\n.*?^// END vocabulary-ai\n?', '', html, count=1, flags=re.M | re.S)
word_lessons, analogy_lessons = build_lessons('\n'.join(lines), examples, senses, families, analogies, reading_notes)
constant('PREBUILT_WORD_LESSONS', word_lessons)
constant('PREBUILT_ANALOGY_LESSONS', analogy_lessons)
explanation_block = '// BEGIN vocabulary-explanations\n' + (TOOLS / 'vocabulary-explanations.js').read_text().strip() + '\n// END vocabulary-explanations'
if '// BEGIN vocabulary-explanations\n' in html:
    html = re.sub(r'^// BEGIN vocabulary-explanations\n.*?^// END vocabulary-explanations', lambda _: explanation_block, html, count=1, flags=re.M | re.S)
else:
    html = html.replace('const WORDS=[];', explanation_block + '\nconst WORDS=[];', 1)

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

audio_block = '// BEGIN vocabulary-audio\n' + (TOOLS / 'vocabulary-audio.js').read_text().strip() + '\n// END vocabulary-audio'
if '// BEGIN vocabulary-audio\n' in html:
    html = re.sub(r'^// BEGIN vocabulary-audio\n.*?^// END vocabulary-audio', lambda _: audio_block, html, count=1, flags=re.M | re.S)
else:
    html = re.sub(r'^function speak\([^\n]*$', lambda _: audio_block, html, count=1, flags=re.M)

replace("+'</div><div class=\"card-foot\">'+(revealed?", "+(revealed?extraWordDetails(w):'')+'</div><div class=\"card-foot\">'+(revealed?")
html = html.replace("'<p class=\"example\">“'+esc(EXAMPLES[w.id])+'”</p>'", 'exampleMarkup(EXAMPLES[w.id])')
html = html.replace("'<p class=\"example\">'+esc(EXAMPLES[id])+'</p>'", 'exampleMarkup(EXAMPLES[id])')
html = html.replace("'<p class=\"example sense-cue\">'+esc(q.cue)+'</p>'", "exampleMarkup(q.cue,'sense-cue')")
replace("+(EXAMPLES[id]?exampleMarkup(EXAMPLES[id]):'')+'<p class=\"small muted\">'", "+(EXAMPLES[id]?exampleMarkup(EXAMPLES[id]):'')+extraWordDetails(w)+'<p class=\"small muted\">'")
replace("[w.word,w.def,w.zh,w.syn].some(s=>s.toLowerCase().includes(q))", "[w.word,w.def,w.zh,w.syn,...(SECONDARY_MEANINGS[w.id]||[]).flatMap(s=>[s.def,s.zh,s.syn]),...relatedWords(w).map(v=>v.word)].some(s=>s.toLowerCase().includes(q))")
replace("esc(w.syn)+'</div></td><td>'+tierChip(w)", "esc(w.syn)+'</div>'+((SECONDARY_MEANINGS[w.id]||[]).length?'<div class=\"sub\">+ '+SECONDARY_MEANINGS[w.id].length+' additional meaning(s) · open word details</div>':'')+'</td><td>'+tierChip(w)")
replace("'Start small, get instant feedback, and revisit what needs another look.')+filterBar()", "'Start small, get instant feedback, and revisit what needs another look.')+coverage()+filterBar()")
replace("contextCount+' selected words have original context sentences. Short sessions use as many eligible words as available.'", "contextCount+' selected words have original context sentences. Additional meanings are included where available. Short sessions use as many eligible words as available.'")
replace("const pool=filtered(),contextCount=pool.filter(w=>EXAMPLES[w.id]).length", "const pool=filtered().filter(studyEligible),contextCount=pool.filter(w=>EXAMPLES[w.id]).length")
replace("if(e.target.dataset.filter==='tier')filters.topic='All';", "if(e.target.dataset.filter==='tier'||e.target.dataset.filter==='origin')filters.topic='All';if(e.target.dataset.filter==='origin')filters.tier='All';")
replace("if(a==='study-word'){$('detailDialog').close();", "if(a==='study-word'){if(!studyEligible(wordById(id))){toast('This source spelling is awaiting review.');return}$('detailDialog').close();")
replace("class=\"primary\">Study this word</button>", "class=\"primary\" '+(!studyEligible(w)?'disabled':'')+'>'+(!studyEligible(w)?'Awaiting review':'Study this word')+'</button>")
replace("const tierChip=w=>'<span", "const tierChip=w=>(studyEligible(w)?'':'<span class=\"chip review-chip\">Needs review</span> ')+'<span")
replace("'Search '+allWords().length+' words by spelling", "'Search '+allWords().length+' entries by spelling")
replace("'<tr><td><button class=\"text-btn table-word\" data-action=\"detail\" data-id=\"'+esc(w.id)+'\">'+esc(w.word)+'</button><div class=\"sub\">'", "'<tr><td><div class=\"library-word\"><button class=\"text-btn table-word\" data-action=\"detail\" data-id=\"'+esc(w.id)+'\">'+esc(w.word)+'</button><button class=\"icon library-pronounce\" data-action=\"speak\" data-id=\"'+esc(w.id)+'\" aria-label=\"Hear '+esc(w.word)+'\" aria-pressed=\"false\" title=\"'+(WORD_AUDIO.words[w.id]?'Hear word':studyEligible(w)?'No recording available':'Awaiting spelling review')+'\" '+(WORD_AUDIO.words[w.id]?'':'disabled')+'>'+icon('sound')+'</button></div><div class=\"sub\">'")
replace("esc({adj:'adjective',n:'noun',v:'verb',adv:'adverb'}[w.pos])", "esc({adj:'adjective',n:'noun',v:'verb',adv:'adverb',conj:'conjunction',interj:'interjection'}[w.pos])")
replace("q.mode==='synonyms'?'Choose the closest meaning.'", "q.mode==='synonyms'?(q.cue?'Choose the closest meaning as used in the sentence.':'Choose the closest meaning.')")
replace("+'</div>'+(q.mode==='spelling'?", "+'</div>'+(q.cue?exampleMarkup(q.cue,'sense-cue'):'')+(q.mode==='spelling'?")
replace("if(a==='speak'){speak(id);return}", "if(a==='speak'){speak(id);return}if(a==='read-example'){readExample(b.dataset.exampleId);return}")
replace('Each word focuses on one selected sense. Continue reading widely and use official practice alongside this page.', 'Every built-in word includes an original context sentence. Common alternate meanings and related word forms are included for selected entries. Continue reading widely and use official practice alongside this page.')
html = html.replace('aiExplanationPanel(s,s.index)', 'prebuiltExplanationPanel(q,answer)')
html = html.replace("if(a==='ai-explain'){void requestAIExplanation();return}", '')
html = html.replace('After Check answer, the question and your answer are sent for an AI explanation. AI help needs internet; built-in feedback remains available offline.', 'Check answer shows a detailed explanation, choice comparisons, and a memory tip immediately. All explanations work offline.')
# Detailed lessons are also available in the results of ordinary and timed drills.
replace("esc(q.explanation)+'</p>'+(state.settings.chinese&&q.zh?'<p class=\"muted\" lang=\"zh\">'+esc(q.zh)+'</p>':'')+'</div>'", "esc(q.explanation)+'</p>'+(state.settings.chinese&&q.zh?'<p class=\"muted\" lang=\"zh\">'+esc(q.zh)+'</p>':'')+'<details class=\"review-explanation\"><summary>Detailed explanation</summary>'+prebuiltExplanationPanel(q,s.answers[i])+'</details></div>'")

css = '.extra-meanings{width:100%;max-width:560px;text-align:left;margin-top:20px;font-size:13px}.extra-meanings summary{cursor:pointer;color:var(--green);font-weight:650}.sense{border-top:1px solid var(--line);padding-top:12px;margin-top:12px}.sense .example{font-size:14px;margin-top:8px;padding-top:0;border:0}.sense .zh{font-size:12px}.family-links{display:flex;flex-wrap:wrap;gap:7px 18px}.family-links button{font-size:14px}.sense-cue{font-size:18px;margin:0 0 22px;padding:0 0 16px;border-top:0;border-bottom:1px solid var(--line)}'
if css not in html:
    html = html.replace('</style>', css + '\n</style>', 1)
html = re.sub(r'^\.ai-explanation[^\n]*\n', '', html, flags=re.M)
explanation_css = '.answer-explanation{margin-top:20px;padding:20px;border:1px solid #dbe5d0;border-radius:12px;background:#fafcf7;font-size:14px;overflow-wrap:anywhere}.answer-explanation h3{font:normal 22px var(--serif);margin:0 0 12px}.answer-explanation h4{font-size:14px;margin:18px 0 7px}.answer-explanation p{margin:10px 0}.explanation-choices{padding-left:22px;margin:12px 0}.explanation-choices li{margin:9px 0}.review-explanation summary{cursor:pointer;color:var(--green);font-weight:600;margin-top:12px}'
if explanation_css not in html:
    html = html.replace('</style>', explanation_css + '\n</style>', 1)
online_css = '.usage-note{max-width:560px;text-align:left;font-size:12px;padding:12px 14px;border-left:3px solid #c5a55e;background:#fff9e9;overflow-wrap:anywhere}.review-chip{background:#fff0d1;color:#775113}.extra-meanings a{overflow-wrap:anywhere}'
if online_css not in html:
    html = html.replace('</style>', online_css + '\n</style>', 1)
online_layout_css = '.coverage details{margin-top:5px}.coverage summary{cursor:pointer;color:var(--green)}@media(max-width:700px){.filters label{flex:1 1 calc(50% - 9px);min-width:130px}}'
if online_layout_css not in html:
    html = html.replace('</style>', online_layout_css + '\n</style>', 1)
audio_css = '.tts-word{border-radius:3px}.tts-word.is-speaking{background:#ffe08a;color:#243a32}[data-action="speak"][aria-pressed="true"]{background:var(--lime)}'
if audio_css not in html:
    html = html.replace('</style>', audio_css + '\n</style>', 1)
library_audio_css = '.library-word{display:flex;align-items:center;gap:6px;min-width:max-content}.library-word .table-word{white-space:nowrap;text-align:left}.library-pronounce{flex-shrink:0;min-width:36px;min-height:36px}'
if library_audio_css not in html:
    html = html.replace('</style>', library_audio_css + '\n</style>', 1)
example_audio_css = '.example-read{display:inline-flex;align-items:center;gap:5px;padding:4px 8px;margin-left:5px;vertical-align:middle;font:12px var(--sans);white-space:nowrap}.example-read svg{width:16px;height:16px}.example-read[aria-pressed="true"]{background:var(--lime)}.example-text{overflow-wrap:anywhere}'
if example_audio_css not in html:
    html = html.replace('</style>', example_audio_css + '\n</style>', 1)
html = re.sub(r'An offline SSAT Middle Level vocabulary studio: \d+ (?:curated words|vocabulary entries)', 'An offline SSAT Middle Level vocabulary studio: ' + str(len(seen)) + ' vocabulary entries', html)
# Bundle the pinned scheduler and review UI before progress is loaded.
html = html.replace("const statusOf=w=>{const r=rec(w.id);return !r.seen?'New':r.level>=3?'Secure':'Learning'};", "const statusOf=w=>srsWordStatus(w);")
srs_block = '// BEGIN vocabulary-srs\n' + (TOOLS / 'vendor/ts-fsrs-6.0.0.js').read_text() + '\n' + (TOOLS / 'vocabulary-srs.js').read_text() + '\n// BEGIN vocabulary-article\n' + (TOOLS / 'vocabulary-article.js').read_text() + '\n// END vocabulary-article\n// END vocabulary-srs\n'
html = re.sub(r'^// BEGIN vocabulary-srs\n.*?^// END vocabulary-srs\n?', '', html, flags=re.M | re.S)
html = html.replace('const progressStorage=', srs_block + 'const progressStorage=', 1)
html = re.sub(r'^(?:state=sanitizeState\(state\);)?nav\(\);render\(\);', 'state=sanitizeState(state);nav();render();', html, flags=re.M)
html = html.replace("['All','New','Learning','Secure','Review due','Starred']", "['All','New','Learning','Review','Review due','Starred']")
html = html.replace("if(saved&&saved.version===1){if(!saved.schedulingVersion&&!progressStorage.getItem(KEY+'-pre-fsrs'))progressStorage.setItem(KEY+'-pre-fsrs',JSON.stringify(saved));state=sanitizeState(saved);}", "if(saved&&saved.version===1){state=sanitizeState(saved);if(!saved.schedulingVersion&&!progressStorage.getItem(KEY+'-pre-fsrs')){try{progressStorage.setItem(KEY+'-pre-fsrs',JSON.stringify(saved));}catch(error){srsRecoveryBlocked=true;throw error;}}}")
replace("if(saved&&saved.version===1)state=sanitizeState(saved);", "if(saved&&saved.version===1){state=sanitizeState(saved);if(!saved.schedulingVersion&&!progressStorage.getItem(KEY+'-pre-fsrs')){try{progressStorage.setItem(KEY+'-pre-fsrs',JSON.stringify(saved));}catch(error){srsRecoveryBlocked=true;throw error;}}}")
replace("newDeck();save();nav();render();toast('Progress restored.')", "if(!state.srsSession)newDeck();save();nav();render();toast('Progress restored.')")
from student_profiles import embed_profiles
PAGE.write_text(embed_profiles(html))
contents = (ROOT / 'content.html').read_text()
contents = re.sub(r'<li>\d+ vocabulary (?:words(?: with context sentences)?|study words \+ \d+ source spelling under review)</li>', '<li>' + str(len(seen) - len(online_warnings)) + ' vocabulary study words + ' + str(len(online_warnings)) + ' source spelling under review</li>', contents)
contents = re.sub(r'Words in context and \d+ analogies', 'Words in context and ' + str(len(analogies)) + ' analogies', contents)
if 'Alternate meanings and related word forms' not in contents:
    contents = contents.replace('<li>54 prefixes, roots, and suffixes</li>', '<li>Alternate meanings and related word forms</li>\n        <li>54 prefixes, roots, and suffixes</li>')
contents = contents.replace('AI explanations after checking answers (online)', 'Detailed offline answer explanations')
contents = contents.replace('Core practice works offline; AI explanations need internet.', 'Practice and explanations work offline.')
(ROOT / 'content.html').write_text(embed_profiles(contents))
print(f'Updated {len(seen)} words, {len(examples)} examples, {sum(map(len, senses.values()))} alternate meanings, {len(families)} related-word groups, {len(analogies)} analogies.')
print(f'Embedded {sum(map(len, word_lessons.values()))} prebuilt word lessons and {len(analogy_lessons)} analogy lessons.')

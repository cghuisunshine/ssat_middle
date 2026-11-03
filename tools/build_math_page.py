#!/usr/bin/env python3
"""Build the standalone Middle Level math practice page from reviewed source data."""
from pathlib import Path
import hashlib
import json
import re
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / 'tools'
TOPICS = ['Number sense', 'Fractions & decimals', 'Ratios & percent', 'Algebra', 'Geometry & measurement', 'Data & probability']
NAMES = {'ivy': 'Ivy Global', 'ninjas': 'Test Ninjas', 'kaplan': 'Kaplan'}


def validate_svg(svg):
    node = ET.fromstring(svg)
    assert node.tag.split('}')[-1] == 'svg' and 'viewBox' in node.attrib
    assert node.attrib.get('role') == 'img' and node.attrib.get('aria-label')
    allowed = {'svg','g','rect','line','polyline','polygon','path','circle','ellipse','text','tspan','title','desc','defs','marker','pattern','clipPath'}
    for child in node.iter():
        assert child.tag.split('}')[-1] in allowed, child.tag
        for key, value in child.attrib.items():
            assert not key.lower().startswith('on') and 'href' not in key.lower()
            assert not re.search(r'(?:https?:|javascript:|data:|@import|expression\s*\()', value, re.I)


def build():
    questions = []
    for source in NAMES:
        group = json.loads((TOOLS / f'math-data-{source}.json').read_text())
        assert len(group) == 50, (source, len(group))
        for q in group:
            assert q['sourceId'] == source and q['level'] == 'Middle'
            assert q['topic'] in TOPICS
            assert 1 <= q['number'] <= 25 and q['sourcePages']
            assert len(q['options']) == 5 and len(set(q['options'])) == 5
            assert all(isinstance(option, str) and option.strip() for option in q['options'])
            assert isinstance(q['answer'], int) and 0 <= q['answer'] < 5
            assert len(q['steps']) >= 2 and all(step.strip() for step in q['steps'])
            assert q['tip'].strip() and q['prompt'].strip()
            assert not re.search(r'\\(?:frac|sqrt|begin)', q['prompt']+' '.join(q['options'])), q['id']
            if q.get('diagramSvg'): validate_svg(q['diagramSvg'])
        questions.extend(group)
    assert len({q['id'] for q in questions}) == len(questions) == 150
    sets = {}
    for q in questions:
        if q['setId'] not in sets:
            sets[q['setId']] = {'name': NAMES[q['sourceId']] + ' · Quantitative ' + str(1 + sum(s['sourceId'] == q['sourceId'] for s in sets.values())), 'sourceId': q['sourceId'], 'sourceSection': q['sourceSection'], 'questionIds': []}
        sets[q['setId']]['questionIds'].append(q['id'])
    for sid, section in sets.items():
        selected = sorted([q for q in questions if q['setId'] == sid], key=lambda q:q['number'])
        assert [q['number'] for q in selected] == list(range(1,26)), sid
        section['questionIds'] = [q['id'] for q in selected]
    assert len(sets) == 6
    hashes = {name: hashlib.sha256((ROOT/'reading_materials'/name).read_bytes()).hexdigest() for name in sorted({q['sourceFile'] for q in questions}) if (ROOT/'reading_materials'/name).exists()}
    data = {'version': 1, 'level': 'SSAT Middle Level', 'minutes': 30, 'questionsPerSet': 25, 'topics': TOPICS, 'sources': NAMES, 'sourceHashes': hashes, 'sets': sets, 'questions': questions}
    html = (TOOLS/'math-page.template.html').read_text()
    for key,value in {'__COUNT__':str(len(questions)), '__SETS__':str(len(sets)), '__CSS__':(TOOLS/'reading-page.css').read_text()+'\n'+(TOOLS/'math-page.css').read_text(), '__DATA__':json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c'), '__JS__':(TOOLS/'math-page.js').read_text()}.items():
        html = html.replace(key,value)
    (ROOT/'ssat_middle_math.html').write_text(html)
    print(f'Built ssat_middle_math.html: {len(questions)} questions, {len(sets)} sections, {sum(bool(q.get("diagramSvg")) for q in questions)} diagrams.')


if __name__ == '__main__':
    build()

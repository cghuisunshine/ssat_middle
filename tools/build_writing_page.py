#!/usr/bin/env python3
"""Build a standalone Middle Level writing studio with no runtime dependencies."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / 'tools'


def build():
    data = json.loads((TOOLS / 'writing-data.json').read_text())
    prompts = {p['id']: p for p in data['prompts']}
    assert len(prompts) == len(data['prompts']) == 20
    assert data['minutes'] == 25 and data['level'] == 'SSAT Middle Level'
    assert all(p['type'] in {'story', 'personal'} and p['text'].strip() for p in prompts.values())
    assert sum(bool(p.get('file')) for p in prompts.values()) == 8
    assert len(data['timedSets']) == 7
    for pair in data['timedSets']:
        assert len(set(pair['promptIds'])) == 2
        assert [prompts[pid]['type'] for pid in pair['promptIds']] == ['story', 'personal']
    css = (TOOLS / 'reading-page.css').read_text() + '\n' + (TOOLS / 'writing-page.css').read_text()
    html = (TOOLS / 'writing-page.template.html').read_text()
    for key, value in {'__CSS__': css, '__DATA__': json.dumps(data, ensure_ascii=False).replace('<', '\\u003c'), '__JS__': (TOOLS / 'writing-page.js').read_text()}.items():
        html = html.replace(key, value)
    (ROOT / 'ssat_middle_writing.html').write_text(html, encoding='utf-8')
    print('Built ssat_middle_writing.html: 20 prompts, 7 pairs, 25-minute timed practice.')


if __name__ == '__main__':
    build()

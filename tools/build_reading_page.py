#!/usr/bin/env python3
"""Build the standalone Middle Level reading page from reviewed local source data."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / 'tools'
SOURCES = {
    'ivy': {
        'name': 'Ivy Global', 'short': 'Ivy Global', 'timed': True,
        'selection': 'Separate SSAT Middle Level Reading section, PDF pages 1–14. The overlapping full test is not duplicated.',
        'answerNote': 'Answers match the published Section 2 key in ivy_middle_answers.pdf (PDF page 2). Explanations were prepared for this page.',
    },
    'ninjas': {
        'name': 'Test Ninjas', 'short': 'Test Ninjas', 'timed': True,
        'selection': 'SSAT Middle Level Practice Test 1, Reading Section 3, PDF pages 15–32. Other subjects and experimental questions are excluded.',
        'answerNote': 'Answers match the published Section 3 key on PDF page 50. Explanations were prepared for this page.',
    },
    'kaplan': {
        'name': 'Kaplan', 'short': 'Kaplan', 'timed': True,
        'selection': 'SSAT & ISEE Prep, Tenth Edition: only SSAT Middle Reading Section 2, PDF pages 462–473. Upper SSAT, ISEE, and mixed-level drills are excluded.',
        'answerNote': 'Answers match the published Middle Level Section 2 key on PDF page 496. Explanations were prepared for this page and checked against the source explanations.',
    },
    'princeton': {
        'name': 'Princeton Review', 'short': 'Princeton Review', 'timed': True,
        'selection': 'Middle Level SSAT Practice Test, Section 2, PDF pages 12–19. Other subjects are excluded.',
        'answerNote': 'The downloaded excerpt has no publisher answer key. Answers and explanations were prepared for this page from the passage evidence. Question 9 has one documented choice clarification.',
    },
    'gotestprep': {
        'name': 'GoTestPrep', 'short': 'GoTestPrep', 'timed': False,
        'selection': 'Only the webpage explicitly labeled SSAT Reading Comprehension Practice Test (Middle Level). Its 22 questions use four choices, so this source is guided practice rather than a full timed set.',
        'answerNote': 'Answers match the keys embedded in the saved Middle Level webpage. Explanations were prepared for this page. The separate mixed Middle/Upper webpage is excluded.',
    },
}
GENRES = {'Science', 'History', 'Literature', 'Poetry', 'Social science'}
SKILLS = {'Main idea', 'Detail', 'Inference', 'Vocabulary', 'Tone', 'Structure'}


def build():
    passages = []
    for source_id in SOURCES:
        path = TOOLS / f'reading-data-{source_id}.json'
        group = json.loads(path.read_text(encoding='utf-8'))
        assert sum(len(p['questions']) for p in group) == (22 if source_id == 'gotestprep' else 40), path
        for p in group:
            assert p['sourceId'] == source_id and p['level'] == 'Middle', p['id']
            assert p['genre'] in GENRES and p['paragraphs'], p['id']
            assert all(isinstance(t, str) and t.strip() for t in p['paragraphs']), p['id']
            assert p['questions'], p['id']
            for q in p['questions']:
                assert q['skill'] in SKILLS and q['prompt'].strip(), q['id']
                assert len(q['options']) == (4 if source_id == 'gotestprep' else 5), q['id']
                assert len(set(q['options'])) == len(q['options']), q['id']
                assert isinstance(q['answer'], int) and 0 <= q['answer'] < len(q['options']), q['id']
                assert len(q['explanation']) > 40, q['id']
                assert all(isinstance(o, str) and o.strip() for o in q['options']), q['id']
        passages.extend(group)
    ids = [p['id'] for p in passages]
    question_ids = [q['id'] for p in passages for q in p['questions']]
    assert len(ids) == len(set(ids)), 'Duplicate passages'
    assert len(question_ids) == len(set(question_ids)), 'Duplicate questions'
    fingerprints = [' '.join(p['paragraphs']).casefold() for p in passages]
    assert len(fingerprints) == len(set(fingerprints)), 'Duplicate passage text'
    # Keep provenance reproducible without requiring source PDFs to run the page.
    provenance = {}
    for filename in sorted({p['sourceFile'] for p in passages} | {'ivy_middle_answers.pdf'}):
        source = ROOT / 'reading_materials' / filename
        if source.exists():
            provenance[filename] = hashlib.sha256(source.read_bytes()).hexdigest()
    payload = {'version': 1, 'level': 'SSAT Middle Level', 'sources': SOURCES,
               'sourceHashes': provenance, 'passages': passages}
    serialized = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    output = (TOOLS / 'reading-page.template.html').read_text(encoding='utf-8')
    replacements = {
        '__PASSAGE_COUNT__': str(len(passages)), '__QUESTION_COUNT__': str(len(question_ids)),
        '__CSS__': (TOOLS / 'reading-page.css').read_text(encoding='utf-8'),
        '__DATA__': serialized, '__JS__': (TOOLS / 'reading-page.js').read_text(encoding='utf-8'),
    }
    for token, value in replacements.items():
        output = output.replace(token, value)
    target = ROOT / 'ssat_middle_reading.html'
    target.write_text(output, encoding='utf-8')
    print(f'Built {target.name}: {len(passages)} passages, {len(question_ids)} questions, {len(SOURCES)} Middle Level sources.')


if __name__ == '__main__':
    build()

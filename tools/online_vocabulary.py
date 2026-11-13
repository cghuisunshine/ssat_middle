"""Load the fixed 1,598-entry online expansion and its historical provenance."""
import json
from pathlib import Path


def load_online_expansion():
    root = Path(__file__).resolve().parents[1]
    research = root / 'vocabulary_research'
    directory = root / 'tools' / 'online-vocabulary'
    required = set((research / 'missing_middle_candidates.txt').read_text().splitlines())
    priority = set((research / 'publisher_middle_missing.txt').read_text().splitlines())
    assert len(required) == 1598 and len(priority) == 219 and priority <= required
    manifest = json.loads((research / 'online_vocabulary.json').read_text())
    sources = {s['id']: {k: s[k] for k in ['title', 'url', 'scope', 'kind', 'status', 'notes']}
               for s in manifest['sources'] if s['scope'] in ['middle_specific', 'mixed_middle_ssat_isee']}
    references = {}
    for row in manifest['words']:
        if row['word'] in required:
            refs = [sid for sid in row['source_ids'] if sid in sources]
            assert refs, row['word']
            references[row['word']] = refs
    rows, examples = [], {}
    for file in sorted(directory.glob('*.txt')):
        for line in file.read_text().splitlines():
            if not line or line.startswith('#'):
                continue
            word, pos, definition, zh, synonym, example = line.split('|')
            assert word not in examples and all([word, pos, definition, zh, synonym, example]), word
            assert pos in ['n', 'v', 'adj', 'adv', 'conj', 'interj'], word
            tier = 'Core' if word in priority else 'Stretch'
            topic = 'Published Middle Level additions' if word in priority else 'Online Middle Level additions'
            rows.append((word, pos, definition, zh, synonym, tier, topic))
            examples[word] = example
    assert set(examples) == required, (required - set(examples), set(examples) - required)
    assert set(references) == required
    notes = json.loads((directory / 'notes.json').read_text())
    assert set(notes) <= required and all(len(n) == 2 and all(n) for n in notes.values())
    warnings = {'obstrusion': notes['obstrusion'][0]}
    return rows, examples, notes, sources, references, sorted(priority), warnings

"""Compile offline lessons from the vocabulary bank and authored teaching notes."""
from pathlib import Path

HERE = Path(__file__).resolve().parent
PARTS = {'adj': 'adjective', 'v': 'verb', 'n': 'noun', 'adv': 'adverb'}
GRAMMAR = {
    'adj': 'An adjective describes a person, thing, or idea. Check which quality the sentence requires.',
    'v': 'A verb names an action or process. Check what happens and who or what is involved.',
    'n': 'A noun names a person, thing, idea, or state. Check precisely what the definition names.',
    'adv': 'An adverb can describe how, when, or to what degree something happens. Check the intended manner or timing.',
}
RELATIONSHIPS = {
    'Synonym': ('The two words have the same or nearly the same meaning. Preserve the sense and approximate strength, not just the topic.', '两词意思相同或相近；要比较具体义项和程度，而不只是主题相同。', 'Try replacing the first word with the second without changing the intended meaning.'),
    'Opposite': ('The second word contrasts with the first on the same scale or quality.', '两词在同一性质或尺度上相反。', 'Name the shared scale first, then identify the opposing ends.'),
    'Part to whole': ('The first item is a component or member of the larger whole named second.', '第一项是第二项这个整体的一部分或成员；注意顺序。', 'Say: the first is part of the second. Do not reverse that sentence.'),
    'Type to category': ('The first item is one kind of the broader category named second. A part of something is not a kind of it.', '第一项是第二项这一大类中的一种；“部分”不等于“种类”。', 'Say: the first is a kind of the second.'),
    'Tool to function': ('The first item is a tool or piece of equipment; the second names its intended function. Match the specific purpose in the stem.', '第一项是工具，第二项是用途；还要匹配题干中的具体功能。', 'Say what the tool does, using an action rather than naming its user or material.'),
    'Worker to product': ('The first person creates the second item. A tool used or a place visited is not the product created.', '第一项的人创造或制作第二项；工具、工作场所不属于产品。', 'Say: this person creates that product.'),
    'Worker to tool': ('The first person uses the second item as a tool or instrument.', '第一项的人使用第二项作为工具或仪器。', 'Separate what the worker uses from what the worker makes.'),
    'Worker to place': ('The second item is a typical workplace of the person named first.', '第二项是第一项这一职业的典型工作场所。', 'Ask where the person works, not what the person uses or produces.'),
    'Degree': ('The second item is a stronger degree or intensity of the first idea. Both must follow the same direction along a comparable scale.', '第二项比第一项程度更强；两组的变化方向必须一致。', 'Draw an arrow from weaker to stronger, then check the answer in that order.'),
    'Cause to effect': ('The first event or process can produce the second result. Preserve that causal direction and the particular pattern in the stem.', '第一项可导致第二项结果；要保留因果方向和题干的具体模式。', 'Say: the first can cause the second. A remedy or an effect-before-cause pair changes the relationship.'),
    'Young to adult': ('The first animal is an earlier life stage of the animal named second.', '第一项是第二项动物的幼体或早期生长阶段。', 'Keep the young animal first and its own adult form second.'),
    'Object to characteristic': ('The second term names a typical quality of the first object or substance.', '第二项描述第一项物体或物质的典型特征。', 'Complete: this object is typically what? A source, part, or product is different.'),
    'Place to inhabitant': ('The first term is a dwelling or nesting place; the second is its typical animal inhabitant.', '第一项是住所或繁殖地，第二项是其中的典型动物。', 'Keep the home first and the animal second.'),
    'Unit to quantity': ('The first term is a measurement unit; the second names the quantity measured. An instrument is different from a unit.', '第一项是计量单位，第二项是所测量的量；测量工具不是计量单位。', 'Ask what the unit measures, not which instrument has marks in that unit.'),
}


def build_lessons(raw_words, examples, secondary, families, analogy_lines):
    authored = {}
    for line in (HERE / 'word-lesson-notes.txt').read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        key, note, tip = line.split('|')
        assert key not in authored and note and tip, key
        authored[key] = (note, tip)
    words = []
    for line in raw_words.splitlines():
        if not line or line.startswith('@'):
            continue
        word, pos, definition, zh, syn = line.split('|')
        words.append(dict(word=word, pos=pos, definition=definition, zh=zh, syn=syn))
    lessons, used = {}, set()
    for base in words:
        word = base['word']
        senses = [dict(base, example=examples[word])]
        senses += [dict(word=word, pos=s['pos'], definition=s['def'], zh=s['zh'], syn=s['syn'], example=s['example']) for s in secondary.get(word, [])]
        lessons[word] = []
        for index, s in enumerate(senses):
            sense_key = f'{word}#{index}'
            note_key = sense_key if sense_key in authored else word if index == 0 and word in authored else None
            if note_key:
                note, tip = authored[note_key]
                used.add(note_key)
            else:
                note = f'The meaning to preserve is “{s["definition"]}”. A word from the same topic can still name a different action, quality, or idea.'
                related = sorted({v for f in families if word in f for v in f if v != word})
                tip = (f'Learn {word} alongside ' + ', '.join(related) + '; notice how their meanings and parts of speech differ.') if related else f'Recall “{word} → {s["syn"]}”, then retell the example without looking at the definition.'
            meaning = f'{word} ({PARTS[s["pos"]]}) means “{s["definition"]}”.'
            why = {
                'synonyms': f'“{s["syn"]}” expresses the intended meaning of “{word}”. {note}',
                'definitions': f'The definition points to “{word}”: {s["definition"]}. {note}',
                'context': f'The completed sentence is: “{s["example"]}” Here “{word}” means “{s["definition"]}”. {note}',
                'spelling': f'The word recalled from this definition is “{word}”. {note}',
            }
            lessons[word].append(dict(word=word, pos=s['pos'], definition=s['definition'], syn=s['syn'], zh=s['zh'], meaning=meaning, why=why,
                example=s['example'], memory=tip, grammar=GRAMMAR[s['pos']],
                chinese=f'{word}：{s["zh"]}。本题义项的近义表达是 {s["syn"]}；请比较每个选项的具体含义。'))
    assert set(authored) == used, ('Unused or misspelled lesson notes', set(authored) - used)
    notes = {}
    for line in (HERE / 'analogy-choice-notes.txt').read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        fields = line.split('|')
        assert len(fields) == 5 and all(fields), fields
        number = int(fields[0])
        assert number not in notes
        notes[number] = fields[1:]
    assert set(notes) == set(range(1, len(analogy_lines) + 1))
    analogy_lessons = {}
    for index, line in enumerate(analogy_lines):
        kind, stem, correct, *rest = line.split('|')
        wrong, explanation = rest[:4], rest[4]
        guide, chinese, tip = RELATIONSHIPS[kind]
        analogy_lessons[f'analogy-{index}'] = dict(stem=stem, kind=kind, why=explanation, guide=guide, chinese=chinese, memory=tip,
            choices=[dict(choice=correct, explanation=explanation)] + [dict(choice=pair, explanation=note) for pair, note in zip(wrong, notes[index + 1])])
    return lessons, analogy_lessons

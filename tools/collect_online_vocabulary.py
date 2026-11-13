#!/usr/bin/env python3
"""Collect public SSAT word-list headwords, with provenance and level boundaries.

No definitions, examples, login-only data, or flashcard answers are copied.
The cache is outside the repository. Delete a cached file to download it again.
"""
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date
import csv
import hashlib
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]


class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    def text(self):
        return ' '.join(c.text() if isinstance(c, Node) else c for c in self.children)

    def walk(self, tag=None, cls=None):
        for child in self.children:
            if isinstance(child, Node):
                if (tag is None or child.tag == tag) and (cls is None or cls in child.attrs.get('class', '').split()):
                    yield child
                yield from child.walk(tag, cls)


class Tree(HTMLParser):
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.root = self.current = Node('root')
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        child = Node(tag, attrs, self.current)
        self.current.children.append(child)
        if tag not in self.VOID:
            self.current = child

    def handle_endtag(self, tag):
        node = self.current
        while node.parent:
            if node.tag == tag:
                self.current = node.parent
                break
            node = node.parent

    def handle_data(self, data):
        self.current.children.append(data)


def clean(value):
    return re.sub(r'\s+', ' ', unescape(value).replace('’', "'").replace('\u00ad', '')).strip().casefold()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, default=Path('/private/tmp/ssat-middle-vocabulary-research'))
    parser.add_argument('--out-dir', type=Path, default=ROOT / 'vocabulary_research')
    args = parser.parse_args()
    cache, output = args.cache_dir, args.out_dir
    if (output / 'online_vocabulary.json').exists():
        parser.error('This output already contains a research snapshot. Use --out-dir with a new directory to preserve the historical expansion baseline.')
    cache.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    sources, occurrences = [], defaultdict(set)

    def fetch(url, filename):
        target = cache / filename
        if not target.exists():
            result = subprocess.run(['curl', '-L', '--fail', '--silent', '--show-error', '--max-time', '30', url, '-o', str(target)], capture_output=True, text=True)
            if result.returncode:
                if target.exists():
                    target.unlink()
                raise RuntimeError(result.stderr.strip())
        return target

    def add(sid, title, url, scope, kind, words, *, family='', status='collected', notes='', file=None, expected=None):
        words = sorted(set(clean(w) for w in words if clean(w)))
        # Preserve questionable source spellings in the manifest, while keeping
        # them out of the canonical word list until reviewed. No silent fixes.
        excluded = []
        if sid.startswith('brainscape-'):
            problems = {'apititude': 'Likely aptitude: source describes natural ability.', 'guille': 'Likely guile: source describes dishonest methods.', 'dubious man': 'Prompt typo: man appears in place of mean; intended word is dubious.'}
            excluded = [{'form': word, 'reason': problems[word]} for word in words if word in problems]
            words = [word for word in words if word not in problems]
            if 'the renaissance' in words:
                words.remove('the renaissance')
                words.append('renaissance')
                notes += ' Removed the article from the prompt "the Renaissance".'
        invalid = [w for w in words if len(w) > 60 or not re.fullmatch(r"[a-zà-ž]+(?:[ '\-][a-zà-ž]+)*", w)]
        if invalid:
            raise ValueError(f'{sid}: invalid headwords {invalid}')
        item = dict(id=sid, title=title, url=url, scope=scope, kind=kind, family=family or sid, status=status, notes=notes, words=words, extracted_count=len(words))
        if excluded:
            item['excluded_source_forms'] = excluded
        if expected is not None:
            item['advertised_count'] = expected
        if file:
            item['sha256'] = hashlib.sha256(Path(file).read_bytes()).hexdigest()
        sources.append(item)
        for word in words:
            occurrences[word].add(sid)
        print(f'{sid}: {len(words)} [{scope}; {status}]', flush=True)

    def html(filename):
        return Tree((cache / filename).read_text()).root

    initial_pages = {
        'test-ninjas.html': 'https://test-ninjas.com/ssat-middle-level-vocabulary-word-list',
        'brainscape-pack.html': 'https://www.brainscape.com/packs/vocabulary-ssat-middle-level-12601191',
        'crackssat.html': 'https://www.crackssat.com/ssat/prep/94.html',
        'vocabulary-308998.html': 'https://www.vocabulary.com/lists/308998',
        'learnthat.html': 'https://www.learnthat.org/word_lists/view/98832',
        'whotutors.pdf': 'https://www.whotutors.com/resource_redirect/downloads/file-uploads/sites/2148740314/themes/2163491751/downloads/8ab4c41-7b2d-a82c-5276-3e4241adcc3_Vocab_List_2025.pdf',
    }
    for filename, url in initial_pages.items():
        fetch(url, filename)

    # The publisher's dedicated, explicitly Middle Level list.
    filename = 'princeton-middle.pdf'
    path = fetch('https://cdn.princetonreview.com/ResourceContent/Teacher/pdfs/SSAT/Teacher_Documents/Middle_Vocabulary_SSAT.pdf', filename)
    text = subprocess.check_output(['pdftotext', '-layout', str(path), '-'], text=True)
    words = [cell.strip() for line in text.splitlines() for cell in re.split(r'\s{2,}', line.strip()) if re.fullmatch(r'[a-z]+', cell.strip())]
    add('princeton-middle', 'The Princeton Review: Middle Level Vocabulary for the SSAT', 'https://cdn.princetonreview.com/ResourceContent/Teacher/pdfs/SSAT/Teacher_Documents/Middle_Vocabulary_SSAT.pdf', 'middle_specific', 'publisher_list', words, family='princeton', file=path)

    # Only the vocabulary table, not surrounding roots, directions, or examples.
    tables = list(html('test-ninjas.html').walk('table'))
    vocabulary_table = next(t for t in tables if all(w in t.text() for w in ['Sample Use', 'Part of Speech']))
    words = [list(row.walk('td'))[0].text().strip() for row in vocabulary_table.walk('tr') if list(row.walk('td'))]
    add('test-ninjas-middle', 'Test Ninjas: Middle Level vocabulary table', 'https://test-ninjas.com/ssat-middle-level-vocabulary-word-list', 'middle_specific', 'prep_list', words, file=cache / 'test-ninjas.html', expected=102, notes='The advertised count is recorded separately from the rows actually exposed in the table; marketing claims about test coverage are not adopted.')

    # Public flashcard questions contain the target headword. Answers are unused.
    pack = html('brainscape-pack.html')
    deck_urls = sorted({urljoin('https://www.brainscape.com', n.attrs['href']) for n in pack.walk('a') if re.match(r'/flashcards/lesson-\d+-\d+/packs/12601191', n.attrs.get('href', ''))}, key=lambda u: int(re.search(r'lesson-(\d+)', u)[1]))
    assert len(deck_urls) == 30, 'Expected all 30 public deck links'

    def get_deck(url):
        number = int(re.search(r'lesson-(\d+)', url)[1])
        path = fetch(url, f'brainscape-lesson-{number}.html')
        tree = Tree(path.read_text()).root
        words, rejected = [], []
        for question in tree.walk('div', 'question-contents'):
            face = next(question.walk('div', 'scf-face'), None)
            prompt = clean(face.text()).rstrip('`?. ') if face else ''
            prompt = re.sub(r'\s*\((?:adj|adv|n|v|verb|noun)\.?\)', '', prompt)
            match = re.fullmatch(r'what (?:does|is) (?:an? )?(.+?)(?: mean)?', prompt)
            if match:
                word = re.sub(r'\s*\(?\b(?:adj|adv|verb|noun)\b\)?\.?$', '', match[1]).strip()
                words.append(word)
            else:
                rejected.append(prompt)
        return number, url, path, words, rejected

    with ThreadPoolExecutor(max_workers=4) as pool:
        decks = list(pool.map(get_deck, deck_urls))
    for number, url, path, words, rejected in decks:
        add(f'brainscape-middle-{number:02}', f'Brainscape: Professor Meow Middle Level lesson {number}', url, 'middle_specific', 'community_flashcards', words, family='brainscape-professor-meow', file=path, notes='User-labeled Middle Level; difficulty and spelling require editorial review.' + (f' Unparsed public prompts: {rejected}' if rejected else ''))

    # Additional packs: select only explicitly Middle/Mid-level decks, excluding
    # Upper Level decks, unrelated ISEE material, and mathematical fact cards.
    extra_packs = [
        ('drake', 'https://www.brainscape.com/packs/ssat-prep-drake-21502129', 'brainscape-drake.html', '/flashcards/mid-level-day-', 'middle_specific'),
        ('nick', 'https://www.brainscape.com/packs/isee-ssat-middle-4557032', 'brainscape-nick.html', '/flashcards/isee-ssat-middle-week-', 'mixed_middle_ssat_isee'),
        ('kitty', 'https://www.brainscape.com/packs/my-ssat-words-22345014', 'brainscape-kitty.html', '/flashcards/middle', 'middle_specific'),
    ]
    tasks = []
    for family, url, filename, prefix, scope in extra_packs:
        tree = Tree(fetch(url, filename).read_text()).root
        for node in tree.walk('a'):
            href = node.attrs.get('href', '')
            if href.startswith(prefix):
                title_node = next(node.walk('div', 'deck-item-name'), None)
                title = clean(title_node.text()) if title_node else href.split('/')[2].rsplit('-', 1)[0].replace('-', ' ')
                count_node = next(node.walk('div', 'deck-item-count'), None)
                expected = int(re.search(r'\d+', count_node.text())[0]) if count_node else None
                tasks.append((family, urljoin(url, href), scope, title, expected))

    def get_plain_deck(task):
        family, url, scope, title, expected = task
        deck_id = re.search(r'-(\d+)/packs/', url)[1]
        path = fetch(url, f'brainscape-extra-{deck_id}.html')
        tree = Tree(path.read_text()).root
        words, rejected = [], []
        for question in tree.walk('div', 'question-contents'):
            face = next(question.walk('div', 'scf-face'), None)
            prompt = clean(face.text()).rstrip('?. ') if face else ''
            prompt = re.sub(r'\s*\((?:adj|adv|n|v|verb|noun)\.?\)', '', prompt)
            if re.fullmatch(r"[a-zà-ž]+(?:[ '\-][a-zà-ž]+){0,2}", prompt):
                words.append(prompt)
            else:
                rejected.append(prompt)
        return family, deck_id, url, scope, title, path, words, rejected, expected, len(list(tree.walk('div', 'question-contents')))

    with ThreadPoolExecutor(max_workers=4) as pool:
        extra_decks = list(pool.map(get_plain_deck, tasks))
    for family, deck_id, url, scope, title, path, words, rejected, expected, visible in extra_decks:
        partial = bool(rejected) or expected is not None and visible < expected
        add('brainscape-' + family + '-' + deck_id, 'Brainscape: ' + title, url, scope, 'community_flashcards', words, family='brainscape-' + family, file=path, status='partial' if partial else 'collected', expected=expected, notes=f'Only {visible} publicly rendered question faces were used; the source advertises {expected} cards. User-provided level labels are unverified. "Official guide" in a deck title is the user’s claim, not a publisher endorsement.' + (f' Excluded {len(rejected)} prompts that were not clean headwords; their authored text is not redistributed.' if rejected else ''))

    # Vocab Voyage intentionally exposes a sample of at most 50 words.
    voyage_url = 'https://gponcrussdahcdyrlhcr.supabase.co/functions/v1/vocab-api/course-word-list?course_slug=ssat-middle-level&limit=50'
    data = json.loads(fetch(voyage_url, 'vocab-voyage-middle.json').read_text())
    add('vocab-voyage-middle', 'Vocab Voyage: SSAT Middle Level public course sample', voyage_url, 'middle_specific', 'public_api_sample', [item['word'] for item in data['words']], status='partial', expected=100, file=cache / 'vocab-voyage-middle.json', notes='Public API documentation describes this endpoint as a sample, with a 50-word maximum. No pagination is documented; full-course coverage is not claimed.')

    # An explicitly mixed SSAT/ISEE Middle Level checklist.
    crack = html('crackssat.html')
    body = next(n for n in crack.walk('div') if n.attrs.get('id') == 'conl')
    words = [n.text().strip() for n in body.walk('div') if re.fullmatch(r'[a-z]+', n.text().strip())]
    add('crackssat-middle', 'CrackSSAT: SSAT and ISEE Middle Level vocabulary', 'https://www.crackssat.com/ssat/prep/94.html', 'mixed_middle_ssat_isee', 'prep_list', words, expected=50, file=cache / 'crackssat.html')

    vocabulary_path = cache / 'vocabulary-308998.html'
    words = [n.text() for n in html(vocabulary_path.name).walk('a', 'word')]
    add('vocabulary-middle-308998', 'Vocabulary.com: September 2013 Middle Level SSAT & ISEE', 'https://www.vocabulary.com/lists/308998', 'mixed_middle_ssat_isee', 'community_list', words, expected=102, file=vocabulary_path, notes='Headwords only. Community definitions contain errors and are not imported.')

    # Larger lists with no reliable mapping to Middle Level remain supplemental.
    for difficulty, expected in [('easy', 612), ('medium', 308), ('hard', 580)]:
        path = fetch(f'https://examvocabbuilder.com/words/level/{difficulty}', f'examvocabbuilder-{difficulty}.html')
        words = [n.text() for n in Tree(path.read_text()).root.walk('a') if re.fullmatch(r'/words/[a-z][a-z-]*/?', n.attrs.get('href', ''))]
        add(f'examvocabbuilder-{difficulty}', f'Exam Vocabulary Builder: {difficulty} ISEE/SSAT words', f'https://examvocabbuilder.com/words/level/{difficulty}', 'mixed_levels_supplemental', 'prep_library', words, family='examvocabbuilder', expected=expected, file=path, notes='The site combines ISEE/SSAT and multiple levels. Easy/medium/hard is its own difficulty scale, not an SSAT Middle Level classification.')

    words = []
    for node in html('learnthat.html').walk('small', 'chapter_words'):
        # The public response truncates each unit mid-list. Discard its final
        # fragment rather than accidentally treating e.g. "caut" as a word.
        words.extend(node.text().split(',')[:-1])
    add('learnthat-98832', 'LearnThat: Ssat20', 'https://www.learnthat.org/word_lists/view/98832', 'mixed_levels_supplemental', 'community_list', words, expected=496, status='partial', file=cache / 'learnthat.html', notes='Tagged Middle school and SSAT, without an exam-level guarantee. The page advertises units of 300 and 196 words, but the direct public response truncates both lists. Final fragments were excluded. Includes advanced terms.')
    path = cache / 'whotutors.pdf'
    text = subprocess.check_output(['pdftotext', '-layout', str(path), '-'], text=True)
    words = re.findall(r'^\s*\d{1,2}\s+\d{1,2}\s+([A-Z]+(?:[ -][A-Z]+)*)\s*$', text, flags=re.M)
    add('whotutors-400', 'Who Tutors: ISEE/SSAT Vocabulary List 11–30', 'https://www.whotutors.com/resource_redirect/downloads/file-uploads/sites/2148740314/themes/2163491751/downloads/8ab4c41-7b2d-a82c-5276-3e4241adcc3_Vocab_List_2025.pdf', 'mixed_levels_supplemental', 'tutor_list', words, file=path, expected=400, notes='Publicly linked from whotutors.com. Multiple exams/levels; source spellings are preserved, including entries needing review.')

    benchmarks = json.loads((ROOT / 'tools/vocabulary-benchmarks.json').read_text())
    for key, title, url in [('core75', 'Ivy Global: 75 Core SSAT Words', 'https://downloads.ivyglobal.com/ssat/segments/English_75_Core_SSAT_Words.pdf'), ('essential125', 'Ivy Global: SSAT & ISEE Vocabulary 1', 'https://downloads.ivyglobal.com/ssat/SSAT_ISEE_Vocabulary_1.pdf')]:
        add('ivy-' + key, title, url, 'mixed_levels_supplemental', 'publisher_list', benchmarks[key], family='ivy', status='previously_verified_manifest', notes='Reused the repository’s previously verified benchmark headwords. Fresh PDF retrieval failed with a TLS hostname error; not counted as a new download.')

    # Public practice PDFs already downloaded in this project supply independent
    # evidence of target vocabulary. Import synonym targets only, no test text.
    downloads = {
        'ivy_middle_full_test.pdf': dict(title='Ivy Global: full Middle Level practice test', source='https://downloads.ivyglobal.com/ssat/middle_test_1/SSAT%20Middle%20Level%20Test%201%20v%201.6.pdf', download_url='https://web.archive.org/web/20191113103643id_/https://downloads.ivyglobal.com/ssat/middle_test_1/SSAT%20Middle%20Level%20Test%201%20v%201.6.pdf'),
        'princeton_middle_full_test.pdf': dict(title='Princeton Review: full Middle Level practice test', source='https://content.randomhouse.com/assets/9780804126403/pdfs/Middle%20Level%20SSAT%20Practice%20Test.pdf', download_url='https://d10tqtvpzsk3q2.cloudfront.net/assets/9780804126403/pdfs/Middle%20Level%20SSAT%20Practice%20Test.pdf'),
        'test_ninjas_middle_full_test.pdf': dict(title='Test Ninjas: full Middle Level practice test', source='https://test-ninjas.com/free/ssat/test-ninjas-ssat-middle-level-practice-test-1.pdf', download_url='https://test-ninjas.com/free/ssat/test-ninjas-ssat-middle-level-practice-test-1.pdf'),
    }
    report_path = ROOT / 'reading_materials/download_report.json'
    if report_path.exists():
        downloads.update({item['file']: item for item in json.loads(report_path.read_text())['items']})
    for sid, filename, family in [
        ('ivy-practice-synonyms', 'ivy_middle_full_test.pdf', 'ivy'),
        ('princeton-practice-synonyms', 'princeton_middle_full_test.pdf', 'princeton'),
        ('ninjas-practice-synonyms', 'test_ninjas_middle_full_test.pdf', 'test-ninjas-middle'),
    ]:
        path = ROOT / 'reading_materials' / filename
        if not path.exists():
            path = fetch(downloads[filename]['download_url'], filename)
        text = subprocess.check_output(['pdftotext', '-layout', str(path), '-'], text=True)
        if family == 'test-ninjas-middle':
            section = text.split('Part 1 · Synonyms')[1].split('Part 2')[0]
            words = [cell.strip() for line in section.splitlines() for cell in re.split(r'\s{2,}', line.strip()) if re.fullmatch(r'[A-Z]+', cell.strip())]
        else:
            pairs = re.findall(r"(?<!\d)(\d{1,2})\.\s+([A-Z][A-Z'-]+):", text)
            assert sorted(int(number) for number, word in pairs) == list(range(1, 31)), sid
            words = [word for number, word in pairs]
        assert len(words) == 30, sid
        add(sid, downloads[filename]['title'] + ' — synonym targets', downloads[filename]['source'], 'middle_specific', 'practice_synonym_targets', words, family=family, expected=30, status='previously_downloaded_public_pdf', file=path, notes='Extracted the 30 synonym target headwords from the explicitly Middle Level test. Directions, choices, questions and solutions are not copied. Original download URL: ' + downloads[filename]['download_url'])

    # Keep inaccessible discoveries in the catalog, not in the word totals.
    unavailable = [
        ('midssat', 'MidSSAT vocabulary library', 'https://www.midssat.com/vocabulary/word-lists', 'middle_specific', 1863, 'Indexed landing page advertises 1,863 entries (513 SSAT plus grade lists). DNS resolution failed, including outside the sandbox; no headwords collected.'),
        ('quizlet-655353669', 'Quizlet: 2025/2026 Middle Level SSAT Vocabulary', 'https://quizlet.com/655353669/20252026-middle-level-ssat-vocabulary-flash-cards/', 'middle_specific', 361, 'HTTP 403. Search-index previews were used for discovery only; advertised count is not counted as extracted.'),
        ('quizlet-394582059', 'Quizlet: SSAT Vocabulary (middle level)', 'https://quizlet.com/394582059/ssat-vocabularymiddle-level-flash-cards/', 'middle_specific', 400, 'Search-index discovery only; public Quizlet extraction is blocked. No definitions or incomplete search previews imported.'),
        ('quizlet-150399180', 'Quizlet: SSAT Middle Level Vocabulary', 'https://quizlet.com/150399180/ssat-middle-level-vocabulary-flash-cards/', 'middle_specific', 472, 'Search-index discovery only. Preview contains questionable synonym pairs; editorial review required.'),
        ('quizlet-pasquale', 'Pasquale Spano / IvyPrep: SSAT folder', 'https://quizlet.com/pasquale_spano/folders/ssat', 'mixed_levels_supplemental', None, 'Tutor describes 2,000+ words for Middle and Upper levels. Discovery only; the count is not verified or added to totals.'),
    ]
    for sid, title, url, scope, count, note in unavailable:
        add(sid, title, url, scope, 'discovered_resource', [], status='not_collected', expected=count, notes=note)

    page = (ROOT / 'ssat_middle_vocabulary.html').read_text()
    start = re.search(r'\bconst RAW_WORDS\s*=\s*', page).end()
    raw = json.JSONDecoder().raw_decode(page[start:])[0]
    existing = {clean(line.split('|')[0]) for line in raw.splitlines() if not line.startswith('@')}
    source_map = {s['id']: s for s in sources}
    rows = []
    for word, ids in sorted(occurrences.items()):
        scopes = sorted({source_map[sid]['scope'] for sid in ids})
        families = sorted({source_map[sid]['family'] for sid in ids})
        rows.append(dict(word=word, in_current_bank=word in existing, middle_specific='middle_specific' in scopes, mixed_middle='mixed_middle_ssat_isee' in scopes, source_count=len(ids), source_family_count=len(families), source_ids=sorted(ids), scopes=scopes))
    # Visible headwords are research candidates, not automatically approved lessons.
    document = dict(collected_on=date.today().isoformat(), normalization='Casefold, whitespace and typographic apostrophes only; no stemming or silent spelling corrections.', disclaimer='A finite public-web search, not an official or exhaustive SSAT syllabus. Entries are source-labeled candidates; source selection is not editorial approval.', sources=sources, words=rows)
    (output / 'online_vocabulary.json').write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')
    fields = ['word', 'in_current_bank', 'middle_specific', 'mixed_middle', 'source_count', 'source_family_count', 'source_ids', 'scopes']
    with (output / 'online_vocabulary.csv').open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator='\n')
        writer.writeheader()
        writer.writerows({k: ';'.join(row[k]) if isinstance(row[k], list) else row[k] for k in fields} for row in rows)
    groups = {
        'all_online_candidates': rows,
        'middle_specific': [r for r in rows if r['middle_specific']],
        'middle_including_mixed_isee': [r for r in rows if r['middle_specific'] or r['mixed_middle']],
        'missing_from_current_bank': [r for r in rows if not r['in_current_bank']],
        'missing_middle_candidates': [r for r in rows if not r['in_current_bank'] and (r['middle_specific'] or r['mixed_middle'])],
        'publisher_middle_missing': [r for r in rows if not r['in_current_bank'] and any(source_map[sid]['scope'] == 'middle_specific' and source_map[sid]['kind'] in {'publisher_list', 'prep_list', 'practice_synonym_targets'} for sid in r['source_ids'])],
    }
    for name, items in groups.items():
        (output / (name + '.txt')).write_text(''.join(r['word'] + '\n' for r in items))
    counts = {name: len(items) for name, items in groups.items()}
    report = [
        '# Online SSAT Middle Level vocabulary research', '',
        f'Collected {date.today().isoformat()}. Compared with the current {len(existing):,}-word practice bank.', '',
        'This is a broad, finite search of public vocabulary resources. There is no official exhaustive SSAT word list ([Ivy Global FAQ](https://www.ssatprep.com/ssat-faq/)). These are source-labeled vocabulary candidates, not a guarantee of exam coverage or a claim that every candidate is appropriate for every Middle Level student.', '',
        '| Measure | Unique candidates |', '| --- | ---: |',
        *[f'| {name.replace("_", " ")} | {count:,} |' for name, count in counts.items()], '',
        '## Files', '',
        '- `middle_specific.txt`: words from sources or decks explicitly labeled SSAT Middle/Mid Level, including community labels.',
        '- `middle_including_mixed_isee.txt`: the preceding set plus explicitly Middle Level SSAT/ISEE sources.',
        '- `publisher_middle_missing.txt`: the first review queue, limited to missing words in the dedicated Princeton Review list, Test Ninjas list, and three Middle Level practice tests.',
        '- `missing_middle_candidates.txt`: a larger review queue that includes community Middle Level decks.',
        '- `all_online_candidates.txt`: all collected candidates, including separately classified mixed-level material.',
        '- `missing_from_current_bank.txt`: all collected candidates without an exact headword in the current bank.',
        '- `online_vocabulary.csv`: one row per word, with source IDs, scope, and current-bank match.',
        '- `online_vocabulary.json`: the complete word/source manifest, retrieval status, source word sets, exclusions and file hashes.', '',
        '## What the labels mean', '',
        '`middle_specific` records the source’s label, not an independent difficulty certification. `mixed_middle_ssat_isee` combines two exams at Middle Level. `mixed_levels_supplemental` includes multiple levels or has an insufficiently specific level label. Community decks can contain advanced, unusual, inflected, or misspelled entries.', '',
        'Exact matching lowercases words and normalizes whitespace and apostrophes. It does not merge related forms or infer knowledge of another meaning. A missing entry may have a related word already taught. Repeated sources or cards do not create new words; source counts are provenance counts, not evidence of test frequency.', '',
        'Only headwords are compiled. Publisher definitions, example sentences, flashcard answers and complete test questions are not included. Known malformed community forms are retained as exclusions in the manifest; they are not silently changed into new lessons.', '',
        '## Access and completeness', '',
        'The 30 Professor Meow lessons expose their full 20-card decks (24 in the last deck). Other Brainscape decks expose only a preview, often 24 cards: their unseen cards are not counted. Vocab Voyage exposes at most 50 sample words. The LearnThat response truncates both advertised units; trailing fragments were removed. Quizlet requests were blocked and MidSSAT did not resolve, so their advertised totals are not included. Two existing Ivy benchmark manifests and three previously downloaded public practice PDFs are explicitly marked as reused evidence.', '',
        'The three additional Brainscape collections were filtered to Mid/Middle Level decks. Explicit Upper Level decks, unrelated ISEE decks and mathematical fact cards were excluded. Similarly named Ruby/Hailey/Mahlia ML master-list packs advertise the same 604-card lesson structure as Professor Meow. These remain additional search leads; identical content was not assumed and their advertised counts were not added to collected totals.', '',
        'Public catalog leads with no collected headwords include [Smartize Middle Level 1,000-word prep](https://www.smartizelearning.com/news/), [Middle Level SSAT practice on Teachers Pay Teachers](https://www.teacherspayteachers.com/Product/Middle-Level-SSAT-Vocabulary-Synonym-and-Analogy-Practice-3704137), and [the tutor’s 2,000+ mixed-level Quizlet folder](https://quizlet.com/pasquale_spano/folders/ssat). These are further leads, not verified additions.', '',
        '## Source inventory', '',
        '| ID / link | Scope | Collected unique words | Status | Advertised entries or cards |',
        '| --- | --- | ---: | --- | ---: |',
    ]
    for item in sources:
        report.append(f'| [{item["id"]}]({item["url"]}) | {item["scope"]} | {item["extracted_count"]} | {item["status"]} | {item.get("advertised_count", "—")} |')
    report.extend(['', '## Reproduce', '', 'Run `python3 tools/collect_online_vocabulary.py` from the repository root. Cached downloads default to `/private/tmp/ssat-middle-vocabulary-research`; `--cache-dir` and `--out-dir` override those paths. Python uses only its standard library; `curl` and Poppler’s `pdftotext` are required. Existing public practice PDFs can be supplied through `reading_materials/` or are retrieved from the original download manifest. Remove a cached file to refresh that source.', '', 'Practice-page content and student progress are unchanged by this research collector. Editorial review, original definitions/examples, and difficulty checks are needed before any candidates become lessons.', ''])
    (output / 'README.md').write_text('\n'.join(report))
    print('TOTALS', json.dumps({name: len(items) for name, items in groups.items()}), flush=True)


if __name__ == '__main__':
    main()

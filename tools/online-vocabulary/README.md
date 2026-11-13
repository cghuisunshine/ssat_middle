# Online Middle Level expansion

These seven UTF-8 text files contain all 1,598 exact forms in the historical research queue `vocabulary_research/missing_middle_candidates.txt`. Each row is:

```
word|part of speech|original definition|Chinese gloss|closest synonym or paraphrase|original context sentence
```

Definitions, translations, and examples were authored for this page rather than copied from the collected lists. Each example contains its exact target once. Accents, spaces, inflections, and source spellings remain distinct IDs. Existing word IDs and progress storage are unchanged.

`notes.json` adds 46 teaching notes and memory cues, including spelling distinctions, rare terms, and dated or offensive usage. The unverified community spelling **obstrusion** is retained as a visible audit entry, with a review warning and no asserted dictionary meaning. It is excluded from flashcards, quiz targets, and distractors. Its placeholder text is not a vocabulary lesson to memorize.

`tools/online_vocabulary.py` checks the exact 1,598-form set and attaches the collected Middle Level source IDs from the historical manifest. The 219 candidates in `publisher_middle_missing.txt` use the Core study tier; the other 1,379 use Stretch. These are editorial organization choices, not an official level or exam-frequency classification. Sources explicitly combining Middle Level SSAT and ISEE retain that label. Community labels and partial-preview status remain visible in word details.

Rebuild with `python3 tools/update_vocabulary.py`. The finished HTML embeds the content, provenance, and explanations; practice never fetches the source pages. Run `node tools/check_vocabulary.cjs`, `node tools/check_prebuilt_explanations.cjs`, and `node tools/check_students.cjs` to verify exact coverage, every eligible word-question variant, source references, Unicode context blanks, review exclusions, and profile/progress preservation.

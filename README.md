# SSAT Middle Level vocabulary practice

Open [the contents page](content.html) or [vocabulary practice](ssat_middle_vocabulary.html) directly in a browser. The practice page is self-contained and works offline; reviews, stars, and custom words stay in browser storage.

The expanded bank contains 950 words with context sentences, 40 additional meanings, 36 groups of related words, and 85 analogy questions. It includes every headword in the two Ivy Global sample lists checked in the [coverage audit](vocabulary_coverage_audit.md). These are preparation benchmarks, not an official exhaustive SSAT word list.

Expansion source files are in `tools/`. Definitions, translations, and sentences are original practice content. `vocabulary-benchmarks.json` records headwords from the publisher's [75-word core sample](https://downloads.ivyglobal.com/ssat/segments/English_75_Core_SSAT_Words.pdf) and [125-word essential sample](https://downloads.ivyglobal.com/ssat/SSAT_ISEE_Vocabulary_1.pdf).

After changing the expansion sources, rebuild the embedded data and UI, then run the data and behavior checks:

```sh
python3 tools/update_vocabulary.py
node tools/check_vocabulary.cjs
```

The builder preserves existing word IDs, the browser storage key, and the first 60 analogy IDs. It updates the contents-page counts and requires a context sentence for every built-in word. No build tools are needed to use the finished HTML page.

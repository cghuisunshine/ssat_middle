# SSAT Middle Level vocabulary practice

Open [the contents page](content.html) or [vocabulary practice](ssat_middle_vocabulary.html) directly in a browser. The practice page is self-contained and works offline; reviews, stars, and custom words stay in browser storage.

The expanded bank contains 950 words with context sentences, 40 additional meanings, 36 groups of related words, and 85 analogy questions. It includes every headword in the two Ivy Global sample lists checked in the [coverage audit](vocabulary_coverage_audit.md). These are preparation benchmarks, not an official exhaustive SSAT word list.

In ordinary Practice sessions, **Check answer** shows the built-in result immediately and then requests an AI explanation using the same endpoint as Physics11 practice: `https://lakesideart.gochatus.org/grade-service/general`. Explanations discuss the exact meaning or analogy relationship, the answer choices, a new example, and a memory tip. Chinese support follows the Chinese toggle. Only the checked question, choices, answer, and reference explanation are sent; names and progress history are not included. Responses stay in the current session and never change grades or review records.

AI explanations require internet. Network errors and timeouts leave the built-in feedback available and offer a retry. Moving to another question or leaving Practice cancels pending requests. Skipping does not automatically send a request, but offers an explicit explanation button. The timed drill does not request AI explanations while answering.

Expansion source files are in `tools/`. Definitions, translations, and sentences are original practice content. `vocabulary-benchmarks.json` records headwords from the publisher's [75-word core sample](https://downloads.ivyglobal.com/ssat/segments/English_75_Core_SSAT_Words.pdf) and [125-word essential sample](https://downloads.ivyglobal.com/ssat/SSAT_ISEE_Vocabulary_1.pdf).

After changing the expansion sources, rebuild the embedded data and UI, then run the data and behavior checks:

```sh
python3 tools/update_vocabulary.py
node tools/check_vocabulary.cjs
node tools/check_ai_explanations.cjs
```

The builder preserves existing word IDs, the browser storage key, and the first 60 analogy IDs. It updates the contents-page counts and requires a context sentence for every built-in word. No build tools are needed to use the finished HTML page.

The AI behavior checks use a simulated service to cover successful and failed responses, retries, offline behavior, timeouts, safe text rendering, language changes, duplicate requests, cancellation, and grade preservation. The endpoint was also tested with a real text-only request and a browser check after selecting an answer.

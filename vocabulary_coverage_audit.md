# SSAT Middle Level vocabulary coverage audit

Checked: October 29, 2026. File: `ssat_middle_vocabulary.html`.

## After the practice-page update

The gaps identified in the two checked sample lists are now closed. The bank has **950 unique words**, including the 130 missing benchmark headwords and 20 additional related forms. Every word has an original example sentence and is eligible for context practice.

| Measure | Before | After |
| --- | ---: | ---: |
| Unique headwords | 800 | 950 |
| Words with context sentences | 75 | 950 |
| Core sample headwords present | 25 / 75 | 75 / 75 |
| Publisher's levels 5–7 subset present | 11 / 40 | 40 / 40 |
| Essential sample headwords present | 42 / 125 | 125 / 125 |
| Additional meanings with separate examples | 0 | 40 |
| Groups of related words with links between entries | 0 | 36 |
| Analogy questions | 60 | 85 |
| Minimum questions per represented analogy relationship | 1 | 5 |

Alternate meanings appear in flashcards and word details, participate in quizzes, and are searchable in the library. Synonym questions give a sentence cue when a word has multiple taught meanings. Existing progress remains tied to the same word IDs and storage key; earlier custom entries that are now built in retain their review records without creating duplicate words.

Validation: `node tools/check_vocabulary.cjs` checks all 3,960 quiz variants across 990 taught word senses, benchmark coverage, example blanks, answer-choice uniqueness, saved-progress compatibility, filtered context sessions, and the 60-question timed drill. Browser checks confirmed the alternate-meaning panel and context-question feedback. These checks establish data and application behavior, not an external editorial certification of every sentence or possible distractor.

Remaining scope: neither sample list is an official or exhaustive Middle Level syllabus, and both are from one publisher. Secondary meanings and word-family links cover selected entries; further expansion using independent sources and official practice is still useful. Sample-list completion must not be presented as complete exam coverage.

The original audit follows as a record of the 800-word version.

## Original finding

The current bank is a broad starting resource, but it does **not** cover a demonstrably complete Middle Level vocabulary set. It also omits many entries from the published sample lists checked below. Its existing description as a broad, non-exhaustive study bank is accurate.

There is no published official exhaustive SSAT word list against which “100% coverage” can be certified. [Ivy Global’s SSAT FAQ](https://www.ssatprep.com/ssat-faq) explicitly notes the absence of an official list. Its lists are preparation samples, not the test maker’s syllabus. Their overlap percentages below are **not percentages of exam coverage** and do not predict a score.

## Bank inventory

| Item | Verified count |
| --- | ---: |
| Unique headwords | 800 |
| Foundation / Core / Stretch | 150 / 450 / 200 |
| Topic labels | 32 |
| Adjectives / verbs / nouns / adverbs | 328 / 264 / 193 / 15 |
| Entries with English definition, Chinese meaning, and synonym | 800 |
| Words with example sentences and context-quiz eligibility | 75 (9.4%) |
| Words without example sentences | 725 |
| Analogy questions / relationship types | 60 / 14 |
| Prefix, root, and suffix cards | 54 |

These are structural checks. Nonempty fields do not establish that every definition, translation, synonym, or practice question is accurate.

## Published-list comparison

Matching used exact, case-insensitive headwords. A word mentioned only as a synonym, in an analogy, or in a root example does not receive credit as a learnable entry. Inflections and related word forms were not merged. For example, knowing a noun may help with its adjective, but it does not establish that the adjective has been taught.

| Benchmark | Own entries present | Missing | Exact headword overlap |
| --- | ---: | ---: | ---: |
| Ivy Global, 75 Core SSAT Words (Middle and Upper) | 25 / 75 | 50 | 33.3% |
| Publisher’s levels 5–7 subset of those 75 words | 11 / 40 | 29 | 27.5% |
| Ivy Global, SSAT & ISEE Vocabulary 1 (Essential) | 42 / 125 | 83 | 33.6% |

Sources: [75 Core SSAT Words](https://downloads.ivyglobal.com/ssat/segments/English_75_Core_SSAT_Words.pdf), [Vocabulary 1](https://downloads.ivyglobal.com/ssat/SSAT_ISEE_Vocabulary_1.pdf), and the [publisher’s vocabulary page](https://www.ssatprep.com/ssat-vocabulary/).

The first benchmark is concentrated in relationships and emotions; the second serves both SSAT and ISEE. Neither is a comprehensive or exclusively Middle Level standard. The publisher’s level labels approximately correspond to grade, but are not official SSAT difficulty ratings. Both lists come from the same publisher, so this is a targeted gap check, not a survey of independent prep curricula.

### First priority: missing words labeled levels 5–7 in the core sample

compatible, sentimental, engaging, gracious, courteous, tact, headstrong, exasperate, infuriate, mock, malicious, belittle, jeer, condescend, disdain, hypocrite, animated, submissive, initiate, fatigue, feeble, industrial, resolute, emphatic, withstand, plight, predicament, strenuous, toil.

### All missing headwords in the 75-word core sample

admonish, animated, apathetic, belittle, charismatic, compatible, condescend, congenial, courteous, disdain, emphatic, emulate, engaging, exasperate, extrovert, fatigue, feeble, fidelity, fret, gracious, headstrong, hypocrite, hysterical, industrial, infuriate, initiate, introvert, jeer, malicious, mock, nonchalant, passive, plight, pragmatic, predicament, reserved, resolute, rigor, robust, sentimental, snub, steadfast, strenuous, subdued, submissive, tact, toil, valiant, vivacious, withstand.

Six of these appear in the bank’s synonym fields, but lack their own entries: courteous, feeble, initiate, predicament, robust, submissive. Such mentions provide exposure but lack a dedicated definition, flashcard, and target-word review.

### All missing headwords in the 125-word essential sample

adorn, aesthetic, aggravate, amateur, ambiance, animosity, bemuse, bewilder, blend, bliss, boisterous, brandish, capitulate, chasm, circumvent, collaborate, conjecture, conservative, contend, courtesy, creed, dearth, debacle, deduct, delight, efface, elation, embrace, enigma, erratic, exalt, exonerate, expel, extravagant, feeble, ferocity, fiasco, flamboyant, gaffe, glitch, hoax, idiosyncrasy, impeccable, impertinent, laborious, laud, livid, loquacious, lore, malice, medley, mock, modify, nemesis, overt, pact, painstaking, pester, practical, precocious, prominent, prototype, query, raze, rural, sage, sarcastic, scoff, serene, skeptic, sloth, sly, sporadic, stifle, sympathize, tact, tentative, tolerance, unconventional, vendetta, vital, vulnerable, wicked.

## Other coverage gaps

1. **Context practice covers only 75 words.** The context quiz explicitly restricts its pool to entries in `EXAMPLES`; 725 headwords cannot appear as target words in this mode.
2. **Secondary meanings are incomplete.** The page deliberately teaches one selected sense per word. For example, `partial` teaches “incomplete” but not “biased”; `resolve` teaches determination but not the verb meaning “solve”; `objective` teaches impartiality but not a goal. These are examples of missing senses, not claims about specific future exam items.
3. **Word-family coverage is uneven.** Related forms do not automatically become entries. A systematic pass should connect nouns, verbs, adjectives, and adverbs while preserving their individual meanings and usage.
4. **Analogy coverage has limited depth.** Fourteen relationship labels are represented, but several have only one question. The 60-question bank provides practice, not proof of complete verbal reasoning coverage.

The test maker describes verbal reasoning as 30 synonym and 30 analogy questions, including familiar words and logical relationships. It also identifies deriving word meanings from reading context as a reading skill. This supports checking meanings, usage, and relationships alongside word count. [EMA’s 2023–2024 interpretive guide, printed pages 4–6](https://5232910.fs1.hubspotusercontent-na1.net/hubfs/5232910/Interpretative%20Guides/2023-2024%20EMA%20Middle%20Upper%20Interpretive%20Guide.pdf).

## Recommended completion criteria

- Add the missing levels 5–7 sample words first, with original definitions, Chinese glosses, synonyms, and usable example sentences.
- Review the remaining missing sample words for Middle Level suitability; use Core or Stretch as appropriate rather than treating all publisher words as mandatory.
- Supply context sentences for every headword and add common secondary senses with separate examples.
- Broaden comparison using additional independent Middle Level sources and official practice, maintaining a source-to-entry checklist.
- Continue describing the result as comprehensive preparation coverage rather than a guaranteed exhaustive exam list.

The initial audit was read-only. The subsequent changes and their verification are recorded at the top of this report.

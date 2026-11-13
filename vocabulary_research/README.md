# Online SSAT Middle Level vocabulary research

Collected 2026-11-13. Compared with the then-current 1,100-word practice bank. This historical snapshot is preserved after expansion. The page now represents all 1,598 missing Middle Level–labeled candidates: 1,597 study words plus the unverified spelling “obstrusion,” visibly flagged and excluded from quizzes. See [the authored expansion](../tools/online-vocabulary/README.md).

This is a broad, finite search of public vocabulary resources. There is no official exhaustive SSAT word list ([Ivy Global FAQ](https://www.ssatprep.com/ssat-faq/)). These are source-labeled vocabulary candidates, not a guarantee of exam coverage or a claim that every candidate is appropriate for every Middle Level student.

| Measure | Unique candidates |
| --- | ---: |
| all online candidates | 3,185 |
| middle specific | 1,824 |
| middle including mixed isee | 1,900 |
| missing from current bank | 2,574 |
| missing middle candidates | 1,598 |
| publisher middle missing | 219 |

## Files

- `middle_specific.txt`: words from sources or decks explicitly labeled SSAT Middle/Mid Level, including community labels.
- `middle_including_mixed_isee.txt`: the preceding set plus explicitly Middle Level SSAT/ISEE sources.
- `publisher_middle_missing.txt`: the first review queue, limited to missing words in the dedicated Princeton Review list, Test Ninjas list, and three Middle Level practice tests.
- `missing_middle_candidates.txt`: a larger review queue that includes community Middle Level decks.
- `all_online_candidates.txt`: all collected candidates, including separately classified mixed-level material.
- `missing_from_current_bank.txt`: all collected candidates without an exact headword in the current bank.
- `online_vocabulary.csv`: one row per word, with source IDs, scope, and current-bank match.
- `online_vocabulary.json`: the complete word/source manifest, retrieval status, source word sets, exclusions and file hashes.

## What the labels mean

`middle_specific` records the source’s label, not an independent difficulty certification. `mixed_middle_ssat_isee` combines two exams at Middle Level. `mixed_levels_supplemental` includes multiple levels or has an insufficiently specific level label. Community decks can contain advanced, unusual, inflected, or misspelled entries.

Exact matching lowercases words and normalizes whitespace and apostrophes. It does not merge related forms or infer knowledge of another meaning. A missing entry may have a related word already taught. Repeated sources or cards do not create new words; source counts are provenance counts, not evidence of test frequency.

Only headwords are compiled. Publisher definitions, example sentences, flashcard answers and complete test questions are not included. Known malformed community forms are retained as exclusions in the manifest; they are not silently changed into new lessons.

## Access and completeness

The 30 Professor Meow lessons expose their full 20-card decks (24 in the last deck). Other Brainscape decks expose only a preview, often 24 cards: their unseen cards are not counted. Vocab Voyage exposes at most 50 sample words. The LearnThat response truncates both advertised units; trailing fragments were removed. Quizlet requests were blocked and MidSSAT did not resolve, so their advertised totals are not included. Two existing Ivy benchmark manifests and three previously downloaded public practice PDFs are explicitly marked as reused evidence.

The three additional Brainscape collections were filtered to Mid/Middle Level decks. Explicit Upper Level decks, unrelated ISEE decks and mathematical fact cards were excluded. Similarly named Ruby/Hailey/Mahlia ML master-list packs advertise the same 604-card lesson structure as Professor Meow. These remain additional search leads; identical content was not assumed and their advertised counts were not added to collected totals.

Public catalog leads with no collected headwords include [Smartize Middle Level 1,000-word prep](https://www.smartizelearning.com/news/), [Middle Level SSAT practice on Teachers Pay Teachers](https://www.teacherspayteachers.com/Product/Middle-Level-SSAT-Vocabulary-Synonym-and-Analogy-Practice-3704137), and [the tutor’s 2,000+ mixed-level Quizlet folder](https://quizlet.com/pasquale_spano/folders/ssat). These are further leads, not verified additions.

## Source inventory

| ID / link | Scope | Collected unique words | Status | Advertised entries or cards |
| --- | --- | ---: | --- | ---: |
| [princeton-middle](https://cdn.princetonreview.com/ResourceContent/Teacher/pdfs/SSAT/Teacher_Documents/Middle_Vocabulary_SSAT.pdf) | middle_specific | 208 | collected | — |
| [test-ninjas-middle](https://test-ninjas.com/ssat-middle-level-vocabulary-word-list) | middle_specific | 102 | collected | 102 |
| [brainscape-middle-01](https://www.brainscape.com/flashcards/lesson-1-7639372/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-02](https://www.brainscape.com/flashcards/lesson-2-7639396/packs/12601191) | middle_specific | 19 | collected | — |
| [brainscape-middle-03](https://www.brainscape.com/flashcards/lesson-3-7641197/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-04](https://www.brainscape.com/flashcards/lesson-4-7645011/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-05](https://www.brainscape.com/flashcards/lesson-5-7651965/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-06](https://www.brainscape.com/flashcards/lesson-6-7655496/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-07](https://www.brainscape.com/flashcards/lesson-7-7666237/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-08](https://www.brainscape.com/flashcards/lesson-8-7666324/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-09](https://www.brainscape.com/flashcards/lesson-9-7671082/packs/12601191) | middle_specific | 19 | collected | — |
| [brainscape-middle-10](https://www.brainscape.com/flashcards/lesson-10-7679414/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-11](https://www.brainscape.com/flashcards/lesson-11-7698913/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-12](https://www.brainscape.com/flashcards/lesson-12-7714341/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-13](https://www.brainscape.com/flashcards/lesson-13-7725950/packs/12601191) | middle_specific | 19 | collected | — |
| [brainscape-middle-14](https://www.brainscape.com/flashcards/lesson-14-7793278/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-15](https://www.brainscape.com/flashcards/lesson-15-7797462/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-16](https://www.brainscape.com/flashcards/lesson-16-7817661/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-17](https://www.brainscape.com/flashcards/lesson-17-7836212/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-18](https://www.brainscape.com/flashcards/lesson-18-7839570/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-19](https://www.brainscape.com/flashcards/lesson-19-7843713/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-20](https://www.brainscape.com/flashcards/lesson-20-7847859/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-21](https://www.brainscape.com/flashcards/lesson-21-7866906/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-22](https://www.brainscape.com/flashcards/lesson-22-7870207/packs/12601191) | middle_specific | 19 | collected | — |
| [brainscape-middle-23](https://www.brainscape.com/flashcards/lesson-23-7873975/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-24](https://www.brainscape.com/flashcards/lesson-24-7891827/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-25](https://www.brainscape.com/flashcards/lesson-25-7895436/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-26](https://www.brainscape.com/flashcards/lesson-26-7898965/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-27](https://www.brainscape.com/flashcards/lesson-27-7905095/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-28](https://www.brainscape.com/flashcards/lesson-28-7906205/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-29](https://www.brainscape.com/flashcards/lesson-29-7909891/packs/12601191) | middle_specific | 20 | collected | — |
| [brainscape-middle-30](https://www.brainscape.com/flashcards/lesson-30-7909924/packs/12601191) | middle_specific | 24 | collected | — |
| [brainscape-drake-14070384](https://www.brainscape.com/flashcards/mid-level-day-1-14070384/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14072391](https://www.brainscape.com/flashcards/mid-level-day-2-14072391/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14083043](https://www.brainscape.com/flashcards/mid-level-day-3-14083043/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14088511](https://www.brainscape.com/flashcards/mid-level-day-4-14088511/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14097982](https://www.brainscape.com/flashcards/mid-level-day-5-14097982/packs/21502129) | middle_specific | 23 | partial | 30 |
| [brainscape-drake-14117075](https://www.brainscape.com/flashcards/mid-level-day-6-14117075/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14121953](https://www.brainscape.com/flashcards/mid-level-day-7-14121953/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14122000](https://www.brainscape.com/flashcards/mid-level-day-8-14122000/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14122054](https://www.brainscape.com/flashcards/mid-level-day-9-14122054/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14122116](https://www.brainscape.com/flashcards/mid-level-day-10-14122116/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14173718](https://www.brainscape.com/flashcards/mid-level-day-11-14173718/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14182936](https://www.brainscape.com/flashcards/mid-level-day-12-14182936/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14191731](https://www.brainscape.com/flashcards/mid-level-day-13-14191731/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14200854](https://www.brainscape.com/flashcards/mid-level-day-14-14200854/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14207241](https://www.brainscape.com/flashcards/mid-level-day-15-14207241/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14227581](https://www.brainscape.com/flashcards/mid-level-day-16-14227581/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14236597](https://www.brainscape.com/flashcards/mid-level-day-17-14236597/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14246529](https://www.brainscape.com/flashcards/mid-level-day-18-14246529/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14259208](https://www.brainscape.com/flashcards/mid-level-day-19-14259208/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14263898](https://www.brainscape.com/flashcards/mid-level-day-20-14263898/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14299455](https://www.brainscape.com/flashcards/mid-level-day-21-14299455/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14314252](https://www.brainscape.com/flashcards/mid-level-day-22-14314252/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14337100](https://www.brainscape.com/flashcards/mid-level-day-23-14337100/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14339670](https://www.brainscape.com/flashcards/mid-level-day-24-14339670/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14346669](https://www.brainscape.com/flashcards/mid-level-day-25-14346669/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14360852](https://www.brainscape.com/flashcards/mid-level-day-26-14360852/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14364585](https://www.brainscape.com/flashcards/mid-level-day-27-14364585/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14372995](https://www.brainscape.com/flashcards/mid-level-day-28-14372995/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14397821](https://www.brainscape.com/flashcards/mid-level-day-29-14397821/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14406708](https://www.brainscape.com/flashcards/mid-level-day-30-14406708/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14410385](https://www.brainscape.com/flashcards/mid-level-day-31-14410385/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14420527](https://www.brainscape.com/flashcards/mid-level-day-32-14420527/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14433587](https://www.brainscape.com/flashcards/mid-level-day-33-14433587/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14451695](https://www.brainscape.com/flashcards/mid-level-day-34-14451695/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14460616](https://www.brainscape.com/flashcards/mid-level-day-35-14460616/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14470477](https://www.brainscape.com/flashcards/mid-level-day-36-14470477/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-drake-14479615](https://www.brainscape.com/flashcards/mid-level-day-37-14479615/packs/21502129) | middle_specific | 24 | partial | 30 |
| [brainscape-nick-2602229](https://www.brainscape.com/flashcards/isee-ssat-middle-week-1-part-1-2602229/packs/4557032) | mixed_middle_ssat_isee | 20 | collected | 20 |
| [brainscape-nick-2602272](https://www.brainscape.com/flashcards/isee-ssat-middle-week-1-part-2-2602272/packs/4557032) | mixed_middle_ssat_isee | 20 | collected | 20 |
| [brainscape-nick-2602285](https://www.brainscape.com/flashcards/isee-ssat-middle-week-2-part-1-2602285/packs/4557032) | mixed_middle_ssat_isee | 20 | collected | 20 |
| [brainscape-nick-2603518](https://www.brainscape.com/flashcards/isee-ssat-middle-week-2-part-2-2603518/packs/4557032) | mixed_middle_ssat_isee | 20 | collected | 20 |
| [brainscape-nick-2606340](https://www.brainscape.com/flashcards/isee-ssat-middle-week-3-part-1-2606340/packs/4557032) | mixed_middle_ssat_isee | 20 | collected | 20 |
| [brainscape-nick-2606342](https://www.brainscape.com/flashcards/isee-ssat-middle-week-3-part-2-2606342/packs/4557032) | mixed_middle_ssat_isee | 20 | collected | 20 |
| [brainscape-nick-2682135](https://www.brainscape.com/flashcards/isee-ssat-middle-week-4-part-1-2682135/packs/4557032) | mixed_middle_ssat_isee | 20 | collected | 20 |
| [brainscape-nick-2682148](https://www.brainscape.com/flashcards/isee-ssat-middle-week-4-part-2-2682148/packs/4557032) | mixed_middle_ssat_isee | 20 | collected | 20 |
| [brainscape-kitty-21041175](https://www.brainscape.com/flashcards/middle-official-guide-words-1-21041175/packs/22345014) | middle_specific | 24 | partial | 123 |
| [brainscape-kitty-21061546](https://www.brainscape.com/flashcards/middle_official_guide_words_2-21061546/packs/22345014) | middle_specific | 24 | partial | 159 |
| [vocab-voyage-middle](https://gponcrussdahcdyrlhcr.supabase.co/functions/v1/vocab-api/course-word-list?course_slug=ssat-middle-level&limit=50) | middle_specific | 50 | partial | 100 |
| [crackssat-middle](https://www.crackssat.com/ssat/prep/94.html) | mixed_middle_ssat_isee | 50 | collected | 50 |
| [vocabulary-middle-308998](https://www.vocabulary.com/lists/308998) | mixed_middle_ssat_isee | 102 | collected | 102 |
| [examvocabbuilder-easy](https://examvocabbuilder.com/words/level/easy) | mixed_levels_supplemental | 612 | collected | 612 |
| [examvocabbuilder-medium](https://examvocabbuilder.com/words/level/medium) | mixed_levels_supplemental | 308 | collected | 308 |
| [examvocabbuilder-hard](https://examvocabbuilder.com/words/level/hard) | mixed_levels_supplemental | 580 | collected | 580 |
| [learnthat-98832](https://www.learnthat.org/word_lists/view/98832) | mixed_levels_supplemental | 221 | partial | 496 |
| [whotutors-400](https://www.whotutors.com/resource_redirect/downloads/file-uploads/sites/2148740314/themes/2163491751/downloads/8ab4c41-7b2d-a82c-5276-3e4241adcc3_Vocab_List_2025.pdf) | mixed_levels_supplemental | 399 | collected | 400 |
| [ivy-core75](https://downloads.ivyglobal.com/ssat/segments/English_75_Core_SSAT_Words.pdf) | mixed_levels_supplemental | 75 | previously_verified_manifest | — |
| [ivy-essential125](https://downloads.ivyglobal.com/ssat/SSAT_ISEE_Vocabulary_1.pdf) | mixed_levels_supplemental | 125 | previously_verified_manifest | — |
| [ivy-practice-synonyms](https://downloads.ivyglobal.com/ssat/middle_test_1/SSAT%20Middle%20Level%20Test%201%20v%201.6.pdf) | middle_specific | 30 | previously_downloaded_public_pdf | 30 |
| [princeton-practice-synonyms](https://content.randomhouse.com/assets/9780804126403/pdfs/Middle%20Level%20SSAT%20Practice%20Test.pdf) | middle_specific | 30 | previously_downloaded_public_pdf | 30 |
| [ninjas-practice-synonyms](https://test-ninjas.com/free/ssat/test-ninjas-ssat-middle-level-practice-test-1.pdf) | middle_specific | 30 | previously_downloaded_public_pdf | 30 |
| [midssat](https://www.midssat.com/vocabulary/word-lists) | middle_specific | 0 | not_collected | 1863 |
| [quizlet-655353669](https://quizlet.com/655353669/20252026-middle-level-ssat-vocabulary-flash-cards/) | middle_specific | 0 | not_collected | 361 |
| [quizlet-394582059](https://quizlet.com/394582059/ssat-vocabularymiddle-level-flash-cards/) | middle_specific | 0 | not_collected | 400 |
| [quizlet-150399180](https://quizlet.com/150399180/ssat-middle-level-vocabulary-flash-cards/) | middle_specific | 0 | not_collected | 472 |
| [quizlet-pasquale](https://quizlet.com/pasquale_spano/folders/ssat) | mixed_levels_supplemental | 0 | not_collected | — |

## Reproduce

Run `python3 tools/collect_online_vocabulary.py` from the repository root. Cached downloads default to `/private/tmp/ssat-middle-vocabulary-research`; `--cache-dir` and `--out-dir` override those paths. Python uses only its standard library; `curl` and Poppler’s `pdftotext` are required. Existing public practice PDFs can be supplied through `reading_materials/` or are retrieved from the original download manifest. Remove a cached file to refresh that source.

Practice-page content and student progress are unchanged by this research collector. Editorial review, original definitions/examples, and difficulty checks are needed before any candidates become lessons.

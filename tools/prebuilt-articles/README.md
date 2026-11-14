# Offline vocabulary reading library

This directory contains 361 prebuilt reading passages covering every one of the 2,697 eligible vocabulary headwords. Each passage has one to eight focus words, their primary meanings, and the exact authored context sentences used to illustrate them. The unverified spelling `obstrusion` is excluded.

The local compiler combines these observations within varied editorial narratives about student magazines, archives, museums, and reading groups. These passages are deterministic compositions from existing content, not new remotely generated fiction. Some focus words may also occur incidentally in other passages; the eight-word limit applies to the selected learning targets.

Rebuild with `python3 tools/generate_prebuilt_articles.py`, then `python3 tools/update_vocabulary.py`. Neither command needs network access. The HTML embeds all passages so selecting and reading one works offline. `node tools/check_prebuilt_articles.cjs` verifies coverage, primary definitions, length, exact target occurrences, and the target limit.

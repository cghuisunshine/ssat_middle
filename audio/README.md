# Vocabulary pronunciation recordings

`words/` contains 2,697 English word recordings generated with **edge-tts 7.3.1**, voice **en-US-AriaNeural**, at **-10%** speed. The unverified source spelling `obstrusion` has no recording. Learner-added words need a recording generated before they can be played; there is no browser speech-synthesis fallback.

`vocabulary-manifest.json` identifies the exact word, voice, MP3 file, checksum, duration, and clip-relative word boundaries. Multiword and hyphenated entries preserve their visible text and character offsets. The generator synthesizes short batches, validates every returned word boundary against the source text, then cuts individual recordings with silence padding. Batch recordings and intermediate metadata stay in a temporary cache outside the repository. The page embeds the playback manifest and loads only the requested local MP3.

Keep the `audio` directory beside `ssat_middle_vocabulary.html` when copying the site for offline listening. Quizzes and explanations remain self-contained in the HTML. Audio playback uses local recordings, without a connection to a speech service.

To regenerate, install `ffmpeg`, create a Python environment, and run:

```sh
python3 -m venv /private/tmp/ssat-edge-tts-venv
/private/tmp/ssat-edge-tts-venv/bin/pip install -r tools/requirements-vocabulary-audio.txt
/private/tmp/ssat-edge-tts-venv/bin/python tools/generate_vocabulary_audio.py
python3 tools/update_vocabulary.py
node tools/check_vocabulary_audio.cjs
```

Generation requires network access to Edge TTS. Repeating it reuses the matching cached batch recordings and clips. A changed voice, speed, batch text, or generator revision produces different immutable filenames. Remove superseded assets only after confirming the new manifest and page are complete; the checker detects orphan recordings.

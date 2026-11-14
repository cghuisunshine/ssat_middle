#!/usr/bin/env python3
"""Generate Edge TTS word recordings, split using actual word-boundary timings.

Requires edge-tts and ffmpeg. Network access is used only during generation.
Batch audio and metadata stay in a resumable temporary cache; the site receives
one small MP3 per study word and a manifest with clip-relative word timings.
"""
import argparse
import asyncio
import hashlib
import json
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
TICKS = 10_000_000


def embedded(html, name):
    start = re.search(r'^const ' + name + '=', html, re.M).end()
    return json.JSONDecoder().raw_decode(html[start:])[0]


def normalize_with_positions(text):
    chars, positions = [], []
    for index, char in enumerate(text):
        for letter in unicodedata.normalize('NFKD', char.casefold()):
            if letter.isalnum():
                chars.append(letter)
                positions.append(index)
    return ''.join(chars), positions


def align_boundaries(text, messages):
    normalized, positions = normalize_with_positions(text)
    cursor, result = 0, []
    for msg in messages:
        token = normalize_with_positions(msg['text'])[0]
        assert token and normalized.startswith(token, cursor), ('Unexpected TTS boundary', msg, text, cursor)
        end = cursor + len(token)
        result.append(dict(text=text[positions[cursor]:positions[end-1]+1], start=msg['offset']/TICKS,
                           end=(msg['offset']+msg['duration'])/TICKS,
                           start_char=positions[cursor], end_char=positions[end-1]+1))
        cursor = end
    assert cursor == len(normalized), ('Incomplete TTS boundaries', text, cursor)
    return result


async def run(args):
    import edge_tts
    html = (ROOT / 'ssat_middle_vocabulary.html').read_text()
    excluded = embedded(html, 'ONLINE_WORD_WARNINGS')
    words = sorted(line.split('|')[0] for line in embedded(html, 'RAW_WORDS').splitlines()
                   if line and not line.startswith('@') and line.split('|')[0] not in excluded)
    if args.limit:
        words = words[:args.limit]
    output = ROOT / 'audio' / 'words'
    output.mkdir(parents=True, exist_ok=True)
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    network, encoders = asyncio.Semaphore(args.jobs), asyncio.Semaphore(6)
    config = dict(provider='edge-tts', version=edge_tts.__version__, voice=args.voice, rate=args.rate,
                  boundary='WordBoundary', format='mp3-24khz-48kbitrate-mono', padding=[0.10,0.18], revision=1)
    finished, total = 0, (len(words)+args.batch_size-1)//args.batch_size

    async def batch(index, entries):
        nonlocal finished
        text = '\n'.join(w + '.' for w in entries)
        key = hashlib.sha256(json.dumps([config,text],ensure_ascii=False,sort_keys=True).encode()).hexdigest()[:20]
        source = args.cache_dir / (key + '.mp3')
        boundaries_file = args.cache_dir / (key + '.words.json')
        if not (source.exists() and boundaries_file.exists()):
            async with network:
                for attempt in range(4):
                    try:
                        messages = []
                        with source.with_suffix('.part').open('wb') as handle:
                            speech = edge_tts.Communicate(text,voice=args.voice,rate=args.rate,
                                boundary='WordBoundary',connect_timeout=15,receive_timeout=60)
                            async for msg in speech.stream():
                                if msg['type'] == 'audio':
                                    handle.write(msg['data'])
                                elif msg['type'] == 'WordBoundary':
                                    messages.append(msg)
                        boundaries = align_boundaries(text,messages)
                        assert source.with_suffix('.part').stat().st_size > 1000
                        source.with_suffix('.part').replace(source)
                        boundaries_file.write_text(json.dumps(dict(text=text,words=boundaries),ensure_ascii=False,indent=2)+'\n')
                        break
                    except Exception as error:
                        if attempt == 3:
                            raise RuntimeError(f'Batch {index+1}: {error}') from error
                        print(f'Retrying batch {index+1}: {type(error).__name__}',flush=True)
                        await asyncio.sleep(2**attempt)
        payload = json.loads(boundaries_file.read_text())
        assert payload['text'] == text
        boundaries = payload['words']
        ranges, cursor = [], 0
        for word in entries:
            end = cursor + len(word)
            timings = [b for b in boundaries if cursor <= b['start_char'] < end]
            assert timings and timings[0]['start_char'] == cursor and timings[-1]['end_char'] == end, word
            assert all(b['end_char'] <= end for b in timings), word
            ranges.append((word,cursor,timings))
            cursor = end + 2  # period and newline
        records = {}

        async def clip(i, word, char_start, timings):
            start, end = timings[0]['start'], timings[-1]['end']
            previous_end = ranges[i-1][2][-1]['end'] if i else 0
            next_start = ranges[i+1][2][0]['start'] if i+1 < len(ranges) else end+0.4
            assert previous_end <= start < end <= next_start, word
            clip_start = max(0,start-min(0.10,(start-previous_end)/2))
            clip_end = end+min(0.18,(next_start-end)/2)
            filename = hashlib.sha256(json.dumps([config,word,key],ensure_ascii=False,sort_keys=True).encode()).hexdigest()[:20]+'.mp3'
            target = output / filename
            if not target.exists():
                async with encoders:
                    temporary = target.with_suffix('.part.mp3')
                    proc = await asyncio.create_subprocess_exec('ffmpeg','-v','error','-nostdin','-y',
                        '-ss',f'{clip_start:.6f}','-i',str(source),'-t',f'{clip_end-clip_start:.6f}',
                        '-map_metadata','-1','-ac','1','-ar','24000','-codec:a','libmp3lame','-b:a','48k',
                        '-threads','1','-write_xing','0','-id3v2_version','0',str(temporary),
                        stdout=asyncio.subprocess.DEVNULL,stderr=asyncio.subprocess.PIPE)
                    _,error = await proc.communicate()
                    if proc.returncode:
                        raise RuntimeError(error.decode())
                    temporary.replace(target)
            data = target.read_bytes()
            assert len(data) >= 1000 and len(data)%144 == 0, (word,len(data))
            records[word] = dict(text=word,file='audio/words/'+filename,duration=round(len(data)*8/48000,6),
                sha256=hashlib.sha256(data).hexdigest(), words=[dict(text=b['text'],
                    start=round(b['start']-clip_start,6),end=round(b['end']-clip_start,6),
                    start_char=b['start_char']-char_start,end_char=b['end_char']-char_start) for b in timings])

        await asyncio.gather(*(clip(i,*row) for i,row in enumerate(ranges)))
        finished += 1
        print(f'Completed {finished}/{total} batches ({len(records)} words in batch {index+1})',flush=True)
        return records

    results = await asyncio.gather(*(batch(i//args.batch_size,words[i:i+args.batch_size])
        for i in range(0,len(words),args.batch_size)))
    recordings = {word:record for result in results for word,record in result.items()}
    assert set(recordings) == set(words)
    manifest = dict(config,words=dict(sorted(recordings.items())))
    destination = ROOT / 'audio' / ('vocabulary-manifest.sample.json' if args.limit else 'vocabulary-manifest.json')
    destination.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(f'Generated {len(recordings)} recordings: {destination}',flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir',type=Path,default=Path('/private/tmp/ssat-word-audio-cache'))
    parser.add_argument('--voice',default='en-US-AriaNeural')
    parser.add_argument('--rate',default='-10%')
    parser.add_argument('--batch-size',type=int,default=40)
    parser.add_argument('--jobs',type=int,default=4)
    parser.add_argument('--limit',type=int,default=0)
    args = parser.parse_args()
    assert args.batch_size > 0 and args.jobs > 0 and args.limit >= 0
    asyncio.run(run(args))


if __name__ == '__main__':
    main()

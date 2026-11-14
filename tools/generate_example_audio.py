#!/usr/bin/env python3
"""Generate Edge TTS audio and exact word timings for every vocabulary example."""
import argparse
import asyncio
import hashlib
import json
from pathlib import Path
from generate_vocabulary_audio import ROOT, embedded, align_boundaries, normalize_with_positions


def examples_from_page(html):
    excluded = embedded(html,'ONLINE_WORD_WARNINGS')
    examples = {word+'#0':dict(text=text,wordId=word,senseIndex=0)
                for word,text in embedded(html,'EXAMPLES').items() if word not in excluded}
    for word,senses in embedded(html,'SECONDARY_MEANINGS').items():
        if word not in excluded:
            for index,sense in enumerate(senses,1):
                examples[word+'#'+str(index)] = dict(text=sense['example'],wordId=word,senseIndex=index)
    return dict(sorted(examples.items()))


async def run(args):
    import edge_tts
    examples = examples_from_page((ROOT/'ssat_middle_vocabulary.html').read_text())
    entries = list(examples.items())
    output = ROOT/'audio'/'examples'
    output.mkdir(parents=True,exist_ok=True)
    args.cache_dir.mkdir(parents=True,exist_ok=True)
    config = dict(provider='edge-tts',version=edge_tts.__version__,voice=args.voice,rate=args.rate,
                  boundary='WordBoundary',format='mp3-24khz-48kbitrate-mono',padding=[0.10,0.25],revision=1)
    network, encoders = asyncio.Semaphore(args.jobs), asyncio.Semaphore(6)
    total = (len(entries)+args.batch_size-1)//args.batch_size
    finished = 0

    async def batch(index,rows):
        nonlocal finished
        text = '\n'.join(row['text'] for _,row in rows)
        assert len(text.encode()) < 4000, 'Reduce the batch size to avoid splitting a TTS stream.'
        key = hashlib.sha256(json.dumps([config,text],ensure_ascii=False,sort_keys=True).encode()).hexdigest()[:20]
        source = args.cache_dir/(key+'.mp3')
        metadata = args.cache_dir/(key+'.words.json')
        if not (source.exists() and metadata.exists()):
            async with network:
                for attempt in range(4):
                    try:
                        messages = []
                        temporary = source.with_suffix('.part')
                        with temporary.open('wb') as handle:
                            speech = edge_tts.Communicate(text,voice=args.voice,rate=args.rate,boundary='WordBoundary',connect_timeout=15,receive_timeout=60)
                            async for message in speech.stream():
                                if message['type'] == 'audio':
                                    handle.write(message['data'])
                                elif message['type'] == 'WordBoundary':
                                    messages.append(message)
                        timings = align_boundaries(text,messages)
                        assert temporary.stat().st_size > 1000
                        temporary.replace(source)
                        metadata.write_text(json.dumps(dict(text=text,words=timings),ensure_ascii=False,indent=2)+'\n')
                        break
                    except Exception as error:
                        if attempt == 3:
                            raise RuntimeError(f'Example batch {index+1}: {error}') from error
                        print(f'Retrying example batch {index+1}: {type(error).__name__}',flush=True)
                        await asyncio.sleep(2**attempt)
        payload = json.loads(metadata.read_text())
        assert payload['text'] == text
        ranges, cursor = [], 0
        for identifier,row in rows:
            end = cursor+len(row['text'])
            timings = [w for w in payload['words'] if cursor <= w['start_char'] < end]
            assert timings and all(w['end_char'] <= end for w in timings), identifier
            assert not normalize_with_positions(text[cursor:timings[0]['start_char']])[0], identifier
            assert not normalize_with_positions(text[timings[-1]['end_char']:end])[0], identifier
            ranges.append((identifier,row,cursor,timings))
            cursor = end+1
        result = {}

        async def clip(index,identifier,row,char_start,timings):
            start,end = timings[0]['start'],timings[-1]['end']
            previous_end = ranges[index-1][3][-1]['end'] if index else 0
            next_start = ranges[index+1][3][0]['start'] if index+1<len(ranges) else end+0.6
            assert previous_end <= start < end <= next_start, identifier
            clip_start = max(0,start-min(0.1,(start-previous_end)/2))
            clip_end = end+min(0.25,(next_start-end)/2)
            filename = hashlib.sha256(json.dumps([config,identifier,key],ensure_ascii=False,sort_keys=True).encode()).hexdigest()[:20]+'.mp3'
            target = output/filename
            if not target.exists():
                async with encoders:
                    temporary = target.with_suffix('.part.mp3')
                    process = await asyncio.create_subprocess_exec('ffmpeg','-v','error','-nostdin','-y','-ss',f'{clip_start:.6f}',
                        '-i',str(source),'-t',f'{clip_end-clip_start:.6f}','-map_metadata','-1','-ac','1','-ar','24000',
                        '-codec:a','libmp3lame','-b:a','48k','-threads','1','-write_xing','0','-id3v2_version','0',str(temporary),
                        stdout=asyncio.subprocess.DEVNULL,stderr=asyncio.subprocess.PIPE)
                    _,error = await process.communicate()
                    if process.returncode:
                        raise RuntimeError(error.decode())
                    temporary.replace(target)
            data = target.read_bytes()
            assert len(data)>1000 and len(data)%144==0, identifier
            result[identifier] = dict(row,file='audio/examples/'+filename,duration=round(len(data)*8/48000,6),
                sha256=hashlib.sha256(data).hexdigest(),words=[dict(text=w['text'],start=round(w['start']-clip_start,6),
                    end=round(w['end']-clip_start,6),start_char=w['start_char']-char_start,end_char=w['end_char']-char_start) for w in timings])

        await asyncio.gather(*(clip(index,*row) for index,row in enumerate(ranges)))
        finished += 1
        print(f'Completed {finished}/{total} example batches ({len(result)} sentences in batch {index+1})',flush=True)
        return result

    results = await asyncio.gather(*(batch(i//args.batch_size,entries[i:i+args.batch_size]) for i in range(0,len(entries),args.batch_size)))
    recordings = {key:row for result in results for key,row in result.items()}
    assert set(recordings)==set(examples)
    manifest = dict(config,examples=dict(sorted(recordings.items())))
    destination = ROOT/'audio'/'example-manifest.json'
    destination.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(f'Generated {len(recordings)} sentence recordings: {destination}',flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir',type=Path,default=Path('/private/tmp/ssat-example-audio-cache'))
    parser.add_argument('--voice',default='en-US-AriaNeural')
    parser.add_argument('--rate',default='-10%')
    parser.add_argument('--batch-size',type=int,default=12)
    parser.add_argument('--jobs',type=int,default=4)
    args = parser.parse_args()
    assert args.batch_size>0 and args.jobs>0
    asyncio.run(run(args))


if __name__=='__main__':
    main()

#!/usr/bin/env python3
"""Compile the complete article library offline from authored vocabulary contexts.

No network, model, API key, or additional Python packages are required. Each
reading passage presents a themed set of observations within an editorial
narrative. The observed incidents use the bank's original context sentences,
so every focus word keeps its reviewed meaning. This is deterministic local
composition, not a claim of fresh AI-written fiction.
"""
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]


def constant(html,name):
 start=re.search(r'^const '+name+'=',html,re.M).end()
 return json.JSONDecoder().raw_decode(html[start:])[0]

# Different editorial settings provide a reason to compare several independent
# incidents without inventing connections between their original characters.
SETTINGS=[
 ('The Library Display','A student reading club was preparing a display for the town library. Its members collected accounts from notebooks, interviews, and short stories. They wanted visitors to notice how a small detail could change the way an event was understood.'),
 ('Pages from the School Magazine','The school magazine had room for one more feature. Instead of choosing a single dramatic adventure, its editors gathered several brief accounts around a shared theme. They hoped readers would compare the situations and think about the reasons behind each action.'),
 ('An Afternoon in the Archive','During an afternoon at a community archive, a class examined records of ordinary experiences. Some came from personal journals, while others resembled reports or scenes from fiction. The students agreed that useful evidence could come from a quiet incident as well as a surprising one.'),
 ('The Museum Notebook','A museum volunteer invited a group of students to help prepare a notebook for visitors. The notebook would place brief observations beside the exhibits. Its purpose was to encourage careful attention: a reader should examine what happened before deciding what a scene might suggest.'),
 ('The Editors’ Table','At a table covered with draft pages, a group of young editors discussed their next publication. Each person had brought a different account. Rather than rank the experiences from best to worst, they decided to explore the connections among them and preserve the details that mattered.'),
 ('A Classroom Investigation','A class was investigating how writers turn observations into evidence. The teacher supplied a folder of short accounts and asked the students to look beyond their first impressions. Each account described a particular situation, but the collection raised questions that could apply more widely.'),
 ('Notes for a Community Exhibition','The community center was planning an exhibition about everyday experiences. Students volunteered to select the written material. Their challenge was to find a balance between vivid individual moments and a larger theme that visitors could follow without already knowing the people involved.'),
 ('The Reading Circle','At the weekly reading circle, each member brought a passage that had caught their attention. The group did not need to agree immediately about its importance. Instead, they listened to the details, compared the situations, and asked what additional information would make an interpretation stronger.'),
 ('A Reporter’s Folder','A young reporter sorted a folder of notes before writing a feature for the school newspaper. The notes came from several accounts rather than one continuous event. To make the feature useful, the reporter needed to distinguish what each record actually showed from what a reader might assume.'),
 ('A Workshop on Observation','The writing workshop began with an unusual assignment: compare several brief records before composing a conclusion. Each record offered a glimpse of a different situation. The participants had to respect those differences while discovering a theme that could give their discussion a clear direction.'),
 ('The Exhibition Guide','The students preparing an exhibition guide wanted it to invite questions rather than simply announce answers. They gathered short accounts and arranged them for discussion. A visitor could begin with one scene, then return to it after considering the other examples in the collection.'),
 ('A Journal of Discoveries','A reading group was assembling a journal of discoveries from its recent work. The discoveries were not all inventions or journeys to distant places. Sometimes they involved noticing a choice, recognizing a pattern, or understanding why a seemingly minor event deserved closer attention.'),
]
BRIDGES=[
 ('The first section of the collection placed these observations side by side.','A later section added further scenes for comparison.'),
 ('The opening pages introduced several situations worth examining carefully.','The remaining pages widened the discussion with additional observations.'),
 ('The group began by reading the following accounts without adding explanations of its own.','It then considered a second group of accounts, looking for both similarities and differences.'),
 ('Several records provided a starting point for the discussion.','Other records complicated that first impression and encouraged a closer reading.'),
]
ENDINGS=[
 'When the group returned to its original question, the discussion had become more precise. The members could point to particular actions and details instead of relying on a vague impression. They did not force every account to teach the same lesson. Their final display invited readers to compare the evidence, explain a connection, and consider where that connection ended.',
 'By the end of the discussion, the students had learned why careful reading requires more than a quick judgment. A useful interpretation must fit the details of the situation. They chose a conclusion that acknowledged differences among the accounts, and they left readers with a question: which observation most strongly supports your view, and what might change your mind?',
 'The editors resisted the temptation to turn the collection into a single simple rule. Each account had its own circumstances, and those circumstances mattered. Their finished feature encouraged readers to describe what they noticed, support an interpretation with evidence, and compare it with another possible explanation. The value of the collection lay in that patient work of comparison.',
 'The class finished by comparing its first impressions with its later interpretations. Some ideas had survived closer examination; others needed to be revised. The students kept the original details visible so that future readers could judge for themselves. They understood that a convincing explanation should connect the evidence clearly while leaving room for questions the records could not answer.',
]


def build():
 html=(ROOT/'ssat_middle_vocabulary.html').read_text()
 raw=constant(html,'RAW_WORDS');examples=constant(html,'EXAMPLES');excluded=constant(html,'ONLINE_WORD_WARNINGS')
 buckets=defaultdict(list)
 for line in raw.splitlines():
  if line.startswith('@'):tier,topic=line[1:].split('|')
  elif line:
   word,pos,definition,zh,syn=line.split('|')
   if word not in excluded:buckets[(tier,topic)].append(dict(word=word,index=0,definition=definition))
 out=ROOT/'tools/prebuilt-articles';out.mkdir(exist_ok=True)
 coverage=set();ids=set()
 for (tier,topic),words in sorted(buckets.items()):
  for offset in range(0,len(words),8):
   targets=words[offset:offset+8];key=hashlib.sha256(json.dumps(targets,sort_keys=True).encode()).hexdigest()[:16];seed=int(key,16)
   title,opening=SETTINGS[seed%len(SETTINGS)];first,second=BRIDGES[(seed//13)%len(BRIDGES)]
   observations=[examples[t['word']] for t in targets]
   split=(len(observations)+1)//2
   paragraphs=[opening,first+' '+' '.join(observations[:split])]
   if observations[split:]:paragraphs.append(second+' '+' '.join(observations[split:]))
   paragraphs.append(ENDINGS[(seed//29)%len(ENDINGS)])
   if len(' '.join(paragraphs).split())<150:paragraphs.append('A reader can continue the investigation by choosing one detail and explaining why it matters. The strongest answer will distinguish observation from assumption, consider the circumstances, and identify a question that would require more evidence before it could be answered confidently.')
   article=dict(id='article-'+key,tier=tier,topic=topic,title=title,paragraphs=paragraphs,targets=targets,createdAt='',source='local-context-composition',recipeVersion=1)
   text=' '.join(paragraphs)
   assert 150<=len(text.split())<=650, (article['id'],len(text.split()))
   for t in targets:
    assert re.search(r'(?<!\w)'+re.escape(t['word'])+r'(?!\w)',text,re.I),t['word']
    coverage.add(t['word'])
   target=out/(article['id']+'.json');target.write_text(json.dumps(article,ensure_ascii=False,indent=2)+'\n');ids.add(article['id'])
 stale={p.stem for p in out.glob('*.json')}-ids
 assert not stale,('Unexpected article files',stale)
 print(f'Compiled {len(ids)} articles covering {len(coverage)} words, entirely offline.')

if __name__=='__main__':build()

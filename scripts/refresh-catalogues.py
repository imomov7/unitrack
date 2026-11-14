"""Refresh factual course fields from official public HTML. No runtime dependency.
Run python3 scripts/refresh-catalogues.py [download-directory]. Review output before publishing.
Variable-credit subjects and combined alternatives are deliberately excluded.
"""
import html, json, re, subprocess, sys
from pathlib import Path
folder=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/tmp/acadely-catalogue-refresh')
folder.mkdir(parents=True,exist_ok=True)
sources={
 'rit-curriculum':'https://www.rit.edu/programs-api/courseleaf/proxy-api.php?url=/programs/information-technology-bs/index.xml&section=curriculum&removeheader=true',
 'mit':'https://catalog.mit.edu/subjects/6/', 'mit-math':'https://catalog.mit.edu/subjects/18/'
}
def text(s): return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',s))).strip()
def field(s,cls):
 m=re.search(r'<[^>]+class="'+cls+r'"[^>]*>(.*?)</(?:td|span|p)>',s,re.S)
 return text(m[1]) if m else ''
groups=[]
for n,url in sources.items():
 p=folder/(n+'.html')
 if not p.exists():subprocess.run(['curl','--fail','--location','--silent','--show-error',url,'-o',str(p)],check=True)
 source=p.read_text();rows=[]
 if n=='rit-curriculum':
  for row in re.findall(r'<tr\b[^>]*>.*?</tr>',source,re.S):
   codes=re.findall(r'data-code-bubble="([^"]+)"',row);hours=field(row,'hourscol');name=field(row,'titlecol')
   # These three verified titles have curriculum annotations, not title text.
   # Extract the entire TD first: field() otherwise stops at a nested </span>.
   if len(codes)==1 and codes[0] in {'MATH-131','COMM-142','MATH-161'}:
    title=re.search(r'<td\b[^>]*class="titlecol"[^>]*>(.*?)</td>',row,re.S)
    if title:
     clean=re.sub(r'\(\s*<span class="comment">.*?</span>\s*\)|<sup>.*?</sup>','',title[1],flags=re.S)
     name=text(clean)
   if len(codes)==1 and re.fullmatch(r'\d+(\.\d+)?',hours) and float(hours)>0 and name:
    rows.append(dict(code=codes[0],name=name,credits=float(hours),creditUnit='semester credits'))
  groups.append(dict(universityNames=['Rochester Institute of Technology'],source='https://www.rit.edu/study/information-technology-bs',edition='2026–2027 · CIT curriculum subset',courses=rows))
 else:
  for block in re.split(r'<div class="courseblock">',source)[1:]:
   title=field(block,'courseblocktitle');m=re.match(r'(\S+) (.+)',title);hours=field(block,'courseblockhours');u=re.match(r'^(\d+)-(\d+)-(\d+) units',hours)
   if m and u and field(block,'courseblockterms').startswith('U '):
    rows.append(dict(code=m[1],name=m[2],credits=sum(map(int,u.groups())),creditUnit='MIT units'))
  groups.append(dict(universityNames=['Massachusetts Institute of Technology'],source=url,edition='2026–2027 · '+('Mathematics' if n=='mit-math' else 'EECS')+' fixed-unit undergraduate subjects',courses=rows))
 assert rows, 'Source structure changed: '+n
# Keep previously verified RIT biology record not included in the IT degree sequence.
groups[0]['courses'].append(dict(code='BIOL-101',name='General Biology I',credits=3,creditUnit='semester credits',source='https://www.rit.edu/marketing/sites/rit.edu.marketing/files/docs/pdfs/Undergraduate_Catalog.pdf',edition='2025–2026'))
for g in groups:
 g['retrieved']='2026-11-14';g['courses']=list({c['code']:c for c in g['courses']}.values())
Path('assets/data/course-catalogues.js').write_text('// Official factual course fields. Partial coverage; review source editions.\nwindow.ACADELY_CATALOGUES = '+json.dumps(groups,ensure_ascii=False,indent=2)+';\n')
print([(g['universityNames'][0],len(g['courses'])) for g in groups])

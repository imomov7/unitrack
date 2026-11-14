"""Refresh the MIT-licensed Hipo community directory, with a bundled offline fallback.
Run from repository root. Review the diff before deployment; retain the license.
"""
import json, subprocess, sys
from pathlib import Path
source='https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json'
rows=json.loads(Path(sys.argv[1]).read_text()) if len(sys.argv)>1 else json.loads(subprocess.check_output(['curl','--fail','--location','--silent','--show-error',source]))
unique={}
for r in rows:
 name=str(r.get('name','')).strip();country=str(r.get('country','')).strip()
 if not name or not country:continue
 key=(name.casefold(),country.casefold())
 if key not in unique:unique[key]={'name':name,'country':country,'website':next(iter(r.get('web_pages',[])),r.get('website','')),'domains':r.get('domains',[])}
 else:unique[key]['domains']=sorted(set(unique[key]['domains']+r.get('domains',[])))
Path('assets/data/universities.js').write_text('window.ACADELY_UNIVERSITIES = '+json.dumps(list(unique.values()),ensure_ascii=False,separators=(',',':'))+';\n')
print(len(unique),'universities',len({r['country'] for r in unique.values()}),'countries')

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const P=require('../js/academic-planning.js');
const majorsSandbox={window:{}};
vm.runInNewContext(await readFile(new URL('../assets/data/majors.js',import.meta.url),'utf8'),majorsSandbox);
const majors=majorsSandbox.window.ACADELY_MAJORS;

test('bundled university directory is nonempty and returns sensible name suggestions',async()=>{
 const context={window:{}};vm.runInNewContext(await readFile(new URL('../assets/data/universities.js',import.meta.url),'utf8'),context);
 const rows=context.window.ACADELY_UNIVERSITIES;
 assert.ok(rows.length>1000);
 assert.ok(P.searchUniversities(rows,'Rochester').some(r=>r.name==='Rochester Institute of Technology'));
 assert.ok(P.searchUniversities(rows,'Oxford').some(r=>r.name==='University of Oxford'));
 assert.equal(P.searchUniversities(rows,'nonexistent-test-school-4768').length,0);
});
test('major search matches sourced labels and common aliases, with empty-state support',()=>{
 assert.ok(majors.length>20);
 assert.ok(P.searchMajors(majors,'Computer Sci').some(r=>r.name==='Computer Science'));
 assert.ok(P.searchMajors(majors,'CS').some(r=>r.name==='Computer Science'));
 assert.ok(P.searchMajors(majors,'Psychology').some(r=>r.name.startsWith('Psychology')));
 assert.equal(P.searchMajors(majors,'Unknown hand-entered major').length,0);
 assert.equal(P.searchMajors(majors,'').length,0);
});
test('course search accepts punctuation variants, multiple words, accents, and professor names',()=>{
 const rows=[{code:'GCIS-123',name:'Software Development and Problem Solving I',professor:'Dr García'},{code:'BIOL-101',name:'General Biology I'}];
 for(const q of ['GCIS123','GCIS-123','GCIS 123','software problem','garcia'])assert.equal(P.searchCourses(rows,q)[0].code,'GCIS-123');
 assert.equal(P.searchCourses(rows,'not in catalogue').length,0);
});
test('initial HTML has a loading fallback, not invented dashboard totals or dead static controls',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/Opening your workspace/);assert.match(html,/<noscript>/);assert.match(html,/startup-reload/);
 assert.doesNotMatch(html,/class="stat-value">0/);assert.doesNotMatch(html,/Your wins will show here/);
});
test('startup failure exposes a reload action without touching saved data',async()=>{
 const listeners=new Map();let timedOut;const message={textContent:''},button={hidden:true,addEventListener(){}};
 const context={setTimeout:fn=>{timedOut=fn;return 1;},clearTimeout(){},window:{addEventListener:(name,fn)=>listeners.set(name,fn)},document:{querySelector:selector=>selector==='#startup-message'?message:selector==='#startup-reload'?button:null},location:{reload(){}}};
 vm.runInNewContext(await readFile(new URL('../js/startup.js',import.meta.url),'utf8'),context);
 listeners.get('error')({target:{tagName:'SCRIPT'}});
 assert.equal(button.hidden,false);assert.match(message.textContent,/could not finish loading/);
 button.hidden=true;listeners.get('acadely-rendered')();timedOut();assert.equal(button.hidden,true);
});

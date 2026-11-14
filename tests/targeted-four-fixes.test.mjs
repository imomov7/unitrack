import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const P=require('../js/academic-planning.js');
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function dataset(path,key){const c={window:{}};vm.runInNewContext(read(path),c);return JSON.parse(JSON.stringify(c.window[key]));}
const universities=dataset('assets/data/universities.js','ACADELY_UNIVERSITIES');
test('bundled universities match full names and common institutional abbreviations without mutation',()=>{
 const before=JSON.stringify(universities);
 for(const [query,name] of [['RIT','Rochester Institute of Technology'],['MIT','Massachusetts Institute of Technology'],['Massachusetts Institute','Massachusetts Institute of Technology']]) {
  assert.ok(P.searchUniversities(universities,query).some(r=>r.name===name),query);
 }
 assert.equal(JSON.stringify(universities),before);
 const duplicate={name:'Example University',country:'Example',domains:['eu.example']};
 const rows=[duplicate,{...duplicate,name:'EXAMPLE UNIVERSITY'},{...duplicate,country:'Other'}];
 assert.equal(P.searchUniversities(rows,'Example').length,2);
 assert.deepEqual(P.searchUniversities([], 'Unlisted manual university'),[]);
});
test('verified RIT titles retain official codes and semester credits',()=>{
 const rows=dataset('assets/data/course-catalogues.js','ACADELY_CATALOGUES')[0].courses;
 for(const [code,name,credits]of [['MATH-131','Discrete Mathematics',4],['COMM-142','Introduction to Technical Communication',3],['MATH-161','Applied Calculus',4]]){
  const row=rows.find(r=>r.code===code);assert.equal(row.name,name);assert.equal(row.credits,credits);assert.equal(row.creditUnit,'semester credits');
  assert.ok(P.searchCourses(rows,code.replace('-',' ')).some(r=>r.code===code));
  assert.ok(P.searchCourses(rows,name).some(r=>r.code===code));
 }
});
test('presentation fixes typos while preserving custom text and original records',()=>{
 const saved={settings:{semester:'fall smester',university:'Rochester Institue of Technology'},courses:[{name:'gcis 123',code:'gcis-123'},{name:'gcis'},{name:'s'},{name:'',code:'math-131'}]};
 const before=JSON.stringify(saved);
 assert.equal(P.displaySemester(saved.settings.semester),'Fall Semester');
 assert.equal(P.displaySemester('spring semester 2027'),'Spring Semester 2027');
 assert.equal(P.displaySemester('Trimester 2'),'Trimester 2');
 assert.equal(P.displayUniversity(saved.settings.university),'Rochester Institute of Technology');
 assert.equal(P.displayUniversity('My Local University'),'My Local University');
 assert.equal(P.displayCourse(saved.courses[0]),'GCIS 123');
 assert.equal(P.displayCourse(saved.courses[1]),'GCIS');
 assert.equal(P.displayCourse(saved.courses[2]),'S');
 assert.equal(P.displayCourse(saved.courses[3]),'MATH-131 — Course name not provided');
 assert.equal(P.displayCourse({name:'Discrete Mathematics',code:'math-131'}),'MATH-131 — Discrete Mathematics');
 assert.equal(JSON.stringify(saved),before);
});
test('public About keeps contact section without hardcoded personal address',()=>{
 const source=read('js/app.js');
 assert.ok(!source.includes('imomovabdullo009@gmail.com'));
 assert.match(source,/const ACADELY_CONTACT_EMAIL = ''/);
 assert.match(source,/Acadely contact — not configured yet/);
 assert.match(source,/Public creator contact/);
 // Auth remains the source of the student's private account email.
 assert.match(read('js/ux.js'),/accountUser\?\.email\|\|p.email/);
});

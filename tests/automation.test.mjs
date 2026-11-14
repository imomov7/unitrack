import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),A=require('../js/academic-automation.js'),P=require('../js/academic-planning.js');
function dataset(file,key){const c={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);return c.window[key];}
const catalogues=dataset('assets/data/course-catalogues.js','ACADELY_CATALOGUES'),majors=dataset('assets/data/majors.js','ACADELY_MAJORS');
test('semester selector preserves old custom names and validates year and name',()=>{
 assert.equal(A.semesterParts('Fall 2026').year,2026);assert.equal(A.semesterParts('Trimester 2').custom,'Trimester 2');
 assert.equal(A.semesterName('Spring',2027),'Spring 2027');assert.equal(A.semesterName('Custom',2026,'Trimester 2'),'Trimester 2');assert.equal(A.semesterName('Custom',2026,''),null);assert.equal(A.semesterName('Fall',2026.1),null);assert.equal(A.semesterName('Fall',NaN),null);
});
test('date suggestions are institution, campus and year specific, never guessed',()=>{
 const r=A.semesterSuggestion('Rochester Institute of Technology','Rochester','Fall',2026);assert.equal(r.start,'2026-08-24');assert.equal(r.end,'2026-12-16');assert.match(r.source,/rit.edu/);
 for(const [school,campus,year]of [['Unknown','',2026],['Rochester Institute of Technology','Dubai',2026],['Rochester Institute of Technology','Rochester',2028]])assert.equal(A.semesterSuggestion(school,campus,'Fall',year),null);
});
test('expanded catalogues isolate institutions, preserve source units and supply factual credits',()=>{
 const rit=A.universityCourses(catalogues,'Rochester Institute of Technology'),mit=A.universityCourses(catalogues,'Massachusetts Institute of Technology');
 assert.ok(rit.length>=20);assert.ok(mit.length>100);assert.equal(A.universityCourses(catalogues,'Unknown').length,0);assert.equal(A.universityCourses(catalogues,'Rochester Institute of Technology Dubai').length,0);
 assert.equal(rit.find(c=>c.code==='GCIS-123').credits,4);assert.equal(mit.find(c=>c.code==='6.100A').credits,6);assert.equal(mit.find(c=>c.code==='6.1020').credits,15);assert.equal(mit.find(c=>c.code==='6.100A').creditUnit,'MIT units');
 for(const group of [rit,mit]){assert.equal(new Set(group.map(c=>P.code(c.code))).size,group.length);assert.ok(group.every(c=>c.name&&c.credits>0&&/^https:\/\//.test(c.source)));}
});
test('university programs rank before general fields while manual and existing values remain valid',()=>{
 const rit=majors.filter(r=>!r.universityNames||A.sameUniversity(r.universityNames,'Rochester Institute of Technology'));
 assert.equal(P.searchMajors(rit,'CIT','Rochester Institute of Technology')[0].name,'Computing and Information Technologies BS');
 assert.ok(P.searchMajors(rit,'Information Technology').length);assert.ok(P.searchMajors(majors,'Business').length);assert.ok(P.searchMajors(majors,'Biology').length);
});
test('worldwide local university directory has explicit countries and no exact duplicates',()=>{
 const rows=dataset('assets/data/universities.js','ACADELY_UNIVERSITIES');assert.ok(rows.length>10000);assert.ok(new Set(rows.map(r=>r.country)).size>150);assert.equal(new Set(rows.map(r=>r.name.toLowerCase()+'|'+r.country)).size,rows.length);
});
test('Arabic interface persists language independently and preserves unknown official text',()=>{
 const saved=new Map(),c={window:null,document:{readyState:'loading',addEventListener(){},documentElement:{}},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},CustomEvent:class{},dispatchEvent(){},confirm:()=>true};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../locales/ar.js',import.meta.url),'utf8'),c);vm.runInContext(fs.readFileSync(new URL('../js/i18n.js',import.meta.url),'utf8'),c);
 assert.equal(c.AcadelyI18n.t('Settings'),'Settings');c.AcadelyI18n.set('ar');assert.equal(c.AcadelyI18n.t('Settings'),'الإعدادات');assert.equal(c.document.documentElement.dir,'rtl');assert.equal(saved.get('acadely-language-v1'),'ar');assert.equal(c.AcadelyI18n.t('GCIS-123'),'GCIS-123');assert.equal(c.AcadelyI18n.t('Massachusetts Institute of Technology'),'Massachusetts Institute of Technology');c.AcadelyI18n.set('en');assert.equal(c.document.documentElement.dir,'ltr');
});

test('course comparison preserves distinct non-Latin official codes',()=>{
 assert.equal(P.code('GCIS-123'),P.code('gcis 123'));
 assert.equal(P.code('حاسب-١٠١'),P.code('حاسب ١٠١'));
 assert.notEqual(P.code('حاسب-١٠١'),P.code('فيزياء-١٠١'));
 assert.ok(P.code('حاسب-١٠١').length>0);
});

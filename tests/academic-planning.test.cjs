const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../js/academic-planning.js');
test('university search ranks prefix matches and handles accents',()=>{
 const rows=[{name:'University of Rochester'},{name:'Rochester Institute of Technology'},{name:'Université de Montréal'}];
 assert.equal(P.searchUniversities(rows,'R')[0].name,'Rochester Institute of Technology');
 assert.equal(P.searchUniversities(rows,'universite')[0].name,'Université de Montréal');
 assert.deepEqual(P.searchUniversities(rows,'nothing'),[]);
});
test('recurrence respects multiple weekdays, semester boundaries, and one-date cancellations',()=>{
 const c={days:['Tuesday','Thursday'],cancelledDates:['2026-11-17']};
 const settings={start:'2026-11-01',end:'2026-11-30'};
 assert.equal(P.classOccurs(c,'2026-11-10',settings),true);
 assert.equal(P.classOccurs(c,'2026-11-12',settings),true);
 assert.equal(P.classOccurs(c,'2026-11-11',settings),false);
 assert.equal(P.classOccurs(c,'2026-11-17',settings),false);
 assert.equal(P.classOccurs(c,'2026-12-01',settings),false);
 assert.equal(P.classOccurs(c,'2026-10-29',settings),false);
 assert.equal(P.classOccurs({day:'Tuesday'},'2026-11-10',settings),true);
});
test('semester GPA weights credits, counts zero grades, and omits missing grades',()=>{
 const s={maxGpa:4,courses:[{credits:3,points:4},{credits:1,points:0},{credits:8,points:''}]};
 assert.equal(P.semesterGpa(s).value,3);
 assert.equal(P.semesterGpa(s).credits,4);
 assert.equal(P.semesterGpa({maxGpa:4,courses:[]}).value,null);
});
test('cumulative GPA keeps retake attempts and refuses incompatible scales',()=>{
 const a={status:'completed',maxGpa:4,courses:[{code:'MATH-1',credits:3,points:1}]};
 const b={status:'completed',maxGpa:4,courses:[{code:'MATH-1',credits:3,points:4}]};
 assert.equal(P.cumulativeGpa([a,b]).value,2.5);
 assert.equal(P.cumulativeGpa([a,{...b,status:'planned'}]).value,1);
 assert.equal(P.cumulativeGpa([a,{...b,maxGpa:5}]).value,null);
});
test('recommendations require explicitly checked prerequisites and exclude current/completed/planned courses',()=>{
 const history=[{status:'completed',courses:[{code:'GCIS-123',completed:true}]}];
 const req=[{code:'GCIS-124',prerequisites:['GCIS-123'],prerequisitesVerified:true},{code:'BIO-1',prerequisites:[],prerequisitesVerified:false},{code:'NEXT',prerequisites:['MISSING'],prerequisitesVerified:true},{code:'DONE',prerequisites:[],prerequisitesVerified:true}];
 const result=P.recommend(req,history,[{code:'DONE'}],[]);
 assert.equal(result.length,3);assert.equal(result[0].eligible,true);assert.equal(result[1].eligible,false);assert.equal(result[2].eligible,false);
 assert.equal(P.recommend(req,history,[],['GCIS-124']).some(r=>r.code==='GCIS-124'),false);
});
test('grade minima are checked on the recorded GPA scale before recommending a prerequisite course',()=>{
 const req=[{code:'NEXT',prerequisites:['FOUNDATION'],prerequisitesVerified:true,minimumPrerequisitePoints:2,maxGpa:4}];
 const history=points=>[{status:'completed',maxGpa:4,courses:[{code:'FOUNDATION',completed:true,points}]}];
 assert.equal(P.recommend(req,history(1),[],[])[0].eligible,false);
 assert.equal(P.recommend(req,history(2),[],[])[0].eligible,true);
 assert.equal(P.recommend(req,history(''),[],[])[0].eligible,false);
 assert.equal(P.recommend(req,[{...history(4)[0],maxGpa:5}],[],[])[0].eligible,false);
});

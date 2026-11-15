import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const planner=source.slice(source.indexOf('function makePlan()'),source.indexOf('\nfunction planRow'));
function plan(assignments,sessions=[],exams=[]){
 const data={assignments,sessions,exams,settings:{availableHours:2}};
 const before=JSON.stringify(data);
 const ctx={data,today:()=> '2026-11-15',daysUntil:date=>Math.round((Date.parse(date)-Date.parse('2026-11-15'))/86400000)};
 vm.createContext(ctx);vm.runInContext(planner,ctx);const result=JSON.parse(JSON.stringify(ctx.makePlan()));assert.equal(JSON.stringify(data),before);return result;
}
const task={id:'a',title:'Assignment',due:'2026-11-17',studyHours:2,priority:'High'};
test('saved or completed study sessions are not suggested again',()=>{
 assert.equal(plan([task]).length,1);
 for(const done of [false,true])assert.deepEqual(plan([task],[{sourceId:'a',date:task.due,hours:2,done}]),[]);
});
test('partial workload subtracts saved hours and respects each date capacity',()=>{
 const result=plan([{...task,studyHours:4},{...task,id:'b'}],[{sourceId:'a',date:task.due,hours:1}]);
 assert.equal(result.length,1);assert.equal(result[0].hours,1);
 const separateDays=plan([task,{...task,id:'b',due:'2026-11-18'}]);assert.equal(separateDays.length,2);assert.equal(separateDays.reduce((s,r)=>s+r.hours,0),4);
});
test('overdue work schedules today and respects existing personal sessions',()=>{
 const result=plan([{...task,due:'2026-11-14'}],[{date:'2026-11-15',hours:1}]);assert.equal(result[0].date,'2026-11-15');assert.equal(result[0].hours,1);assert.equal(result[0].why,'Overdue work prioritized');
});
test('exams and completed assignments do not create duplicate or finished work',()=>{
 assert.deepEqual(plan([{...task,done:true}]),[]);
 assert.deepEqual(plan([], [{sourceId:'exam',date:task.due,hours:1.5}], [{id:'exam',date:task.due,title:'Exam'}]),[]);
});

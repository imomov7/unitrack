import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const markup=source.slice(source.indexOf('function calendarEventButton'),source.indexOf('\nfunction monthGrid'));
const context={esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),categoryLabel:kind=>kind==='class'?'Class':kind==='exam'?'Exam':kind,courseName:()=> 'MATH-131 — Discrete Mathematics'};
vm.createContext(context);vm.runInContext(markup,context);
test('month and full calendar cards expose title, category, time range and room',()=>{
 const item={id:'class-a-2026-11-17',sourceId:'class-a',date:'2026-11-17',kind:'class',category:'class',title:'MATH-131 — Discrete Mathematics',start:'09:00',end:'10:00',location:'Room 214'};
 const before=JSON.stringify(item);
 for(const compact of [false,true]){const html=context.calendarEventButton(item,compact);for(const value of ['event-class','Class','Discrete Mathematics','09:00–10:00','Room 214','data-id="class-a"'])assert.ok(html.includes(value),value);assert.ok(!html.includes('event-dot'));}
 assert.equal(JSON.stringify(item),before);
});
test('exams show known details and old records state missing times/places honestly',()=>{
 const item={id:'exam',date:'2026-11-18',kind:'exam',category:'exam',title:'Midterm',courseId:'c'};
 const missing=context.calendarEventButton(item,true);assert.match(missing,/Time not set/);assert.match(missing,/Location not set/);assert.match(missing,/Discrete Mathematics/);
 const known=context.calendarEventButton({...item,start:'13:00',end:'14:30',location:'Hall B'},true);assert.match(known,/13:00–14:30/);assert.match(known,/Hall B/);assert.doesNotMatch(known,/Time not set/);
});
test('user event text is escaped and dates are not falsely presented as timed events',()=>{
 const html=context.calendarEventButton({kind:'assignment',category:'assignment',title:'<img src=x onerror=alert(1)>',done:true});assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);assert.match(html,/Date only/);assert.match(html,/Completed/);
});

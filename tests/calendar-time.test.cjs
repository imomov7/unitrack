const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../js/calendar-time.js');
test('clock uses configured IANA timezone, local fallback, date boundaries and DST',()=>{
 assert.equal(C.timezone({calendarTimezone:'Asia/Dubai',notificationPrefs:{timezone:'UTC'}},{},'UTC'),'Asia/Dubai');assert.equal(C.timezone({calendarTimezone:'invalid',notificationPrefs:{timezone:'America/New_York'}},{},'UTC'),'America/New_York');assert.equal(C.timezone({}, {},'Pacific/Auckland'),'Pacific/Auckland');
 assert.deepEqual(C.clock(Date.parse('2026-11-16T22:30:00Z'),'Asia/Dubai'),{date:'2026-11-17',time:'02:30',minutes:150});assert.equal(C.clock(Date.parse('2026-03-08T07:30:00Z'),'America/New_York').time,'03:30');assert.equal(C.clock(Date.parse('2026-11-01T05:30:00Z'),'America/New_York').minutes,C.clock(Date.parse('2026-11-01T06:30:00Z'),'America/New_York').minutes);
});
test('timed events retain records, split overnight classes and separate overlapping blocks',()=>{
 const events=[{id:'a',date:'2026-11-16',start:'09:00',end:'10:00'},{id:'b',date:'2026-11-16',start:'09:30',end:'10:30'},{id:'c',date:'2026-11-16',start:'10:30',end:'11:00'},{id:'overnight',date:'2026-11-15',start:'23:00',end:'01:00'},{id:'date-only',date:'2026-11-16'}],before=JSON.stringify(events);
 const segments=C.segments(events,'2026-11-16');assert.equal(segments.length,4);assert.equal(segments.find(x=>x.item.id==='overnight').end,60);assert.equal(segments.find(x=>x.item.id==='a').lanes,2);assert.equal(segments.find(x=>x.item.id==='c').lanes,1);assert.equal(JSON.stringify(events),before);
});
test('grid reuses event actions and retains date-only events without inventing their times',()=>{
 const html=C.grid({dates:['2026-11-16'],events:[{id:'deadline',date:'2026-11-16',title:'Assignment'}],zone:'UTC',escape:String,renderEvent:e=>`<button data-id="${e.id}">${e.title}</button>`});assert.match(html,/All-day & date-only/);assert.match(html,/data-id="deadline"/);assert.match(html,/data-calendar-now hidden/);assert.match(html,/data-timezone="UTC"/);assert.equal((html.match(/calendar-hour-label/g)||[]).length,24);
});
function controller(){
 let now=Date.parse('2026-11-16T08:59:00Z'),pending,visibility;const makeColumn=date=>{const line={hidden:true,style:{},setAttribute(){}};return {dataset:{timeColumn:date},line,classList:{toggle(){}},querySelector:()=>line,getBoundingClientRect:()=>({left:56,width:200})};};const columns=[makeColumn('2026-11-16'),makeColumn('2026-11-17')];
 const grid={isConnected:true,dataset:{range:'2026-11-16,2026-11-17',timezone:'UTC'},scrollTop:0,scrollLeft:0,clientHeight:500,clientWidth:500,scrollWidth:500,querySelector:()=>({offsetHeight:52}),querySelectorAll:selector=>selector==='[data-time-column]'?columns:[],getBoundingClientRect:()=>({left:0})};const label={},container={querySelector:selector=>selector==='[data-calendar-time-grid]'?grid:label};
 const c={Intl,Date:class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}},document:{hidden:false,addEventListener:(_,fn)=>visibility=fn,removeEventListener:()=>visibility=null},setTimeout:(fn,delay)=>{pending={fn,delay};return 1;},clearTimeout:()=>{pending=null;},module:{exports:{}}};vm.createContext(c);vm.runInContext(fs.readFileSync('js/calendar-time.js','utf8'),c);return {api:c.module.exports,grid,columns,label,container,setTime:date=>{now=Date.parse(date);},tick:()=>pending.fn(),pending:()=>pending,visible:()=>visibility?.()};
}
test('line moves before, during and after class, only on today, using a minute timer',()=>{
 const h=controller();h.api.mount(h.container);assert.equal(h.columns[0].line.hidden,false);assert.equal(h.columns[1].line.hidden,true);const top=()=>parseFloat(h.columns[0].line.style.top);assert.equal(top(),539/1440*100);assert.ok(h.pending().delay<=60020);
 h.setTime('2026-11-16T09:30:00Z');h.tick();assert.equal(top(),570/1440*100);h.setTime('2026-11-16T10:01:00Z');h.tick();assert.equal(top(),601/1440*100);h.setTime('2026-11-17T00:00:00Z');h.visible();assert.equal(h.columns[0].line.hidden,true);assert.equal(h.columns[1].line.hidden,false);
});
test('scrolling and ordinary rerenders do not move the line out of its time column or reset user scroll',()=>{
 const h=controller();h.api.mount(h.container);assert.ok(h.grid.scrollTop>0);const top=h.columns[0].line.style.top;h.grid.scrollTop=123;h.tick();assert.equal(h.grid.scrollTop,123);assert.equal(h.columns[0].line.style.top,top);h.grid.scrollTop=0; // Browsers reset scroll offsets when an old grid is detached.
 h.api.mount(h.container);assert.equal(h.grid.scrollTop,123);h.api.focusNow();h.api.mount(h.container);assert.ok(h.grid.scrollTop>123);
 h.api.mount({querySelector:()=>null});assert.equal(h.pending(),null);
});

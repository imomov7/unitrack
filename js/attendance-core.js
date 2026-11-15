/* Shared, dependency-free attendance and reminder rules. No storage or network I/O. */
(function(root){
'use strict';
const STATUSES=['present','absent','late','excused','pending'];
const WEEKDAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MINUTE=60000,DAY=86400000;
const formatters=new Map();
function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value))&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
function validTime(value){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value));}
function validZone(value){try{new Intl.DateTimeFormat('en',{timeZone:value}).format();return typeof value==='string'&&value.length<100;}catch{return false;}}
function parts(epoch,zone){if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));const p={};for(const x of formatters.get(zone).formatToParts(new Date(epoch)))if(x.type!=='literal')p[x.type]=x.value;return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};}
function shiftDate(date,amount){return new Date(Date.parse(date+'T12:00:00Z')+amount*DAY).toISOString().slice(0,10);}
function wallTime(date,time,zone,after=-Infinity){
 if(!validDate(date)||!validTime(time)||!validZone(zone))return null;
 const wanted=Date.parse(date+'T'+time+':00Z');let guess=wanted;
 for(let i=0;i<5;i++){const p=parts(guess,zone);const diff=wanted-Date.parse(p.date+'T'+p.time+':00Z');if(!diff)break;guess+=diff;}
 const candidates=[];
 // Pick the first occurrence of ambiguous clocks; skip nonexistent DST clocks.
 for(let delta=-180;delta<=180;delta+=15){const value=guess+delta*MINUTE,p=parts(value,zone);if(p.date===date&&p.time===time&&value>=after)candidates.push(value);}
 return candidates.length?Math.min(...candidates):null;
}
function preferences(raw={},fallbackZone='UTC'){
 const zone=validZone(raw.timezone)?raw.timezone:validZone(fallbackZone)?fallbackZone:'UTC';
 const interval=(value,fallback,min,max)=>Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):fallback;
 const minutes=Array.isArray(raw.assignmentMinutes)?[...new Set(raw.assignmentMinutes.map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=10080))].sort((a,b)=>b-a):[1440,60,0];
 return {enabled:raw.enabled===true,timezone:zone,attendance:raw.attendance!==false,classes:raw.classes===true,assignments:raw.assignments!==false,exams:raw.exams!==false,quizzes:raw.quizzes===true,lowAttendance:raw.lowAttendance===true,general:raw.general===true,classLead:interval(raw.classLead,10,0,1440),followup:interval(raw.followup,0,0,240),assignmentMinutes:minutes,quiet:raw.quiet===true,quietStart:validTime(raw.quietStart)?raw.quietStart:'22:00',quietEnd:validTime(raw.quietEnd)?raw.quietEnd:'07:00',language:['en','ar','ru'].includes(raw.language)?raw.language:'en'};
}
function quietAt(now,prefs){if(!prefs.quiet||prefs.quietStart===prefs.quietEnd)return false;const time=parts(now,prefs.timezone).time;return prefs.quietStart<prefs.quietEnd?time>=prefs.quietStart&&time<prefs.quietEnd:time>=prefs.quietStart||time<prefs.quietEnd;}
function occurrenceKey(classId,date){return 'class:'+encodeURIComponent(classId)+':'+date;}
function fingerprint(row){return [row.courseId,row.date,row.start].join('|');}
function resolveCourse(workspace,item){
 const courses=workspace.courses||[];if(item.courseId)return courses.find(c=>c.id===item.courseId)||null;
 const normal=value=>String(value||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' '),compact=value=>normal(value).replace(/[\s._/–-]+/g,'');
 const title=normal(item.title||item.course);if(!title)return null;
 const matches=courses.filter(c=>normal(c.name)===title||(c.code&&compact(c.code)===compact(title))||normal(courseLabel(c))===title);
 return matches.length===1?matches[0]:null;
}
function occurrences(workspace,options={}){
 const now=Number(options.now??Date.now()),zone=preferences(workspace.settings?.notificationPrefs,options.timezone).timezone,localToday=parts(now,zone).date;
 const semester=workspace.settings||{},hasTerm=validDate(semester.start)&&validDate(semester.end)&&semester.start<=semester.end;
 let from=options.from||(hasTerm?semester.start:shiftDate(localToday,-30)),to=options.to||(hasTerm?semester.end:shiftDate(localToday,30));
 if(!validDate(from)||!validDate(to)||from>to)return {items:[],limited:false,hasTerm,timezone:zone};
 if(hasTerm){from=from<semester.start?semester.start:from;to=to>semester.end?semester.end:to;}
 const items=[];let limited=false,days=0;
 for(let date=from;date<=to;date=shiftDate(date,1)){
  if(++days>730){limited=true;break;}
  const day=WEEKDAYS[new Date(date+'T12:00:00Z').getUTCDay()];
  for(const item of workspace.classes||[]){
   if(!(item.days||[item.day]).includes(day)||(item.cancelledDates||[]).includes(date)||!validTime(item.start)||!validTime(item.end))continue;
   const course=resolveCourse(workspace,item);if(!course)continue;
   const startAt=wallTime(date,item.start,zone);if(startAt===null)continue;
   const endDate=item.end<=item.start?shiftDate(date,1):date,endAt=wallTime(endDate,item.end,zone,startAt+1);if(endAt===null)continue;
   items.push({id:occurrenceKey(item.id,date),occurrenceKey:occurrenceKey(item.id,date),classId:item.id,courseId:course.id,courseName:course.name,courseCode:course.code||'',date,start:item.start,end:item.end,startAt,endAt,timezone:zone,location:item.location||'',semester:semester.semester||'',status:'pending'});
   if(items.length>=10000){limited=true;return {items,limited,hasTerm,timezone:zone};}
  }
 }
 return {items:items.sort((a,b)=>a.startAt-b.startAt),limited,hasTerm,timezone:zone};
}
function history(workspace,options={}){
 const schedule=occurrences(workspace,options),records=workspace.attendance||[],keys=new Set(records.map(r=>r.occurrenceKey)),prints=new Set(records.map(fingerprint));
 const pending=schedule.items.filter(r=>r.startAt<=Number(options.now??Date.now())&&!keys.has(r.occurrenceKey)&&!prints.has(fingerprint(r)));
 return {...schedule,records:[...records,...pending].sort((a,b)=>b.startAt-a.startAt)};
}
function currentRecords(workspace,records){const ids=new Set((workspace.courses||[]).map(c=>c.id)),settings=workspace.settings||{};return records.filter(r=>ids.has(r.courseId)&&(!validDate(settings.start)||r.date>=settings.start)&&(!validDate(settings.end)||r.date<=settings.end)&&!(workspace.classes||[]).some(c=>c.id===r.classId&&(c.cancelledDates||[]).includes(r.date)));}
function summary(records,now=Date.now(),target=75){
 const confirmed=records.filter(r=>Number(r.startAt)<=now&&STATUSES.includes(r.status)&&r.status!=='pending');
 const count=status=>confirmed.filter(r=>r.status===status).length;
 const present=count('present'),late=count('late'),absent=count('absent'),excused=count('excused'),held=confirmed.length,denominator=held-excused;
 const percentage=denominator?(present+late)/denominator*100:null;
 return {present,late,absent,excused,held,denominator,percentage,pending:records.filter(r=>r.status==='pending'&&Number(r.startAt)<=now).length,target,status:percentage===null?'No records':percentage<target?'At Risk':percentage<Math.min(100,target+5)?'Warning':'Good'};
}
function courseTarget(workspace,id){const n=Number(workspace.settings?.attendanceTargets?.[id]);return Number.isFinite(n)&&n>=0&&n<=100?n:75;}
function courseLabel(course){return [course?.code,course?.name].filter(Boolean).join(' — ')||'Course';}
function reminderJobs(workspace,rawPrefs,now=Date.now()){
 const prefs=preferences(rawPrefs,workspace.studentProfile?.timezone||'UTC');if(!prefs.enabled)return [];
 const local=parts(now,prefs.timezone).date,all=occurrences(workspace,{now,from:shiftDate(local,-2),to:shiftDate(local,3),timezone:prefs.timezone}).items;
 const records=workspace.attendance||[],jobs=[];
 const add=(id,category,title,body,dueAt,expiresAt,route,extra={})=>{if(dueAt!==null&&Number.isFinite(dueAt)&&expiresAt>=now&&dueAt<=now+2*DAY)jobs.push({id,category,title,body,dueAt,expiresAt,route,...extra});};
 const words={en:{attendance:'Acadely — Attendance reminder',started:'Your class has started. Did you attend?',class:'Acadely — Class reminder',assignment:'Acadely — Assignment reminder',exam:'Acadely — Exam reminder',quiz:'Acadely — Quiz reminder',event:'Acadely — Academic reminder',low:'Acadely — Attendance warning'},ar:{attendance:'Acadely — تذكير بالحضور',started:'بدأت محاضرتك. هل حضرت؟',class:'Acadely — تذكير بالمحاضرة',assignment:'Acadely — تذكير بواجب',exam:'Acadely — تذكير بامتحان',quiz:'Acadely — تذكير باختبار قصير',event:'Acadely — تذكير أكاديمي',low:'Acadely — تنبيه الحضور'},ru:{attendance:'Acadely — Напоминание о посещаемости',started:'Занятие началось. Вы присутствовали?',class:'Acadely — Напоминание о занятии',assignment:'Acadely — Напоминание о задании',exam:'Acadely — Напоминание об экзамене',quiz:'Acadely — Напоминание о тесте',event:'Acadely — Академическое напоминание',low:'Acadely — Предупреждение о посещаемости'}}[prefs.language];
 for(const o of all){
  const done=records.some(r=>(r.occurrenceKey===o.id||fingerprint(r)===fingerprint(o))&&r.status!=='pending');
  const body=courseLabel({code:o.courseCode,name:o.courseName})+' · '+o.date+' '+o.start+(o.location?' · '+o.location:'');
  const extra={occurrenceKey:o.id,classId:o.classId,date:o.date,start:o.start,courseId:o.courseId};
  if(prefs.classes&&(prefs.classLead>0||!prefs.attendance))add('lead:'+o.id,'class',words.class,body,o.startAt-prefs.classLead*MINUTE,o.startAt,'calendar',extra);
  if(prefs.attendance&&!done){add('attendance:'+o.id,'attendance',words.attendance,body+'\n'+words.started,o.startAt,o.startAt+10*MINUTE,'attendance',extra);if(prefs.followup>0)add('followup:'+o.id,'attendance',words.attendance,body+'\n'+words.started,o.startAt+prefs.followup*MINUTE,o.startAt+(prefs.followup+10)*MINUTE,'attendance',extra);}
 }
 const courseOf=id=>(workspace.courses||[]).find(c=>c.id===id);
 for(const a of workspace.assignments||[]){if(!prefs.assignments||a.done||!validDate(a.due))continue;const deadline=wallTime(a.due,validTime(a.dueTime)?a.dueTime:'23:59',prefs.timezone);if(deadline===null)continue;for(const minutes of prefs.assignmentMinutes){const at=deadline-minutes*MINUTE;add('assignment:'+a.id+':'+deadline+':'+minutes,'assignment',words.assignment,a.title+' · '+courseLabel(courseOf(a.courseId))+'\n'+a.due+' '+(a.dueTime||'23:59')+' · '+prefs.timezone,at,minutes?deadline:deadline+60*MINUTE,'assignments',{assignmentId:a.id,courseId:a.courseId});}}
 for(const e of workspace.exams||[]){const quiz=e.type==='quiz';if(!(quiz?prefs.quizzes:prefs.exams)||!validDate(e.date))continue;const timed=validTime(e.start);const at=wallTime(e.date,timed?e.start:'09:00',prefs.timezone);if(at===null)continue;for(const minutes of timed?[1440,60]:[1440])add((quiz?'quiz:':'exam:')+e.id+':'+at+':'+minutes,quiz?'quiz':'exam',quiz?words.quiz:words.exam,e.title+' · '+courseLabel(courseOf(e.courseId))+'\n'+e.date+(timed?' '+e.start:' · '+({en:'Time not set',ar:'لم يُحدد الوقت',ru:'Время не указано'}[prefs.language])),at-minutes*MINUTE,timed?at:at+DAY,'exams',{examId:e.id,courseId:e.courseId});}
 for(const e of workspace.events||[]){const quiz=e.category==='quiz';if(!(quiz?prefs.quizzes:prefs.general)||!validDate(e.date))continue;const at=wallTime(e.date,validTime(e.start)?e.start:'23:59',prefs.timezone);if(at!==null)add('event:'+e.id+':'+at,quiz?'quiz':'general',quiz?words.quiz:words.event,e.title+' · '+e.date+(e.start?' '+e.start:''),at-60*MINUTE,at,'calendar',{eventId:e.id});}
 if(prefs.general)for(const [key,title]of [['start','Semester begins'],['end','Semester ends']]){const date=workspace.settings?.[key];if(!validDate(date))continue;const at=wallTime(date,'09:00',prefs.timezone);add('academic:'+key+':'+date,'general',words.event,title+' · '+date,at,at+DAY,'calendar');}
 if(prefs.lowAttendance)for(const course of workspace.courses||[]){const rows=currentRecords(workspace,records).filter(r=>r.courseId===course.id),s=summary(rows,now,courseTarget(workspace,course.id));if(s.percentage!==null&&s.percentage<s.target){const at=wallTime(local,'09:00',prefs.timezone);add('low:'+course.id+':'+local,'low',words.low,courseLabel(course)+' · '+s.percentage.toFixed(1)+'% / '+s.target+'%',at,at+DAY,'attendance',{courseId:course.id});}}
 return jobs.sort((a,b)=>a.dueAt-b.dueAt);
}
const api={STATUSES,validDate,validTime,validZone,parts,shiftDate,wallTime,preferences,quietAt,occurrenceKey,fingerprint,resolveCourse,occurrences,history,currentRecords,summary,courseTarget,courseLabel,reminderJobs};
root.AcadelyAttendance=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

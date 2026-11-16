function attendanceDialog(...args){const dialog=academicDialog(...args);dialog.classList.add('attendance-dialog');return dialog;}
/* Attendance and notification UI reuse the existing private workspace and save flow. */
let attendanceCourseFilter='',attendanceDateFilter='',attendanceStatusFilter='';
let academicBackend={configured:false,reason:'Server setup required'},academicBackendChecked=0,academicBackendBusy=false,academicOwner=null,academicTickBusy=false;
let academicDeviceEnabled=false,academicIntentBusy=false,academicPushBusy=false;
function academicZone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}catch{return 'UTC';}}
function academicPrefs(){return AcadelyAttendance.preferences(data.settings.notificationPrefs,AcadelyAttendance.validZone(data.studentProfile.timezone)?data.studentProfile.timezone:data.settings.notificationPrefs?.enabled?'UTC':academicZone());}
function attendanceScope(){
 const now=Date.now(),h=AcadelyAttendance.history(data,{now,timezone:academicPrefs().timezone});
 const counted=AcadelyAttendance.currentRecords(data,h.records);
 return {...h,counted,now};
}
function attendanceStatusLabel(status){return ({present:'Present',absent:'Absent',late:'Late',excused:'Excused',pending:'Pending'})[status]||'Pending';}
function attendancePercent(value){return value===null?'—':value.toFixed(1)+'%';}
function attendancePage(){
 const h=attendanceScope(),s=AcadelyAttendance.summary(h.counted,h.now),archive=new Map();
 for(const r of data.attendance||[])if(!data.courses.some(c=>c.id===r.courseId))archive.set(r.courseId,{id:r.courseId,name:r.courseName||'Archived course',code:r.courseCode||''});
 const options=[...data.courses,...archive.values()];
 const rows=h.records.filter(r=>(!attendanceCourseFilter||r.courseId===attendanceCourseFilter)&&(!attendanceDateFilter||r.date===attendanceDateFilter)&&(!attendanceStatusFilter||r.status===attendanceStatusFilter));
 return `${pageHeader('Attendance','Track your classes and confirm attendance.',button('Add attendance record','attendance-add','primary'))}<p class="helper-text">Attendance = (Present + Late) ÷ (Held − Excused) × 100. Future classes and pending confirmations are excluded.</p>${!h.hasTerm?'<p class="notice-hint">Schedule totals use the last 30 and next 30 days until you set semester dates. Saved history is preserved.</p>':''}${h.limited?'<p class="notice-hint">Schedule preview is limited. Use date filters to review saved history.</p>':''}${data.classes.some(c=>!AcadelyAttendance.resolveCourse(data,c))?'<p class="notice-hint">Some timetable classes need a course link before attendance can be tracked. <a href="#timetable">Open class schedule</a></p>':''}<p class="helper-text">At Risk means below your target. Warning means within five percentage points above your target.</p><section class="stats-grid attendance-stats">${stat('Overall attendance',attendancePercent(s.percentage),'Current enrolled courses')}${stat('Classes scheduled',h.items.length,'Within the displayed semester range')}${stat('Classes attended',s.present,'Confirmed present')}${stat('Classes missed',s.absent,'Confirmed absent')}${stat('Late arrivals',s.late,'Counted as attended')}${stat('Excused absences',s.excused,'Excluded from the denominator')}${stat('Awaiting confirmation',s.pending,'Never automatically marked absent')}</section>${card('Attendance by course','Default target is 75%. Confirm and adjust your university requirements.',data.courses.length?`<div class="attendance-course-grid">${data.courses.map(c=>{const x=AcadelyAttendance.summary(h.counted.filter(r=>r.courseId===c.id),h.now,AcadelyAttendance.courseTarget(data,c.id));return `<section class="attendance-course"><span class="attendance-risk risk-${x.status.replace(/\s/g,'').toLowerCase()}">${x.status}</span><h3 translate="no">${esc(AcadelyPlanning.displayCourse(c))}</h3><strong>${attendancePercent(x.percentage)}</strong><progress max="100" value="${x.percentage??0}" aria-label="Attendance progress"></progress><p><span>Held classes</span>: ${x.held} · <span>Present</span>: ${x.present} · <span>Absent</span>: ${x.absent} · <span>Late</span>: ${x.late} · <span>Excused</span>: ${x.excused}</p><p><span>Minimum attendance target</span>: ${x.target}%</p><div class="row-actions"><button type="button" data-action="attendance-course" data-id="${esc(c.id)}">View history</button><button type="button" data-action="attendance-target" data-id="${esc(c.id)}">Edit target</button></div></section>`;}).join('')}</div>`:empty('No courses yet','Add a course to start tracking attendance.','course'))}${card('Attendance history','Pending classes are awaiting your confirmation. Archived records are retained.',`<div class="attendance-filters"><label>Course<select id="attendance-course"><option value="">All courses</option>${options.map(c=>`<option value="${esc(c.id)}" ${attendanceCourseFilter===c.id?'selected':''} translate="no">${esc(AcadelyPlanning.displayCourse(c))}</option>`).join('')}</select></label><label>Date<input id="attendance-date" type="date" value="${esc(attendanceDateFilter)}"></label><label>Status<select id="attendance-status"><option value="">All statuses</option>${AcadelyAttendance.STATUSES.map(status=>`<option value="${status}" ${attendanceStatusFilter===status?'selected':''}>${attendanceStatusLabel(status)}</option>`).join('')}</select></label><button class="button button-secondary" type="button" data-action="attendance-clear">Clear filters</button></div><div class="attendance-history">${rows.length?rows.slice(0,300).map(r=>`<article class="attendance-history-row"><div><strong translate="no">${esc([r.courseCode,r.courseName].filter(Boolean).join(' — '))}</strong><p>${dateLabel(r.date)} · <span translate="no" dir="ltr">${esc(r.start)}${r.end?'–'+esc(r.end):''}</span>${r.location?' · <span translate="no">'+esc(r.location)+'</span>':''}</p>${r.notes?'<p translate="no">'+esc(r.notes)+'</p>':''}</div><span class="attendance-status status-${r.status}">${attendanceStatusLabel(r.status)}</span><button class="button button-secondary" type="button" data-action="attendance-edit" data-key="${esc(r.occurrenceKey)}">${r.status==='pending'?'Confirm attendance':'Edit'}</button></article>`).join(''):'<p class="quiet-state">No attendance records match these filters.</p>'}</div>${rows.length>300?'<p class="helper-text">Showing the latest 300 records. Narrow the filters to see older records.</p>':''}`)}`;
}
function openAttendanceDialog(key=''){
 const existing=(data.attendance||[]).find(r=>r.occurrenceKey===key),pending=key?attendanceScope().records.find(r=>r.occurrenceKey===key):null,record=existing||pending;
 if(!record&&!data.courses.length){msg('Add a course first.');return;}
 const locked=!!record?.classId;
 const courses=[...data.courses];if(record&&!courses.some(c=>c.id===record.courseId))courses.push({id:record.courseId,name:record.courseName,code:record.courseCode});
 attendanceDialog(record?'Confirm or edit attendance':'Add attendance record',`<p class="helper-text">Changes affect attendance only. Grades and GPA are unchanged.</p><label>Course<select name="courseId" required ${locked?'disabled':''}>${courses.map(c=>`<option translate="no" value="${esc(c.id)}" ${record?.courseId===c.id?'selected':''}>${esc(AcadelyPlanning.displayCourse(c))}</option>`).join('')}</select></label><div class="two-fields"><label>Date<input name="date" type="date" value="${esc(record?.date||AcadelyAttendance.parts(Date.now(),academicPrefs().timezone).date)}" required ${locked?'readonly':''}></label><label>Scheduled class time<input name="start" type="time" value="${esc(record?.start||'')}" required ${locked?'readonly':''}></label></div><label>End time (optional)<input name="end" type="time" value="${esc(record?.end||'')}" ${locked?'readonly':''}></label><label>Attendance status<select name="status">${AcadelyAttendance.STATUSES.map(status=>`<option value="${status}" ${record?.status===status?'selected':''}>${attendanceStatusLabel(status)}</option>`).join('')}</select></label><label>Notes (optional)<textarea name="notes" maxlength="500">${esc(record?.notes||'')}</textarea></label><p class="helper-text">${esc(academicPrefs().timezone)}</p>`,(f,d)=>{
  const courseId=locked?record.courseId:String(f.get('courseId')),date=locked?record.date:String(f.get('date')),start=locked?record.start:String(f.get('start')),end=locked?record.end:String(f.get('end')||''),zone=record?.timezone||academicPrefs().timezone,status=String(f.get('status'));
  const at=AcadelyAttendance.wallTime(date,start,zone);
  if(at===null||!AcadelyAttendance.STATUSES.includes(status)||(end&&!AcadelyAttendance.validTime(end)))return msg('Enter a valid date, class time, and attendance status.');
  if(at>Date.now())return msg('Future classes cannot be marked. Confirm attendance after the class starts.');
  const candidate=AcadelyAttendance.occurrences(data,{from:date,to:date,timezone:zone}).items.find(r=>r.courseId===courseId&&r.start===start);
  const identity=(locked?record.occurrenceKey:null)||candidate?.occurrenceKey||'manual:'+encodeURIComponent(courseId)+':'+date+':'+start;
  const duplicate=(data.attendance||[]).find(r=>r.id!==existing?.id&&(r.occurrenceKey===identity||AcadelyAttendance.fingerprint(r)===[courseId,date,start].join('|')));
  if(duplicate){closeDialog(d);openAttendanceDialog(duplicate.occurrenceKey);return msg('This class already has an attendance record. You can edit it.');}
  const course=courses.find(c=>c.id===courseId);if(!course)return msg('Choose a course that still exists.');
  const saved={...(existing||candidate||record||{}),id:existing?.id||makeId(),occurrenceKey:identity,courseId,courseName:record?.courseId===courseId?record.courseName:course.name,courseCode:record?.courseId===courseId?record.courseCode:course.code||'',classId:record?.classId||candidate?.classId||'',date,start,end,timezone:zone,startAt:at,endAt:end?AcadelyAttendance.wallTime(end<=start?AcadelyAttendance.shiftDate(date,1):date,end,zone,at+1):null,status,notes:String(f.get('notes')||'').trim(),semester:record?.semester||data.settings.semester||'',updatedAt:new Date().toISOString()};
  data.attendance=data.attendance||[];if(existing)Object.assign(existing,saved);else data.attendance.push(saved);closeDialog(d);save();msg('Attendance saved.');
 });
}
function preservePendingAttendance(pastDatesOnly=false){
 const records=AcadelyAttendance.history(data,{now:Date.now(),timezone:academicPrefs().timezone}).records;
 const localToday=AcadelyAttendance.parts(Date.now(),academicPrefs().timezone).date;
 for(const row of records)if(row.status==='pending'&&(!pastDatesOnly||row.date<localToday)&&!data.attendance.some(r=>r.occurrenceKey===row.occurrenceKey||AcadelyAttendance.fingerprint(r)===AcadelyAttendance.fingerprint(row)))data.attendance.push({...row,id:makeId(),notes:'',updatedAt:new Date().toISOString()});
}
function editAttendanceTarget(id){const course=data.courses.find(c=>c.id===id);if(!course)return;attendanceDialog('Minimum attendance target',`<p translate="no">${esc(AcadelyPlanning.displayCourse(course))}</p><label>Target percentage<input name="target" type="number" min="0" max="100" step="0.1" required value="${AcadelyAttendance.courseTarget(data,id)}"></label>`,(f,d)=>{const n=Number(f.get('target'));if(!Number.isFinite(n)||n<0||n>100)return msg('Enter a percentage from 0 to 100.');data.settings.attendanceTargets={...(data.settings.attendanceTargets||{}),[id]:n};closeDialog(d);save();});}
function attendanceNotificationSettings(){
 const p=academicPrefs(),permission=typeof Notification==='undefined'?'unsupported':Notification.permission;
 const fields=[['classes','Class reminders'],['attendance','Attendance confirmation reminders'],['assignments','Assignment deadline reminders'],['exams','Exam reminders'],['quizzes','Quiz reminders'],['lowAttendance','Low attendance warnings'],['general','General academic reminders']];
 const supported=typeof PushManager!=='undefined'&&'serviceWorker' in navigator&&typeof Notification!=='undefined'&&(!isIosDevice()||isStandaloneApp());
 return card('Notifications & attendance','Choose your reminders. Browser permission is requested only when you tap Enable push.',`<p id="push-server-status" class="notice-hint">${academicBackend.configured?'Push server connected':academicBackend.reason}</p><p class="helper-text">In-app reminders work while Acadely is open. Closed-app push requires the configured server, an installed app where required, and browser permission.</p><form id="notification-settings-form" class="settings-form"><label class="remember-choice"><input type="checkbox" name="enabled" ${p.enabled?'checked':''}>Enable academic reminders</label><div class="notification-options">${fields.map(([key,label])=>`<label class="remember-choice"><input type="checkbox" name="${key}" ${p[key]?'checked':''}>${label}</label>`).join('')}</div><div class="two-fields"><label>Reminder timezone<input name="timezone" value="${esc(p.timezone)}" required maxlength="100" placeholder="Asia/Dubai"></label><label>Minutes before class<input name="classLead" type="number" min="0" max="1440" value="${p.classLead}" required></label></div><label>Attendance follow-up (minutes, 0 disables)<input name="followup" type="number" min="0" max="240" value="${p.followup}" required></label><label>Assignment reminders (minutes before deadline)<input name="assignmentMinutes" value="${p.assignmentMinutes.join(', ')}" placeholder="1440, 60, 0"></label><p class="helper-text">1440 = 24 hours, 60 = 1 hour, 0 = at the deadline. Date-only assignments use 23:59 in your reminder timezone. Exams without a start time receive only a day-before reminder at 09:00; their start time is not guessed.</p><label class="remember-choice"><input type="checkbox" name="quiet" ${p.quiet?'checked':''}>Quiet hours</label><div class="two-fields"><label>Quiet hours start<input name="quietStart" type="time" value="${p.quietStart}" required></label><label>Quiet hours end<input name="quietEnd" type="time" value="${p.quietEnd}" required></label></div><p class="helper-text">Quiet hours mute push delivery. Reminders remain in your notification center. Low-attendance warnings are limited to one per course each day.</p><button class="button button-primary" type="submit">Save notification preferences</button></form><div class="notification-permission"><p><span>Notification permission</span>: <strong>${esc(permission)}</strong></p>${permission==='denied'?'<p class="helper-text">Notifications are blocked. Open this website’s permissions in your browser or device Settings and allow notifications.</p>':''}${!supported?'<p class="helper-text">Push is not supported in this browser. On iPhone or iPad, open Acadely in Safari, share it to your Home Screen, then open the installed app on iOS 16.4 or later.</p>':''}<div class="row-actions"><button class="button button-secondary" type="button" data-action="academic-enable-push" ${!supported||!accountUser||!academicBackend.configured||academicPushBusy?'disabled':''}>Enable push on this device</button><button class="button button-secondary" type="button" data-action="academic-disable-push" ${!academicDeviceEnabled?'disabled':''}>Pause push on this device</button><button class="button button-secondary" type="button" data-action="academic-test-push" ${!supported||!accountUser||!academicBackend.configured||academicPushBusy?'disabled':''}>Send test notification</button><button class="button button-secondary" type="button" data-action="academic-check-push">Check server setup</button></div>${!accountUser?'<p class="helper-text">Sign in to enable closed-app push notifications.</p>':''}</div>`);
}
function bindAttendanceForms(){
 for(const [id,set]of [['attendance-course',v=>attendanceCourseFilter=v],['attendance-date',v=>attendanceDateFilter=v],['attendance-status',v=>attendanceStatusFilter=v]])document.getElementById(id)?.addEventListener('change',e=>{set(e.target.value);render();});
 const form=document.querySelector('#notification-settings-form');
 form?.addEventListener('submit',e=>{e.preventDefault();if(saveAcademicPreferences(form))msg('Notification preferences saved.');});
 // A checked master switch must immediately match the saved setting used by push.
 form?.elements.namedItem('enabled')?.addEventListener('change',()=>{if(saveAcademicPreferences(form))msg('Notification preferences saved.');});
}
function saveAcademicPreferences(form){
 if(!form||!form.reportValidity())return false;
 const f=new FormData(form),timezone=String(f.get('timezone')).trim(),raw=String(f.get('assignmentMinutes')).trim();
 const values=raw?raw.split(',').map(v=>Number(v.trim())):[];
 if(!AcadelyAttendance.validZone(timezone)||values.some(n=>!Number.isInteger(n)||n<0||n>10080)||!Number.isFinite(Number(f.get('classLead')))||Number(f.get('classLead'))<0||Number(f.get('classLead'))>1440||!Number.isFinite(Number(f.get('followup')))||Number(f.get('followup'))<0||Number(f.get('followup'))>240){msg('Enter a valid timezone and reminder intervals from 0 to 10080 minutes.');return false;}
 const rawPrefs={timezone,assignmentMinutes:values,language:window.AcadelyI18n?.language||'en',classLead:Number(f.get('classLead')),followup:Number(f.get('followup')),quietStart:String(f.get('quietStart')),quietEnd:String(f.get('quietEnd'))};
 for(const name of ['enabled','classes','attendance','assignments','exams','quizzes','lowAttendance','general','quiet'])rawPrefs[name]=form.elements.namedItem(name)?.checked===true;
 const prefs=AcadelyAttendance.preferences(rawPrefs,academicZone());
 if(JSON.stringify(data.settings.notificationPrefs)!==JSON.stringify(prefs)){data.settings.notificationPrefs=prefs;save();}
 return true;
}
function prepareAcademicPush(){
 const form=document.querySelector('#notification-settings-form');
 if(form&&!saveAcademicPreferences(form))return false;
 if(!academicPrefs().enabled){msg('Enable academic reminders first. The switch saves automatically.');return false;}
 return true;
}
function academicPushTimeout(promise,message){
 let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),20000);})]).finally(()=>clearTimeout(timer));
}

function notificationCenter(){
 const existing=document.querySelector('#notification-center');if(existing){closeDialog(existing);return;}
 const rows=(data.notificationHistory||[]).filter(r=>!r.removed).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,200);
 const d=document.createElement('dialog');d.id='notification-center';d.className='app-dialog notification-center';d.innerHTML=`<div class="panel-heading"><div><h2>Notification center</h2><p>Academic reminders and attendance confirmations.</p></div><button type="button" class="close-dialog" data-cancel aria-label="Close">×</button></div><div class="row-actions"><button type="button" class="button button-secondary" data-action="notice-read-all">Mark all as read</button><a class="text-link" href="#settings" data-cancel>Notification settings</a></div><div class="notification-list">${rows.length?rows.map(r=>`<article class="notification-item ${r.read?'':'is-unread'}"><div><span class="eyebrow">${esc(noticeCategory(r.category))}</span><strong>${esc(r.title)}</strong><p translate="no">${esc(r.body)}</p><small>${new Date(r.createdAt).toLocaleString(window.AcadelyI18n?.locale||'en')}</small></div><div class="row-actions"><button type="button" data-action="notice-open" data-id="${esc(r.id)}">Open</button>${!r.read?`<button type="button" data-action="notice-read" data-id="${esc(r.id)}">Mark as read</button>`:''}<button type="button" data-action="notice-remove" data-id="${esc(r.id)}">Remove</button></div></article>`).join(''):'<p class="quiet-state">No notifications yet. Enable reminders in Settings.</p>'}</div>`;
 document.body.append(d);openDialog(d);d.querySelectorAll('[data-cancel]').forEach(b=>b.addEventListener('click',()=>closeDialog(d)));d.addEventListener('close',()=>d.remove());
}
function noticeCategory(value){return ({attendance:'Attendance',class:'Class',assignment:'Assignment',exam:'Exam',quiz:'Quiz',general:'Academic reminder',low:'Attendance warning',test:'Test notification'})[value]||'Academic reminder';}
function updateNotificationBell(){const n=(data.notificationHistory||[]).filter(r=>!r.read&&!r.removed).length,el=document.querySelector('#notification-count');if(el){el.textContent=String(n);el.hidden=!n;}document.querySelector('#notification-bell')?.setAttribute('aria-label','Notification center');}
async function academicRemote(action,details={}){if(!accountUser||!window.ACADELY_PUSH_CONFIG?.apiEnabled||!window.AcadelyCloudService?.academicRequest)throw new Error('Server setup required');return window.AcadelyCloudService.academicRequest({action,...details});}
function updateAcademicPushControls(){
 const supported=typeof PushManager!=='undefined'&&'serviceWorker' in navigator&&typeof Notification!=='undefined'&&(!isIosDevice()||isStandaloneApp());
 const unavailable=!supported||!accountUser||!academicBackend.configured||academicPushBusy;
 for(const action of ['academic-enable-push','academic-test-push']){const button=document.querySelector(`[data-action="${action}"]`);if(button)button.disabled=unavailable;}
 const pause=document.querySelector('[data-action="academic-disable-push"]');if(pause)pause.disabled=!academicDeviceEnabled||academicPushBusy;
}
async function checkAcademicBackend(force=false){
 if(!accountUser||!window.ACADELY_PUSH_CONFIG?.apiEnabled){academicBackend={configured:false,reason:'Server setup required'};return;}
 if(academicBackendBusy||(!force&&Date.now()-academicBackendChecked<(academicBackend.configured?300000:60000))||(!force&&academicBackendChecked&&currentPage!=='settings'&&!academicBackend.configured))return;
 academicBackendBusy=true;academicBackendChecked=Date.now();const owner=accountUser.id;
 try{const result=await academicRemote('status');if(accountUser?.id!==owner)return;academicBackend={...result,reason:result.configured?'Push server connected':result.reason||'Server setup required'};}
 catch{if(accountUser?.id===owner)academicBackend={configured:false,reason:'Push server unavailable. In-app reminders remain available.'};}
 finally{academicBackendBusy=false;const status=document.querySelector('#push-server-status');if(status){status.textContent=academicBackend.reason;window.AcadelyI18n?.apply(status);}updateAcademicPushControls();}
}
async function saveWorkerContext(userId){try{await window.AcadelyPushStore?.set('context',{userId,at:Date.now()});}catch{/* Unsupported device storage disables one-tap handoff, not the app. */}}
async function enableAcademicPush(){
 if(academicPushBusy)return false;
 if(!accountUser||!academicBackend.configured){msg('Complete server setup before enabling push.');return false;}
 if(!prepareAcademicPush())return false;
 const owner=accountUser.id;academicPushBusy=true;render();
 try{
  // Request permission in the original click, before any network or worker await.
  const permission=await Notification.requestPermission();if(accountUser?.id!==owner){msg('The signed-in account changed. Please try again.');return false;}if(permission!=='granted'){msg('Notification permission was not granted.');return false;}
  msg('Connecting this device to notifications…');
  const registration=await academicPushTimeout(navigator.serviceWorker.ready,'The app worker is not ready. Reload Acadely and try again.');
  const key=academicBackend.publicKey,bytes=Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  let subscription=await academicPushTimeout(registration.pushManager.getSubscription(),'Device notification setup timed out. Please try again.');
  if(!subscription)subscription=await academicPushTimeout(registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes}),'Device notification setup timed out. Please try again.');
  if(accountUser?.id!==owner)return false;
  await academicPushTimeout(academicRemote('subscribe',{subscription:subscription.toJSON(),timezone:academicPrefs().timezone}),'The notification server did not respond. Please try again.');
  if(accountUser?.id!==owner)return false;
  await window.AcadelyPushStore?.set('paused:'+owner,false);await saveWorkerContext(owner);academicDeviceEnabled=true;
  msg('Push enabled on this device. Send a test notification to verify delivery.');return true;
 }catch(error){msg(error?.message||'Push could not be enabled. Check installation, permission, and server setup.');return false;}
 finally{academicPushBusy=false;render();}
}
async function testAcademicPush(){
 if(academicPushBusy)return;
 const owner=accountUser?.id;
 // Verify the server subscription even when a cached browser subscription exists.
 if(!await enableAcademicPush())return;
 if(!owner||accountUser?.id!==owner)return;
 academicPushBusy=true;render();msg('Queuing test notification…');
 try{
  const result=await academicPushTimeout(academicRemote('test'),'The notification server did not respond. Please try again.');
  if(accountUser?.id!==owner)return;
  if(result?.queued!==true)throw new Error('The test could not be queued. Check the server setup.');
  academicBackend.historyRequested=true;
  msg('Test queued. Allow up to one minute for delivery. Check device notification permissions if it does not arrive.');
 }catch(error){if(accountUser?.id===owner)msg(error?.message||'The test could not be queued. Check the server setup.');}
 finally{academicPushBusy=false;render();}
}
async function pauseAcademicPush(){try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub)await academicRemote('pause',{endpoint:sub.endpoint});await window.AcadelyPushStore?.set('paused:'+accountUser.id,true);await saveWorkerContext(null);academicDeviceEnabled=false;render();msg('Push paused on this device.');}catch{msg('Could not pause server delivery. Please retry when connected.');}}
function pauseAcademicContext(){document.querySelectorAll('#notification-center,.attendance-dialog').forEach(closeDialog);saveWorkerContext(null);academicOwner=null;academicDeviceEnabled=false;attendanceCourseFilter=attendanceDateFilter=attendanceStatusFilter='';}
async function processAcademicIntent(){
 if(academicIntentBusy||!accountUser)return;academicIntentBusy=true;let processed=false;
 try{const intent=await window.AcadelyPushStore?.getIntent(accountUser?.id);if(!intent)return;if(Date.now()-intent.createdAt>7*86400000){await window.AcadelyPushStore.removeIntent(intent.id);processed=true;return;}if(!accountUser||intent.userId!==accountUser.id)return;
  const h=attendanceScope(),o=h.records.find(r=>r.occurrenceKey===intent.occurrenceKey)||h.items.find(r=>r.occurrenceKey===intent.occurrenceKey);
  if(intent.status&&o&&o.startAt<=Date.now()&&['present','absent'].includes(intent.status)&&!data.attendance.some(r=>r.occurrenceKey===o.occurrenceKey&&r.status!=='pending')){
   const live=AcadelyAttendance.occurrences(data,{from:o.date,to:o.date,now:Date.now(),timezone:o.timezone}).items.find(r=>r.occurrenceKey===o.occurrenceKey);if(live&&live.start===intent.start&&live.startAt===o.startAt){data.attendance=data.attendance.filter(r=>r.occurrenceKey!==o.occurrenceKey);data.attendance.push({...o,id:makeId(),status:intent.status,notes:'',updatedAt:new Date().toISOString()});save();}
  }
  await window.AcadelyPushStore.removeIntent(intent.id);processed=true;if(accountUser?.id!==intent.userId)return;openAcademicNotice({...intent,courseId:o?.courseId||'',date:o?.date||intent.date},!intent.status);
 }catch{/* Keep a failed device intent available for a later signed-in retry. */}finally{academicIntentBusy=false;if(processed&&accountUser)window.AcadelyPushStore?.getIntent(accountUser.id).then(next=>{if(next)queueMicrotask(()=>processAcademicIntent());}).catch(()=>{});}
}
async function syncAcademicNotices(){
 updateNotificationBell();if(academicTickBusy||(cloudConfigured&&!authReady)||appShell.hidden)return;
 academicTickBusy=true;
 try{
  const owner=accountUser?.id||'local';if(academicOwner!==owner){academicOwner=owner;academicBackendChecked=0;academicBackend.historyRequested=true;academicDeviceEnabled=false;const paused=accountUser?await window.AcadelyPushStore?.get('paused:'+accountUser.id).catch(()=>false):false;await saveWorkerContext(paused?null:accountUser?.id||null);if(accountUser){try{const reg=await navigator.serviceWorker?.getRegistration();academicDeviceEnabled=!paused&&!!(await reg?.pushManager?.getSubscription());if(academicDeviceEnabled&&window.ACADELY_PUSH_CONFIG?.apiEnabled){const sub=await reg.pushManager.getSubscription();await academicRemote('subscribe',{subscription:sub.toJSON(),timezone:academicPrefs().timezone});}}catch{/* No configured backend yet. */}}}
  if((accountUser?.id||'local')!==owner)return;
  await checkAcademicBackend();if((accountUser?.id||'local')!==owner)return;
  const p=academicPrefs(),now=Date.now();let changed=false;
  for(const job of AcadelyAttendance.reminderJobs(data,p,now)){if(job.dueAt>now||job.dueAt<now-10*60000||data.notificationHistory.some(r=>r.id===job.id))continue;data.notificationHistory.push({...job,createdAt:new Date(job.dueAt).toISOString(),read:false,removed:false});changed=true;}
  if(accountUser&&academicBackend.configured){for(const row of data.notificationHistory.filter(r=>r.syncPending).slice(0,8)){try{await academicRemote(row.syncPending,{id:row.id});if(accountUser?.id!==owner)return;delete row.syncPending;changed=true;}catch{break;}}}
  if(accountUser&&academicBackend.configured&&(academicBackend.historyRequested||!academicBackend.historyChecked)){academicBackend.historyRequested=false;academicBackend.historyChecked=Date.now();try{const result=await academicRemote('history');if(accountUser?.id!==owner)return;for(const row of result.notifications||[]){const local=data.notificationHistory.find(r=>r.id===row.id);if(!local){data.notificationHistory.push(row);changed=true;}else{if(row.read&&!local.read){local.read=true;changed=true;}if(row.removed&&!local.removed){local.removed=true;changed=true;}}}}catch{/* Existing local notification history remains usable offline. */}}
  if(changed){const center=document.querySelector('#notification-center');save();if(center){closeDialog(center);notificationCenter();}}else updateNotificationBell();updateAcademicPushControls();await processAcademicIntent();
 }finally{academicTickBusy=false;}
}
function openAcademicNotice(row,confirmAttendance=true){
 const route=['attendance','assignments','calendar','exams'].includes(row.route)?row.route:'attendance';
 if(route==='attendance'){if(row.courseId)attendanceCourseFilter=row.courseId;navigateTo('attendance');if(row.occurrenceKey&&confirmAttendance){const found=attendanceScope().records.find(r=>r.occurrenceKey===row.occurrenceKey);if(found)openAttendanceDialog(row.occurrenceKey);}return;}
 if(route==='assignments'){const item=data.assignments.find(r=>r.id===row.assignmentId);if(item){assignmentSearch=item.title;assignmentFilter='all';}navigateTo('assignments');if(item)showCalendarEventDetails('assignment',item.id,item.due);return;}
 if(route==='exams'){navigateTo('exams');const item=data.exams.find(r=>r.id===row.examId);if(item)showCalendarEventDetails('exam',item.id,item.date);return;}
 const item=data.events.find(r=>r.id===row.eventId);const occurrence=row.occurrenceKey?attendanceScope().items.find(r=>r.occurrenceKey===row.occurrenceKey):null;
 const date=item?.date||occurrence?.date||row.date;if(validDate(date)){calendarSelected=date;calendarCursor=dateFromIso(date);calendarMode='day';}navigateTo('calendar');if(item)showCalendarEventDetails('custom',item.id,item.date);else if(occurrence)showCalendarEventDetails('class',occurrence.classId,occurrence.date);
}
async function handleAttendanceAction(action,control){
 const id=control.dataset.id,key=control.dataset.key;
 if(action==='attendance-add')openAttendanceDialog();else if(action==='attendance-edit')openAttendanceDialog(key);else if(action==='attendance-target')editAttendanceTarget(id);else if(action==='attendance-course'){attendanceCourseFilter=id;attendanceDateFilter='';attendanceStatusFilter='';render();document.querySelector('.attendance-filters')?.scrollIntoView({block:'start'});}
 else if(action==='attendance-clear'){attendanceCourseFilter=attendanceDateFilter=attendanceStatusFilter='';render();}
 else if(action==='notice-center'){academicBackend.historyRequested=true;notificationCenter();syncAcademicNotices().catch(()=>{});}
 else if(['notice-read','notice-remove','notice-read-all','notice-open'].includes(action)){
  const row=data.notificationHistory.find(r=>r.id===id);for(const n of data.notificationHistory)if(action==='notice-read-all'||n===row){n.read=true;if(action==='notice-remove')n.removed=true;n.syncPending=action==='notice-remove'?'remove':'read';}
  document.querySelector('#notification-center')&&closeDialog(document.querySelector('#notification-center'));save();
  if(accountUser&&academicBackend.configured)academicBackend.historyChecked=0;academicBackend.historyRequested=true;
  if(action==='notice-open'&&row)openAcademicNotice(row);else notificationCenter();
 }
 else if(action==='academic-enable-push')await enableAcademicPush();else if(action==='academic-disable-push')await pauseAcademicPush();else if(action==='academic-check-push'){await checkAcademicBackend(true);render();msg(academicBackend.reason);}
 else if(action==='academic-test-push')await testAcademicPush();
}
function initializeAcademicNotices(){setInterval(()=>{syncAcademicNotices().catch(()=>{});},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){academicBackend.historyRequested=true;syncAcademicNotices().catch(()=>{});}});navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='ACADELY_PUSH_RECEIVED'){academicBackend.historyChecked=0;academicBackend.historyRequested=true;syncAcademicNotices().catch(()=>{});}});}

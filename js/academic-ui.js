const academicDataPromises = new Map();
function loadAcademicData(name, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (academicDataPromises.has(name)) return academicDataPromises.get(name);
  const promise = new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=`assets/data/${name}.js`;
    script.onload=()=>window[globalName] ? resolve(window[globalName]) : reject(new Error('Directory unavailable'));
    script.onerror=()=>{academicDataPromises.delete(name);reject(new Error('Directory unavailable'));};
    document.head.append(script);
  });
  academicDataPromises.set(name,promise);return promise;
}
// University selection and semester planning reuse the existing workspace/save flow.
let academicDirectory = [];
let academicDirectoryState = 'idle';
let academicCatalogue = [];
function academics() {
  const semesters = data.semesters || [];
  const cumulative = AcadelyPlanning.cumulativeGpa(semesters);
  const history = semesters.filter(s=>s.status==='completed');
  const planned = semesters.filter(s=>s.status==='planned');
  const school = data.settings.university || 'Choose your university';
  return `${pageHeader('University & semesters','Choose your university, organize this semester, and keep your academic history.')}
  ${card(school, data.settings.campus ? `Campus: ${data.settings.campus}` : 'Your university and campus', `<form id="university-form" class="settings-form"><label>Find your university<input id="university-search" autocomplete="off" placeholder="Start typing a university name" role="combobox" aria-controls="university-results" aria-expanded="false"></label><div id="university-results" class="academic-results" aria-live="polite"></div><label>University name<input name="university" value="${esc(data.settings.university || '')}" required maxlength="160" placeholder="Or enter your university manually"></label><label>Campus (optional)<input name="campus" value="${esc(data.settings.campus || '')}" maxlength="100" placeholder="Enter your campus, if applicable"></label><button class="button button-primary">Save university</button></form><p class="helper-text">University directory: <a class="text-link" href="https://github.com/Hipo/university-domains-list" target="_blank" rel="noopener">Hipo university list</a>. Campus names are entered by you.</p>`)}
  ${card('Current semester', 'Dates control when your weekly classes appear on the calendar.', `<form id="current-semester-form" class="settings-form"><label>Semester name<input name="semester" value="${esc(data.settings.semester)}" maxlength="80" required></label><div class="two-fields"><label>Start date<input name="start" type="date" value="${esc(data.settings.start)}" required></label><label>End date<input name="end" type="date" value="${esc(data.settings.end)}" required></label></div><div class="row-actions"><button class="button button-primary">Save dates</button><a class="button button-secondary" href="#timetable">Add classes</a><button class="button button-secondary" type="button" data-action="academic-finish">Finish semester</button></div></form><p class="helper-text">Finishing saves a separate history record. Starting another semester never replaces it.</p>`)}
  ${card('Find courses', 'Search your university’s sourced catalogue, or add a course manually.', `<label class="academic-search">Course name or code<input id="catalogue-search" type="search" placeholder="Search courses" autocomplete="off"></label><div id="catalogue-results" class="academic-results" aria-live="polite"></div><button class="button button-secondary" data-action="add" data-kind="course">Add course manually</button><p class="helper-text">Catalogue coverage is limited. Always confirm current course availability, campus credits, and prerequisites with your university.</p>`)}
  ${card('Next semester', 'Keep planned courses separate from your current courses.', `${planned.map(semesterCard).join('') || '<p class="helper-text">No planned semester yet.</p>'}<button class="button button-primary" data-action="academic-new-plan">Plan a semester</button>`)}
  ${card('Academic history', `${history.length} completed semesters`, `<p class="academic-gpa">Cumulative GPA: <strong>${cumulative.value===null ? '—' : cumulative.value.toFixed(2)+' / '+cumulative.maxGpa}</strong></p><p class="helper-text">${esc(cumulative.reason || 'Credit weighted across completed semesters with recorded GPA points. All attempts, including retakes, count; your university may apply a different repeat policy.')}</p>${history.map(semesterCard).join('') || '<p class="helper-text">Add a previous semester to start your academic record.</p>'}<button class="button button-secondary" data-action="academic-new-history">Add previous semester</button>`)}
  ${card('Courses to consider', 'Suggestions use your own degree list and completed courses.', `<p class="helper-text">Add courses from your official degree plan. No degree requirements or prerequisites are assumed.</p><button class="button button-secondary" data-action="academic-requirement">Add degree requirement</button><div id="recommendations">${recommendationRows()}</div>`)}`;
}
function semesterCard(s) {
  const gpa = AcadelyPlanning.semesterGpa(s);
  return `<article class="academic-semester"><div class="panel-heading"><div><h3>${esc(s.name)}</h3><p>${esc(s.start || 'No start date')} – ${esc(s.end || 'No end date')}${s.university ? ' · '+esc(s.university) : ''}</p></div><span>${s.status==='completed' ? 'GPA '+(gpa.value===null?'—':gpa.value.toFixed(2)+' / '+s.maxGpa) : 'Planned'}</span></div>${(s.courses||[]).map(c=>`<div class="data-row"><div><strong>${esc(c.code || '')} ${esc(c.name)}</strong><small>${esc(c.credits)} credits${s.status==='completed' ? ' · '+esc(c.finalGrade || 'No final grade')+' · '+(c.points==='' || c.points==null ? 'No GPA points' : esc(c.points)+' GPA points')+(c.completed?' · Completed':'') : ''}</small></div></div>`).join('') || '<p class="helper-text">No courses added.</p>'}<div class="row-actions"><button data-action="academic-edit-semester" data-id="${esc(s.id)}">Edit</button>${s.status==='planned' ? `<button data-action="academic-add-planned-course" data-id="${esc(s.id)}">Add course</button><button data-action="academic-start-plan" data-id="${esc(s.id)}">Start this semester</button>` : ''}<button data-action="academic-delete-semester" data-id="${esc(s.id)}">Delete</button></div></article>`;
}
function bindAcademics() {
  if (academicDirectoryState==='idle') {
    academicDirectoryState='loading';
    loadAcademicData('universities', 'ACADELY_UNIVERSITIES').then(rows=>{academicDirectory=rows;academicDirectoryState='ready';updateUniversitySearch();}).catch(()=>{academicDirectoryState='failed';updateUniversitySearch();});
  }
  document.querySelector('#university-search')?.addEventListener('input',updateUniversitySearch);
  document.querySelector('#university-form')?.addEventListener('submit',event=>{
    event.preventDefault(); const f=new FormData(event.currentTarget);
    const university=String(f.get('university')||'').trim(); if(!university)return;
    data.settings.university=university; data.settings.campus=String(f.get('campus')||'').trim(); data.studentProfile.university=university;
    save(); if(accountUser && profileCloudReady)syncStudentProfileToAccount('University saved to your account.'); else msg('University saved.');
  });
  document.querySelector('#current-semester-form')?.addEventListener('submit',event=>{
    event.preventDefault();const f=new FormData(event.currentTarget);const start=String(f.get('start')),end=String(f.get('end'));
    if(!validDate(start)||!validDate(end)||start>end)return msg('Choose an end date on or after the start date.');
    data.settings={...data.settings,semester:String(f.get('semester')||'').trim(),start,end};save();msg('Semester dates saved. Your calendar is updated.');
  });
  document.querySelector('#catalogue-search')?.addEventListener('input',updateCatalogueSearch);
  if (!academicCatalogue.length) loadAcademicData('course-catalogues','ACADELY_CATALOGUES').then(rows=>{academicCatalogue=rows;updateCatalogueSearch();}).catch(()=>updateCatalogueSearch());
  updateCatalogueSearch();
}
function updateUniversitySearch() {
  const input=document.querySelector('#university-search'),results=document.querySelector('#university-results'); if(!input||!results)return;
  const matches=AcadelyPlanning.searchUniversities(academicDirectory,input.value);
  input.setAttribute('aria-expanded',String(matches.length>0));
  results.innerHTML=matches.length ? matches.map(row=>`<button type="button" class="university-option" data-action="academic-select-university" data-name="${esc(row.name)}">${esc(row.name)}<small>${esc(row.country)}</small></button>`).join('') : `<p class="helper-text">${academicDirectoryState==='loading'?'Loading the university directory…':academicDirectoryState==='failed'?'Directory unavailable. Enter your university below.':input.value?'No matches. Enter your university below.':'Type a name to see matching universities.'}</p>`;
}
function availableCatalogue() {
  const university=String(data.settings.university||'').toLowerCase();
  return academicCatalogue.filter(group=>group.universityNames.some(name=>university.includes(name.toLowerCase()))).flatMap(group=>group.courses.map(course=>({...course,source:group.source,edition:group.edition})));
}
function updateCatalogueSearch() {
  const results=document.querySelector('#catalogue-results');if(!results)return;
  const q=String(document.querySelector('#catalogue-search')?.value||'').trim().toLowerCase();
  const courses=availableCatalogue().filter(c=>`${c.code} ${c.name}`.toLowerCase().includes(q));
  results.innerHTML=courses.length ? courses.map(c=>`<div class="data-row"><div><strong>${esc(c.code)} · ${esc(c.name)}</strong><small>${esc(c.credits)} credits · ${esc(c.description || 'See the official catalogue for details.')}</small><small>Prerequisites: ${esc(c.prerequisiteText || 'Not verified in this catalogue sample. Check with your adviser.')}</small><a class="text-link" href="${esc(c.source)}" target="_blank" rel="noopener">Official catalogue (${esc(c.edition)}) ↗</a></div><button class="button button-secondary" data-action="academic-add-catalogue" data-code="${esc(c.code)}">Add to semester</button></div>`).join('') : '<p class="helper-text">No matching sourced courses available for this university. Add your course manually.</p>';
}
function academicDialog(title,body,onSubmit) {
  const dialog=document.createElement('dialog');dialog.className='app-dialog';
  dialog.innerHTML=`<form><div class="panel-heading"><h2>${esc(title)}</h2><button type="button" class="close-dialog" data-cancel aria-label="Close">×</button></div><div class="dialog-fields">${body}</div><div class="dialog-actions"><button type="button" class="button button-secondary" data-cancel>Cancel</button><button class="button button-primary">Save</button></div></form>`;
  document.body.append(dialog);openDialog(dialog);dialog.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>closeDialog(dialog));dialog.addEventListener('close',()=>dialog.remove());
  dialog.querySelector('form').onsubmit=event=>{event.preventDefault();onSubmit(new FormData(event.currentTarget),dialog);};return dialog;
}
function semesterEditor(record,status='completed') {
  academicDialog(record?'Edit semester':status==='planned'?'Plan next semester':'Add previous semester',`<label>Semester name<input name="name" required maxlength="80" value="${esc(record?.name||'')}"></label><div class="two-fields"><label>Start<input type="date" name="start" required value="${esc(record?.start||'')}"></label><label>End<input type="date" name="end" required value="${esc(record?.end||'')}"></label></div><label>Maximum GPA<input type="number" name="maxGpa" min="1" max="20" step="any" required value="${record?.maxGpa||data.settings.maxGpa}"></label><p class="helper-text">Save the semester, then add its courses. GPA uses the points shown on your transcript.</p>`,(f,d)=>{
    const start=String(f.get('start')),end=String(f.get('end'));if(!validDate(start)||!validDate(end)||start>end)return msg('Check the semester dates.');
    const name=String(f.get('name')||'').trim();if(!name)return msg('Enter a semester name.');
    const maxGpa=Number(f.get('maxGpa'));if(!Number.isFinite(maxGpa)||maxGpa<1||maxGpa>20)return msg('Enter a valid GPA scale.');
    if(record && record.courses.some(c=>c.points!=='' && Number(c.points)>maxGpa))return msg('A course has more GPA points than this scale. Edit its grade first.');
    const saved={...(record||{id:makeId(),courses:[],status,university:data.settings.university||''}),name,start,end,maxGpa};
    if(record)Object.assign(record,saved);else data.semesters.push(saved);closeDialog(d);save(); if(!record)semesterCourseEditor(saved);else msg('Semester saved.');
  });
}
function semesterCourseEditor(semester,course=null) {
  academicDialog(course?'Edit course':'Add semester course',`<label>Course code<input name="code" maxlength="30" required value="${esc(course?.code||'')}"></label><label>Course name<input name="name" maxlength="120" required value="${esc(course?.name||'')}"></label><label>Credits<input type="number" name="credits" min="0.1" max="100" step="any" required value="${course?.credits||3}"></label>${semester.status==='completed'?`<label>Final grade (as shown on transcript)<input name="finalGrade" maxlength="30" value="${esc(course?.finalGrade||'')}"></label><label>GPA points (0–${semester.maxGpa})<input type="number" name="points" min="0" max="${semester.maxGpa}" step="any" value="${course?.points??''}" placeholder="Leave blank if unavailable"></label><label class="remember-choice"><input type="checkbox" name="completed" ${course?.completed?'checked':''}>Successfully completed / credit earned</label><small>Use your university’s passing rules. Recommendations only count courses marked completed.</small>`:''}`,(f,d)=>{
    const saved={...(course||{id:makeId()}),code:String(f.get('code')||'').trim().toUpperCase(),name:String(f.get('name')||'').trim(),credits:Number(f.get('credits')),finalGrade:String(f.get('finalGrade')||'').trim(),points:f.get('points')==null||f.get('points')===''?'':Number(f.get('points')),completed:f.get('completed')==='on'};
    if(!saved.code||!saved.name||!Number.isFinite(saved.credits)||saved.credits<=0)return msg('Enter a course code, name, and positive credits.');
    if(saved.points!==''&&(!Number.isFinite(saved.points)||saved.points<0||saved.points>semester.maxGpa))return msg('Enter valid GPA points.');
    if(semester.courses.some(c=>c.id!==course?.id&&AcadelyPlanning.code(c.code)===AcadelyPlanning.code(saved.code)))return msg('That course is already in this semester. Retakes belong in their own semester.');
    if(course)Object.assign(course,saved);else semester.courses.push(saved);closeDialog(d);save();msg('Semester course saved.');
  });
}
function recommendationRows() {
  const allPlans=data.semesters.filter(s=>s.status==='planned');
  const school=String(data.settings.university||'').toLowerCase();
  const sameSchool=s=>!s.university || String(s.university).toLowerCase()===school;
  const rows=AcadelyPlanning.recommend(data.degreeRequirements.filter(sameSchool),data.semesters.filter(sameSchool),data.courses,allPlans.filter(sameSchool).flatMap(s=>s.courses.map(c=>c.code)));
  const choose=allPlans.length?`<label>Plan to add courses to<select id="recommendation-plan">${allPlans.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label>`:'<p class="helper-text">Create a planned semester to add suggestions.</p>';
  return choose+(rows.length?rows.map(r=>`<div class="data-row"><div><strong>${esc(r.code)} · ${esc(r.name)}</strong><small>${esc(r.reason)}</small>${r.prerequisites?.length?`<small>Prerequisites: ${esc(r.prerequisites.join(', '))}</small>`:''}<small>Source: ${esc(r.source || 'Student-entered degree plan')}</small></div><div class="row-actions">${r.eligible&&allPlans.length?`<button data-action="academic-add-recommendation" data-id="${esc(r.id)}">Add to plan</button>`:''}<button data-action="academic-delete-requirement" data-id="${esc(r.id)}">Remove</button></div></div>`).join(''):'<p class="helper-text">No uncompleted degree requirements to suggest. Add your official degree requirements to get started.</p>');
}
function requirementEditor() {
  academicDialog('Add a degree requirement',`<label>Course code<input name="code" maxlength="30" required></label><label>Course name<input name="name" maxlength="120" required></label><label>Credits<input name="credits" type="number" min="0.1" max="100" step="any" required></label><label>Prerequisite course codes (comma separated)<input name="prerequisites" maxlength="300" placeholder="Leave empty when no prerequisites apply"></label><label>Official degree plan or catalogue URL<input name="source" type="url" required maxlength="1000" placeholder="https://your-university.edu/..."></label><label class="remember-choice"><input type="checkbox" name="verified">I checked these prerequisites in the official source (including when none apply)</label><p class="helper-text">These are your entered requirements, not an automated university verification.</p>`,(f,d)=>{
    const courseCode=String(f.get('code')).trim().toUpperCase();
    if(data.degreeRequirements.some(r=>AcadelyPlanning.code(r.code)===AcadelyPlanning.code(courseCode)))return msg('This requirement is already saved.');
    const source=String(f.get('source'));if(!/^https?:\/\//.test(source))return msg('Use an official website URL.');
    data.degreeRequirements.push({id:makeId(),university:data.settings.university||'',code:courseCode,name:String(f.get('name')).trim(),credits:Number(f.get('credits')),prerequisites:String(f.get('prerequisites')||'').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean),prerequisitesVerified:f.get('verified')==='on',source});closeDialog(d);save();
  });
}
function handleAcademicAction(action,control) {
  const semester=data.semesters.find(s=>s.id===control.dataset.id);
  if(action==='academic-select-university') {document.querySelector('#university-form [name="university"]').value=control.dataset.name;document.querySelector('#university-results').innerHTML='';document.querySelector('#university-search').setAttribute('aria-expanded','false');}
  else if(action==='academic-new-plan')semesterEditor(null,'planned');
  else if(action==='academic-new-history')semesterEditor(null,'completed');
  else if(action==='academic-edit-semester'&&semester) {
    const d=academicDialog(semester.name,`<div class="row-actions">${semester.workspaceSnapshots?.length ? '<button type="button" data-export-archive>Export saved academic data</button>' : ''}<button type="button" data-edit-details>Edit semester details</button><button type="button" data-add-course>Add course</button></div>${semester.courses.map(c=>`<div class="data-row"><strong>${esc(c.code)} · ${esc(c.name)}</strong><div class="row-actions"><button type="button" data-edit-course="${esc(c.id)}">Edit</button><button type="button" data-delete-course="${esc(c.id)}">Delete</button></div></div>`).join('')}`,(_,d)=>closeDialog(d));
    d.querySelector('[data-export-archive]')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(semester,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='acadely-semester-archive.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    d.querySelector('[data-edit-details]').onclick=()=>{closeDialog(d);semesterEditor(semester);};d.querySelector('[data-add-course]').onclick=()=>{closeDialog(d);semesterCourseEditor(semester);};
    d.querySelectorAll('[data-edit-course]').forEach(b=>b.onclick=()=>{closeDialog(d);semesterCourseEditor(semester,semester.courses.find(c=>c.id===b.dataset.editCourse));});
    d.querySelectorAll('[data-delete-course]').forEach(b=>b.onclick=()=>{if(confirm('Delete this historical or planned course?')){semester.courses=semester.courses.filter(c=>c.id!==b.dataset.deleteCourse);closeDialog(d);save();}});
  }
  else if(action==='academic-add-planned-course'&&semester)semesterCourseEditor(semester);
  else if(action==='academic-delete-semester'&&semester&&confirm('Delete this semester and its saved course records?')){data.semesters=data.semesters.filter(s=>s.id!==semester.id);save();}
  else if(action==='academic-add-catalogue') {
    const c=availableCatalogue().find(c=>c.code===control.dataset.code);if(!c)return;
    if(data.courses.some(row=>AcadelyPlanning.code(row.code)===AcadelyPlanning.code(c.code)))return msg('This course is already in your current semester.');
    data.courses.push({...c,id:makeId(),gradeMode:'assessments',finalGrade:null});save();msg('Course added to your current semester.');
  }
  else if(action==='academic-requirement')requirementEditor();
  else if(action==='academic-delete-requirement'&&confirm('Remove this degree requirement?')){data.degreeRequirements=data.degreeRequirements.filter(r=>r.id!==control.dataset.id);save();}
  else if(action==='academic-add-recommendation') {
    const plan=data.semesters.find(s=>s.id===document.querySelector('#recommendation-plan')?.value&&s.status==='planned');const r=data.degreeRequirements.find(r=>r.id===control.dataset.id);if(!plan||!r)return;
    if(plan.courses.some(c=>AcadelyPlanning.code(c.code)===AcadelyPlanning.code(r.code)))return msg('Already in this plan.');
    plan.courses.push({id:makeId(),code:r.code,name:r.name,credits:r.credits});save();msg('Course added to your plan.');
  }
  else if(action==='academic-cancel-class') {
    const item=data.classes.find(c=>c.id===control.dataset.id);if(!item||!validDate(control.dataset.date))return;
    item.cancelledDates=[...new Set([...(item.cancelledDates||[]),control.dataset.date])];closeDialog(control.closest('dialog'));save();msg('This occurrence was cancelled. Your recurring schedule is unchanged.');
  }
  else if(action==='academic-finish')finishCurrentSemester();
  else if(action==='academic-start-plan'&&semester)startPlannedSemester(semester);
}
function finishCurrentSemester() {
  if(!data.settings.semester||!validDate(data.settings.start)||!validDate(data.settings.end))return msg('Save the semester name and dates first.');
  if(!data.courses.length)return msg('Add courses before saving this semester to history.');
  if(data.semesters.some(s=>s.status==='completed'&&s.name===data.settings.semester&&s.start===data.settings.start&&s.end===data.settings.end))return msg('This semester is already in Academic History. Edit its saved record there.');
  if(!confirm('Save a separate copy of this semester to Academic History? Only final grades or fully assessed courses will be recorded as final. Review passing status from your transcript afterward.'))return;
  const result=gpaSummary();
  data.semesters.push({id:makeId(),status:'completed',name:data.settings.semester,start:data.settings.start,end:data.settings.end,maxGpa:Number(data.settings.maxGpa),university:data.settings.university||'',courses:result.courses.map(row=>({id:makeId(),code:row.course.code||'',name:row.course.name,credits:row.credits,finalGrade:row.completion>=100&&row.percentage!==null?String(row.percentage)+'%':'',points:row.completion>=100&&row.points!==null?row.points:'',completed:false}))});save();msg('Semester saved to history. Review each course’s completed status.');
}
function startPlannedSemester(plan) {
  
  if(Number(plan.maxGpa)!==Number(data.settings.maxGpa))return msg('This plan uses a different GPA scale. Set your university grading scale in Settings before starting it.');
  if(!plan.courses.length)return msg('Add at least one course to this plan.');
  if(!validDate(plan.start)||!validDate(plan.end)||plan.start>plan.end)return msg('Set valid dates on this plan first.');
  if(!confirm('Start this planned semester? Your current semester will be saved as a separate history record with all its academic data. The new semester will open with the planned courses and an empty timetable.'))return;
  let old=data.semesters.find(s=>s.status==='completed'&&s.name===data.settings.semester&&s.start===data.settings.start);
  const hasCurrent=['courses','assignments','assessments','classes','exams','sessions','events'].some(k=>data[k].length);
  if(hasCurrent && (!data.settings.semester || !validDate(data.settings.start) || !validDate(data.settings.end)))return msg('Save your current semester name and dates before starting another one.');
  if(hasCurrent && !old){
    const result=gpaSummary();
    old={id:makeId(),status:'completed',name:data.settings.semester,start:data.settings.start,end:data.settings.end,maxGpa:Number(data.settings.maxGpa),university:data.settings.university||'',courses:result.courses.map(row=>({id:makeId(),code:row.course.code||'',name:row.course.name,credits:row.credits,finalGrade:row.completion>=100&&row.percentage!==null?String(row.percentage)+'%':'',points:row.completion>=100&&row.points!==null?row.points:'',completed:false}))};data.semesters.push(old);
  }
  if(old){if(!Array.isArray(old.workspaceSnapshots))old.workspaceSnapshots=[];old.workspaceSnapshots.push({savedAt:new Date().toISOString(),data:JSON.parse(JSON.stringify(Object.fromEntries(['settings','courses','assignments','assessments','classes','exams','sessions','events'].map(k=>[k,data[k]]))))});}
  for(const k of ['assignments','assessments','classes','exams','sessions','events'])data[k]=[];
  data.courses=plan.courses.map(c=>({...c,id:makeId(),gradeMode:'assessments',finalGrade:null}));
  data.settings={...data.settings,semester:plan.name,start:plan.start,end:plan.end};data.semesters=data.semesters.filter(s=>s.id!==plan.id);save();msg('Your new semester is ready.');
}

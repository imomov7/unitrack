// View composition and interactions for the existing Acadely workspace.
let courseSearch = '';
let profileSuggestionIndex = -1;
function navigateTo(route) {
  route = validRoute(route) || 'dashboard';
  document.querySelectorAll('dialog').forEach(closeDialog);
  toggleMenu(false);
  if (location.hash === `#${route}`) { currentPage=route; render(); }
  else { currentPage=route; location.hash=`#${route}`; render(); }
  window.scrollTo({top:0,behavior:'auto'});
}
function contextNavigation(page) {
  const groups = ['calendar','timetable','exams'].includes(page)
    ? [['calendar','Calendar'],['timetable','Class schedule'],['exams','Exams']]
    : ['grades','gpa','history','overview'].includes(page)
      ? [['grades','Marks & targets'],['gpa','Semester GPA'],['history','Academic history'],['overview','Semester progress']] : [];
  return groups.length ? `<nav class="section-tabs" aria-label="${['calendar','timetable','exams'].includes(page)?'Calendar':'Grades'} views">${groups.map(([route,label])=>`<a href="#${route}" ${route===page?'aria-current="page"':''}>${label}</a>`).join('')}</nav>` : '';
}
function simpleDashboard() {
  const dayClasses=data.classes.filter(c=>AcadelyPlanning.classOccurs(c,today(),data.settings)).sort((a,b)=>a.start.localeCompare(b.start));
  const deadlines=[...data.assignments.filter(a=>!a.done).map(a=>({...a,date:a.due,type:'Assignment'})),...data.exams.filter(e=>e.date>=today()).map(e=>({...e,type:'Exam'}))].filter(i=>i.date).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
  const grade=gpaSummary(); const name=data.studentProfile.fullName?.split(' ')[0];
  return `${pageHeader(name ? `Hello, ${esc(name)}`:'Your dashboard',esc(data.settings.semester || 'A clear view of your academic day.'),button('Add assignment','add','primary','data-kind="assignment"'))}
  <div class="semester-caption">${esc(data.settings.university || 'Your university')} ${data.settings.start&&data.settings.end?`<span>${dateLabel(data.settings.start)} – ${dateLabel(data.settings.end)}</span>`:'<a href="#calendar">Set semester dates ↗</a>'}</div>
  ${!data.courses.length?`<section class="start-banner"><div><span class="eyebrow">LET’S GET STARTED</span><h2>Your semester starts with a course.</h2><p>Add your first course, then keep classes and deadlines together.</p></div>${button('Add your first course','add','primary','data-kind="course"')}</section>`:''}
  <section class="dashboard-metrics"><a href="#courses"><strong>${data.courses.length}</strong><span>Current courses</span></a><a href="#assignments"><strong>${data.assignments.filter(a=>!a.done).length}</strong><span>Assignments to do</span></a><a href="#gpa"><strong>${grade.value===null?'—':grade.value.toFixed(2)}</strong><span>${grade.estimated?'Estimated semester GPA':'Semester GPA'}</span></a></section>
  <section class="home-grid">${card('Today’s classes',dayClasses.length?`${dayClasses.length} on your schedule`:'Make room for focused work.',dayClasses.length?dayClasses.map(c=>`<div class="agenda-item"><span class="agenda-time">${esc(c.start)}</span><div><strong>${esc(courseName(c.courseId))}</strong><small>${esc(c.location||'No room set')} · until ${esc(c.end)}</small></div></div>`).join(''):'<p class="quiet-state">No classes scheduled for today.</p>','<a class="text-link" href="#calendar">View calendar ↗</a>')}
  ${card('Coming up','Your next assignments and exams.',deadlines.length?deadlines.map(i=>`<a class="deadline-item" href="#${i.type==='Exam'?'exams':'assignments'}"><span class="deadline-date">${dateLabel(i.date)}</span><div><strong>${esc(i.title)}</strong><small>${esc(courseName(i.courseId))} · ${i.type}${i.date<today()?' · Overdue':''}</small></div><span aria-hidden="true">↗</span></a>`).join(''):'<p class="quiet-state">No deadlines yet. Add an assignment when you’re ready.</p>','<a class="text-link" href="#assignments">All assignments ↗</a>')}</section>
  ${card('My courses',data.settings.semester||'Current semester',data.courses.length?`<div class="course-preview">${data.courses.slice(0,4).map(c=>`<a href="#courses"><span class="course-monogram">${esc((c.code||c.name).slice(0,2).toUpperCase())}</span><div><strong>${esc(c.name)}</strong><small>${esc(c.code||'Course')} · ${Number(c.credits)||0} credits</small></div></a>`).join('')}</div>`:'<p class="quiet-state">Your courses will appear here.</p>','<a class="text-link" href="#courses">Manage courses ↗</a>')}
  <a class="planner-shortcut" href="#planner"><span>Need a study plan?</span><strong>Plan your next session ↗</strong></a>`;
}
function gradeSummaryStrip() {
  const result=gpaSummary();
  return `<section class="grade-summary"><div><span>Semester GPA</span><strong>${result.value===null?'—':result.value.toFixed(2)}<small> / ${Number(data.settings.maxGpa).toFixed(1)}</small></strong></div><p>${result.estimated?'Based on marks entered so far. Missing work can change your grade.':'Your current course grades, weighted by credit hours.'}</p>${currentPage!=='gpa'?'<a class="text-link" href="#gpa">View GPA details ↗</a>':''}</section>`;
}
function courseCardsMarkup() {
  const q=courseSearch.trim().toLowerCase();
  const courses=data.courses.filter(c=>`${c.name} ${c.code||''} ${c.professor||''}`.toLowerCase().includes(q));
  const grades=gpaSummary();
  return courses.length?courses.map(c=>{
    const result=grades.courses.find(r=>r.course.id===c.id);
    const classes=data.classes.filter(r=>r.courseId===c.id);
    return `<article class="course-card"><div class="course-card-top"><span class="course-code">${esc(c.code||'COURSE')}</span><span class="credit-label">${Number(c.credits)||0} credits</span></div><h2>${esc(c.name)}</h2><p class="course-semester">${esc(data.settings.semester||'Current semester')}</p>${c.professor?`<p class="course-detail">Professor ${esc(c.professor)}</p>`:''}<div class="course-grade"><span>Current grade</span><strong>${result?.percentage!=null?result.percentage.toFixed(1)+'%':'No marks yet'}</strong></div>${classes.length?`<p class="course-detail">${classes.map(cl=>`${esc((cl.days||[cl.day]).map(d=>d?.slice(0,3)).join(', '))} · ${esc(cl.start)}–${esc(cl.end)}`).join('<br>')}</p>`:'<p class="course-detail">No classes scheduled</p>'}<div class="course-actions"><button type="button" data-action="ux-course-grades" data-id="${esc(c.id)}">${c.gradeMode==='final'?'Edit grade':'Add mark'}</button><button type="button" data-action="ux-course-class" data-id="${esc(c.id)}">Schedule</button><button type="button" data-action="edit" data-kind="courses" data-id="${esc(c.id)}">Edit</button><button type="button" data-action="delete" data-kind="courses" data-id="${esc(c.id)}">Remove</button></div></article>`;
  }).join(''):`<div class="course-empty"><h2>${data.courses.length?'No matching courses':'Your courses, all in one place.'}</h2><p>${data.courses.length?'Try a different name or code.':'Search the available catalogue or enter a course from your syllabus.'}</p>${!data.courses.length?addButton('Add Course','course'):''}</div>`;
}
function myCourses() {
  return `${pageHeader('My Courses',esc(data.settings.semester||'Your current semester'),addButton('Add Course','course'))}<div class="course-page-tools"><label class="search-field"><span class="sr-only">Search your courses</span><input id="my-course-search" type="search" placeholder="Search your courses" value="${esc(courseSearch)}"></label><a class="text-link" href="#calendar">Class schedule ↗</a></div><section id="my-course-results" class="course-grid">${courseCardsMarkup()}</section><details class="disclosure"><summary>Plan next semester</summary>${plannedSemesterSection()}</details>`;
}
function plannedSemesterSection() {
  return `<div class="planning-content"><div class="section-heading"><p>Keep future courses separate from your current semester.</p><button class="button button-secondary" data-action="academic-new-plan">Plan a semester</button></div>${data.semesters.filter(s=>s.status==='planned').map(semesterCard).join('') || '<p class="quiet-state">No future semesters planned yet.</p>'}<details class="disclosure"><summary>Course suggestions from my degree plan</summary><p class="helper-text">Add requirements from your official degree plan. Suggestions use only your saved records and the prerequisite rules you confirm.</p><button class="button button-secondary" data-action="academic-requirement">Add degree requirement</button><div id="recommendations">${recommendationRows()}</div></details></div>`;
}
function academicHistory() {
  const history=data.semesters.filter(s=>s.status==='completed'),gpa=AcadelyPlanning.cumulativeGpa(history);
  return `${pageHeader('Academic history','Your completed semesters stay saved independently.',button('Add previous semester','academic-new-history','secondary'))}<div class="grade-summary"><div><span>Overall GPA</span><strong>${gpa.value===null?'—':gpa.value.toFixed(2)}${gpa.maxGpa?`<small> / ${gpa.maxGpa}</small>`:''}</strong></div><p>${esc(gpa.reason||'Weighted by credits across recorded attempts. Retakes stay in your history; your university’s replacement rules may differ.')}</p></div>${history.map(semesterCard).join('')||card('Your academic record starts here','Add a previous semester or finish your current semester in Calendar.','<p class="quiet-state">No completed semesters recorded.</p>')}`;
}
function simpleProfile() {
  const p=data.studentProfile;const synced=!!accountUser;
  return `${pageHeader('Student Profile','Your details and your university, in one place.')}<article class="panel profile-panel"><form id="student-profile-form" class="settings-form"><div class="profile-preview"><span class="avatar profile-avatar">${esc(initials(p.fullName))}</span><div><strong>${esc(p.fullName||'Your profile')}</strong><small>${synced?'Signed in to Acadely':'Saved on this device · not a verified account'}</small></div></div><div class="two-fields"><label>Full name<input name="fullName" value="${esc(p.fullName)}" required maxlength="120" autocomplete="name"></label><label>Email<input name="email" type="email" value="${esc(accountUser?.email||p.email)}" maxlength="254" autocomplete="email" ${synced?'readonly':''}></label></div>${synced?'<p class="helper-text">To update your sign-in email, <button type="button" class="text-link" data-action="account-open-email">change your account email</button>.</p>':''}<div class="form-divider"></div><label>University<input id="university-search" name="university" value="${esc(p.university||data.settings.university)}" maxlength="160" autocomplete="off" placeholder="Search by university name" role="combobox" aria-autocomplete="list" aria-controls="university-results" aria-expanded="false"></label><div id="university-results" class="academic-results" role="listbox" aria-label="University suggestions" hidden></div><p id="university-status" class="helper-text">Choose a suggestion or enter your university’s name manually. Directory coverage is limited.</p><div class="two-fields"><label>Campus (optional)<input name="campus" value="${esc(p.campus||data.settings.campus||'')}" maxlength="100" placeholder="Your campus"></label><label>Degree or major<input name="major" value="${esc(p.major)}" maxlength="120" placeholder="Your degree program"></label></div><details class="disclosure"><summary>More profile details</summary><div class="two-fields"><label>Student ID / UID (optional)<input name="studentId" value="${esc(p.studentId)}" maxlength="80"></label><label>Academic year<input name="academicYear" value="${esc(p.academicYear)}" maxlength="40"></label></div><label>Profile picture<input type="file" name="profilePictureFile" accept="image/png,image/jpeg,image/webp"><small>JPG, PNG, or WebP, up to 8 MB. Resized before saving.</small></label>${p.profilePicture?'<button class="button button-secondary" type="button" data-action="profile-picture-remove">Remove picture</button>':''}</details><div class="profile-save"><span>${synced?'Saved to your account with a copy on this device.':'Saved in this browser.'}</span><button class="button button-primary" type="submit">Save profile</button></div></form></article>`;
}
async function bindProfileUniversity() {
  const input=document.querySelector('#university-search'); if(!input)return;
  input.addEventListener('input',()=>{profileSuggestionIndex=-1;updateProfileUniversities();});
  input.addEventListener('keydown',event=>{
    const buttons=[...document.querySelectorAll('#university-results [role="option"]')];
    if(event.key==='Escape'){document.querySelector('#university-results').hidden=true;input.setAttribute('aria-expanded','false');}
    if(['ArrowDown','ArrowUp'].includes(event.key)&&buttons.length){event.preventDefault();profileSuggestionIndex=(profileSuggestionIndex+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons.forEach((b,i)=>b.setAttribute('aria-selected',String(i===profileSuggestionIndex)));input.setAttribute('aria-activedescendant',buttons[profileSuggestionIndex].id);}
    if(event.key==='Enter'&&profileSuggestionIndex>=0&&buttons[profileSuggestionIndex]){event.preventDefault();chooseProfileUniversity(buttons[profileSuggestionIndex].dataset.name);}
  });
  if(academicDirectory.length)return;
  academicDirectoryState='loading';
  try {const rows=await loadAcademicData('universities','ACADELY_UNIVERSITIES');academicDirectory=rows.filter(r=>r&&typeof r.name==='string'&&r.name.trim());if(!academicDirectory.length)throw Error();academicDirectoryState='ready';}
  catch {academicDirectoryState='failed';}
  if(document.querySelector('#university-search')===document.activeElement)updateProfileUniversities();
}
function updateProfileUniversities() {
  const input=document.querySelector('#university-search'),results=document.querySelector('#university-results'),status=document.querySelector('#university-status');if(!input||!results)return;
  const matches=AcadelyPlanning.searchUniversities(academicDirectory,input.value);results.hidden=!matches.length;input.setAttribute('aria-expanded',String(!!matches.length));input.removeAttribute('aria-activedescendant');
  results.innerHTML=matches.map((r,i)=>`<button type="button" class="university-option" id="university-option-${i}" role="option" aria-selected="false" data-action="academic-select-university" data-name="${esc(r.name)}">${esc(r.name)}<small>${esc(r.country||'')}</small></button>`).join('');
  status.textContent=academicDirectoryState==='loading'?'Loading university suggestions…':academicDirectoryState==='failed'?'University suggestions are unavailable. You can enter and save the name manually.':matches.length?'Choose your university, or keep the name you entered.':input.value?'No matches. You can save the name you entered.':'Type a name to search. Directory coverage is limited.';
}
function chooseProfileUniversity(name) {
  const input=document.querySelector('#university-search');if(!input)return;
  if(input.value!==name)document.querySelector('#student-profile-form [name="campus"]').value='';
  input.value=name;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');document.querySelector('#university-results').hidden=true;document.querySelector('#university-status').textContent='University selected. Save your profile to keep this change.';profileSuggestionIndex=-1;
}
function semesterCalendarControls() {
  return `<section class="semester-toolbar"><div><span class="eyebrow">CURRENT SEMESTER</span><strong>${esc(data.settings.semester||'Set up your semester')}</strong><span>${data.settings.start&&data.settings.end?`${dateLabel(data.settings.start)} – ${dateLabel(data.settings.end)}`:'Choose dates to keep recurring classes within your semester.'}</span></div><div class="row-actions"><button class="button ${data.settings.start?'button-secondary':'button-primary'}" data-action="ux-semester-dates">${data.settings.start?'Edit semester':'Set semester dates'}</button>${data.courses.length?'<button class="row-action-button" data-action="academic-finish">Finish semester</button>':''}</div></section>`;
}
function editSemesterDates() {
  academicDialog('Semester dates',`<label>Semester name<input name="semester" maxlength="80" required value="${esc(data.settings.semester)}" placeholder="e.g. Spring 2027"></label><div class="two-fields"><label>Start date<input name="start" type="date" required value="${esc(data.settings.start)}"></label><label>End date<input name="end" type="date" required value="${esc(data.settings.end)}"></label></div><p class="helper-text">Classes repeat on their selected weekdays between these dates. Completed semesters stay in Academic history.</p>`,(f,d)=>{
    const semester=String(f.get('semester')||'').trim(),start=String(f.get('start')),end=String(f.get('end'));
    if(!semester||!validDate(start)||!validDate(end)||start>end)return msg('Enter a semester name and an end date on or after its start.');
    data.settings={...data.settings,semester,start,end};closeDialog(d);save();msg('Semester dates saved. Your calendar is updated.');
  });
}
function openCoursePicker() {
  const dialog=document.createElement('dialog');dialog.className='app-dialog course-picker';dialog.innerHTML=`<div class="panel-heading"><div><h2>Add a course</h2><p>${esc(data.settings.university||data.studentProfile.university||'Your current semester')}</p></div><button type="button" class="close-dialog" data-cancel aria-label="Close">×</button></div><label class="search-field">Course name or code<input id="course-picker-search" type="search" placeholder="e.g. GCIS-123 or Biology" autocomplete="off"></label><p class="catalogue-note">Catalogue coverage is limited. Results are a sourced sample, not a complete list of courses.</p><div id="course-picker-results" aria-live="polite"><p class="quiet-state">Loading available courses…</p></div><div class="picker-footer"><span>Can’t find your course?</span><button class="button button-secondary" type="button" data-action="ux-course-manual">Enter course manually</button></div>`;
  document.body.append(dialog);openDialog(dialog);dialog.querySelector('[data-cancel]').onclick=()=>closeDialog(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('#course-picker-search').addEventListener('input',renderCoursePicker);
  loadAcademicData('course-catalogues','ACADELY_CATALOGUES').then(rows=>{academicCatalogue=rows;renderCoursePicker();}).catch(()=>{if(document.querySelector('#course-picker-results'))document.querySelector('#course-picker-results').innerHTML='<p class="quiet-state">Catalogue unavailable. Enter the course details from your syllabus below.</p>';});
}
function renderCoursePicker() {
  const results=document.querySelector('#course-picker-results');if(!results)return;
  const q=String(document.querySelector('#course-picker-search')?.value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const courses=availableCatalogue().filter(c=>`${c.code} ${c.name}`.toLowerCase().replace(/[^a-z0-9]/g,'').includes(q));
  results.innerHTML=courses.length?courses.map(c=>{const exists=data.courses.some(r=>AcadelyPlanning.code(r.code)===AcadelyPlanning.code(c.code));return `<div class="catalogue-course"><div><strong>${esc(c.code)} · ${esc(c.name)}</strong><small>${Number(c.credits)} credits</small><details><summary>Course details & source</summary><p>${esc(c.description||'See the official catalogue for the course description.')}</p><p>${esc(c.prerequisiteText||'Prerequisites not verified in this sample. Confirm with your university.')}</p><a class="text-link" href="${esc(c.source)}" target="_blank" rel="noopener">Official catalogue · ${esc(c.edition)} ↗</a></details></div><button class="button button-primary" type="button" data-action="ux-pick-course" data-code="${esc(c.code)}" ${exists?'disabled':''}>${exists?'Added':'Add course'}</button></div>`;}).join(''):'<p class="quiet-state">No matching course in the available sample. Use manual entry to add it from your syllabus.</p>';
}
function handleSimpleAction(action,control) {
  if(action==='ux-profile')navigateTo('profile');
  else if(action==='ux-semester-dates')editSemesterDates();
  else if(action==='ux-course-manual'){closeDialog(control.closest('dialog'));openRecordDialog('course');}
  else if(action==='ux-pick-course'){
    const c=availableCatalogue().find(c=>c.code===control.dataset.code);if(!c)return;
    if(data.courses.some(row=>AcadelyPlanning.code(row.code)===AcadelyPlanning.code(c.code)))return msg('This course is already in your semester.');
    data.courses.push({...c,id:makeId(),gradeMode:'assessments',finalGrade:null});closeDialog(control.closest('dialog'));save();msg('Course added to your semester.');
  }
  else if(action==='ux-course-grades'){
    const course=data.courses.find(c=>c.id===control.dataset.id);if(!course)return;
    if(course.gradeMode==='final')academicDialog('Final course grade',`<p class="helper-text">${esc(course.name)}</p><label>Final grade (%)<input name="finalGrade" type="number" min="0" max="100" step="any" required value="${course.finalGrade??''}"></label>`,(fields,dialog)=>{
      const score=Number(fields.get('finalGrade'));if(!Number.isFinite(score)||score<0||score>100)return msg('Enter a percentage from 0 to 100.');course.finalGrade=score;closeDialog(dialog);save();msg('Final grade saved.');
    });
    else openRecordDialog('assessment',{courseId:control.dataset.id});
  }
  else if(action==='ux-course-class')openRecordDialog('class',{courseId:control.dataset.id});
}
function bindSimplifiedPages() {
  if(currentPage==='profile')bindProfileUniversity();
  document.querySelector('#my-course-search')?.addEventListener('input',event=>{courseSearch=event.target.value;document.querySelector('#my-course-results').innerHTML=courseCardsMarkup();});
}

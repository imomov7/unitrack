Warning: truncated output (original token count: 21193)
Total output lines: 763

// ACADELY browser data layer, page rendering, and event handlers.
// Keep KEY stable so existing student data remains available after upgrades.
const KEY = 'unitrack-data-v1';
const COLLECTIONS = ['courses', 'assignments', 'assessments', 'classes', 'exams', 'sessions', 'events'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const APP_VERSION = '1.1.0';
const CREATOR_PROFILE = Object.freeze({ name: 'Imomov Abdullo', email: 'imomovabdullo009@gmail.com' });
const views = { dashboard, assignments, grades: gradePage, timetable, exams, gpa, calendar, settings, overview, planner, profile, about };
const labels = { dashboard: 'Dashboard', assignments: 'Assignments', grades: 'Grade calculator', timetable: 'Timetable', exams: 'Exams', gpa: 'GPA calculator', calendar: 'Academic calendar', settings: 'Settings', overview: 'Semester overview', planner: 'Smart study planner', profile: 'Student profile', about: 'About ACADELY' };
const content = document.querySelector('.page-content');
const toast = document.querySelector('#toast');
let toastTimer;
let assignmentFilter = 'all';
let assignmentSearch = '';
let calendarMode = 'month';
let calendarCursor = new Date();
let calendarSelected = today();
let data = load();
let currentPage = validRoute(location.hash.slice(1)) || 'dashboard';

const appShell = document.querySelector('.app-shell');
const sidebarToggle = document.querySelector('#sidebar-collapse-toggle');
const themeToggle = document.querySelector('#theme-toggle');
const themeMeta = document.querySelector('meta[name="theme-color"]');
function syncTheme() {
  const light = document.documentElement.dataset.theme === 'light';
  themeToggle.setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} mode`);
  themeToggle.title = `Switch to ${light ? 'dark' : 'light'} mode`;
  themeToggle.innerHTML = light
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 13A8.5 8.5 0 0 1 11 3.2 8.6 8.6 0 1 0 20.8 13Z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
  themeMeta.content = light ? '#f6f7fa' : '#10141d';
}
try { if (localStorage.getItem('acadely-theme') === 'light') document.documentElement.dataset.theme = 'light'; } catch { /* Theme preference is optional when browser storage is unavailable. */ }
themeToggle.addEventListener('click', () => {
  const light = document.documentElement.dataset.theme !== 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  try { localStorage.setItem('acadely-theme', light ? 'light' : 'dark'); } catch { /* Keep theme switching available for this session. */ }
  syncTheme();
});
syncTheme();
try {
  if (localStorage.getItem('acadely-sidebar-collapsed') === 'true') appShell.classList.add('sidebar-collapsed');
} catch { /* Sidebar preference is optional when browser storage is unavailable. */ }
function syncSidebarToggle() {
  const collapsed = appShell.classList.contains('sidebar-collapsed');
  sidebarToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  sidebarToggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  document.querySelectorAll('.nav-item[data-page]').forEach((item) => {
    if (collapsed) item.title = item.textContent.trim();
    else item.removeAttribute('title');
  });
}
sidebarToggle.addEventListener('click', () => {
  appShell.classList.toggle('sidebar-collapsed');
  try { localStorage.setItem('acadely-sidebar-collapsed', String(appShell.classList.contains('sidebar-collapsed'))); } catch { /* Keep the current-session toggle usable. */ }
  syncSidebarToggle();
});
syncSidebarToggle();

function defaultScale(maxGpa = 4) {
  const max = Number(maxGpa) || 4;
  return [
    { letter: 'A', min: 90, gpa: max },
    { letter: 'B', min: 80, gpa: max * 0.75 },
    { letter: 'C', min: 70, gpa: max * 0.5 },
    { letter: 'D', min: 60, gpa: max * 0.25 },
    { letter: 'F', min: 0, gpa: 0 },
  ];
}

function defaults() {
  return { profile: 'Student', studentProfile: { fullName: '', studentId: '', university: '', major: '', academicYear: '', semester: '', email: '' }, creatorProfile: { name: '', email: '' }, settings: { university: '', semester: '', start: '', end: '', availableHours: 2, maxGpa: 4, scaleCustomized: false, gradeScale: defaultScale() }, courses: [], assignments: [], assessments: [], classes: [], exams: [], sessions: [], events: [] };
}

function sameScale(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => String(item.letter).toUpperCase() === right[index].letter && Number(item.min) === right[index].min && Number(item.gpa) === right[index].gpa);
}

function load() {
  const base = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return base;
    const merged = { ...base, ...saved, settings: { ...base.settings, ...(saved.settings || {}) }, studentProfile: { ...base.studentProfile, ...(saved.studentProfile || {}) }, creatorProfile: { ...base.creatorProfile, ...(saved.creatorProfile || {}) } };
    for (const key of COLLECTIONS) if (!Array.isArray(merged[key])) merged[key] = [];
    const max = Number(merged.settings.maxGpa);
    merged.settings.maxGpa = Number.isFinite(max) && max > 0 && max <= 20 ? max : 4;
    merged.settings.availableHours = Number(merged.settings.availableHours) > 0 ? Number(merged.settings.availableHours) : 2;
    if (!Array.isArray(merged.settings.gradeScale) || !merged.settings.gradeScale.length) {
      merged.settings.gradeScale = defaultScale(merged.settings.maxGpa);
      merged.settings.scaleCustomized = false;
    } else if (typeof merged.settings.scaleCustomized !== 'boolean') {
      // Older saves have no customization flag. Recognize the old built-in 4.0 scale;
      // keep any scale that differs from that built-in as a student customization.
      const legacyDefault = defaultScale(4);
      merged.settings.scaleCustomized = !sameScale(merged.settings.gradeScale, legacyDefault);
      if (!merged.settings.scaleCustomized) merged.settings.gradeScale = defaultScale(merged.settings.maxGpa);
    } else if (!merged.settings.scaleCustomized) {
      merged.settings.gradeScale = defaultScale(merged.settings.maxGpa);
    }
    return merged;
  } catch {
    return base;
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    render();
    return true;
  } catch {
    msg('ACADELY could not save in this browser. Check available storage space or browser privacy settings.');
    return false;
  }
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function msg(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

function validRoute(route) { return Object.hasOwn(views, route) ? route : null; }
function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function dateLabel(date) { return date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'; }
function daysUntil(date) { return Math.ceil((new Date(`${date}T00:00:00`) - new Date(`${today()}T00:00:00`)) / 86400000); }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()) && new Date(`${value}T12:00:00`).toISOString().slice(0, 10) === value; }
function courseName(id) { return data.courses.find((course) => course.id === id)?.name || 'Unassigned'; }
function courseProgress(courseId) { return UniTrackMath.courseProgress(data.assessments, courseId); }
function gradeFor(score) { return UniTrackMath.gradeForPercentage(score, data.settings.gradeScale, data.settings.maxGpa); }
function selectCourses(selected = '', required = false) {
  return `<option value="">${required ? 'Choose a course' : 'No course selected'}</option>${data.courses.map((course) => `<option value="${esc(course.id)}" ${course.id === selected ? 'selected' : ''}>${esc(course.name)}</option>`).join('')}`;
}
function button(label, action, kind = 'secondary', extra = '') { return `<button type="button" class="button button-${kind}" data-action="${action}" ${extra}>${label}</button>`; }
function stat(label, value, caption, route = '') {
  const inner = `<div class="stat-top"><span>${label}</span></div><div class="stat-value">${value}</div><div class="stat-foot"><span class="neutral-dot"></span>${caption}</div>`;
  return route ? `<a class="stat-card stat-link" href="#${route}">${inner}</a>` : `<article class="stat-card">${inner}</article>`;
}
function empty(title, description, kind = '') {
  const control = kind ? `<button type="button" class="empty-icon empty-add" data-action="add" data-kind="${kind}" aria-label="Add ${kind}">＋</button>` : '<span class="empty-icon">＋</span>';
  return `<div class="empty-state compact">${control}<strong>${title}</strong><span>${description}</span></div>`;
}
function card(title, subtitle, body, action = '') { return `<article class="panel"><div class="panel-heading"><div><h2>${title}</h2><p>${subtitle}</p></div>${action}</div>${body}</article>`; }
function pageHeader(title, subtitle, add = '') { return `<section class="welcome-row"><div><div class="eyebrow">ACADELY WORKSPACE</div><h1>${title}<span class="title-period">.</span></h1><p class="welcome-subtitle">${subtitle}</p></div>${add}</section>`; }
function addButton(label, kind = '') { return button(`<span class="plus">+</span> ${label}`, 'add', 'primary', kind ? `data-kind="${kind}"` : ''); }
function progressBar(value) { return `<div class="data-progress"><span style="width:${Math.max(0, Math.min(100, Number(value) || 0))}%"></span></div>`; }
function gpaSummary() { return UniTrackMath.calculateGpa(data.courses, data.assessments, data.settings.gradeScale, data.settings.maxGpa); }

function onboarding() {
  const hasData = COLLECTIONS.some((key) => data[key].length);
  if (hasData) return '';
  return card('Welcome to ACADELY', 'A simple place to organize courses, deadlines, grades, and study time.', `<ol class="setup-steps"><li><strong>1. Add your first course</strong><span>Start with a course name and its credit hours.</span>${button('Add a course', 'add', 'primary', 'data-kind="course"')}</li><li><strong>2. Add assignments and exams</strong><span>Give each item a due date so your dashboard and study plan can help.</span><a class="text-link" href="#assignments">Open assignments ↗</a></li><li><strong>3. Track your grades and classes</strong><span>Record marks, assessment weights, and your weekly timetable.</span><a class="text-link" href="#grades">Open grade calculator ↗</a></li></ol>`, '<a class="text-link" href="#settings">Set university details ↗</a>');
}

function dashboard() {
  const pending = data.assignments.filter((item) => !item.done);
  const completed = data.assignments.filter((item) => item.done);
  const examsSoon = data.exams.filter((item) => item.date && item.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
  const deadlines = pending.filter((item) => item.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4);
  const plans = makePlan().slice(0, 3);
  const pct = data.assignments.length ? Math.round(completed.length / data.assignments.length * 100) : 0;
  const gpaData = gpaSummary();
  const day = DAYS[(new Date().getDay() + 6) % 7];
  const classes = data.classes.filter((item) => item.day === day).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening';
  return `${pageHeader(`Good ${greeting}`, 'Your academic workspace, all in one place.', button('<span class="plus">+</span> Quick add', 'quick-add', 'primary'))}${onboarding()}<section class="stats-grid">${stat('Total assignments', data.assignments.length, 'Across all your courses', 'assignments')}${stat('Pending', pending.length, 'Keep your next deadline in sight', 'assignments')}${stat('Completed', completed.length, 'Your completed work', 'assignments')}${stat('Upcoming exams', examsSoon.length, 'Exams on your calendar', 'exams')}</section><section class="dashboard-grid">${card('Today’s classes', 'Your timetable for today', classes.length ? classes.map((item) => `<div class="data-row"><div><strong>${esc(item.start)} · ${esc(item.title)}</strong><small>${esc(courseName(item.courseId))} · ${esc(item.location || 'Location not set')}</small></div></div>`).join('') : empty('Your day is open', 'Add classes to your timetable to see them here.', 'class'), '<a class="text-link" href="#timetable">Timetable ↗</a>')}${card('Semester progress', 'Assignment completion', `<div class="progress-summary"><div class="progress-ring"><div class="ring-inner"><strong>${pct}<span>%</span></strong><small>completed</small></div></div><div class="progress-legend">${completed.length} complete · ${pending.length} remaining</div></div><div class="grade-placeholder"><span>${gpaData.value === null ? 'No GPA yet' : `${gpaData.estimated ? 'Estimated' : 'Final'} GPA ${gpaData.value.toFixed(2)} / ${Number(data.settings.maxGpa).toFixed(2)}`}</span><span>${gpaData.gradedCredits ? `${gpaData.gradedCredits} graded credits` : 'Enter a course grade to calculate GPA'}</span></div>`, '<a class="text-link" href="#overview">Overview ↗</a>')}${card('Smart study plan', 'Suggested focus for today', plans.length ? plans.map(planRow).join('') : empty('No study sessions suggested yet', 'Add an assignment or exam with a due date.', 'assignment'), '<a class="text-link" href="#planner">View plan ↗</a>')}${card('Upcoming deadlines', 'Your nearest assignments', deadlines.length ? deadlines.map((item) => `<div class="data-row"><div><strong>${esc(item.title)}</strong><small>${esc(courseName(item.courseId))} · ${dateLabel(item.due)}</small></div><span class="priority ${esc((item.priority || 'Medium').toLowerCase())}">${esc(item.priority || 'Medium')}</span></div>`).join('') : empty('No deadlines coming up', 'Add assignments and their due dates will appear here.', 'assignment'), '<a class="text-link" href="#assignments">Assignments ↗</a>')}${card('Upcoming exams', 'Next on your calendar', examsSoon.slice(0, 3).length ? examsSoon.slice(0, 3).map((item) => `<div class="data-row"><div><strong>${esc(item.title)}</strong><small>${esc(courseName(item.courseId))} · ${dateLabel(item.date)}</small></div><span class="days-badge">${daysUntil(item.date)}d</span></div>`).join('') : empty('No exams scheduled', 'Add an exam to see it on your dashboard.', 'exam'), '<a class="text-link" href="#exams">Exams ↗</a>')}${card('Quick access', 'Continue where you need to', `<div class="quick-links"><a class="button button-secondary" href="#gpa">GPA calculator</a><a class="button button-secondary" href="#grades">What-if grade</a><a class="button button-secondary" href="#planner">Study planner</a><a class="button button-secondary" href="#settings">Settings</a></div>`)}</section>`;
}

function assignmentMatches(item) {
  const overdue = !item.done && item.due && item.due < today();
  const filterMatch = assignmentFilter === 'all' || (assignmentFilter === 'pending' && !item.done && !overdue) || (assignmentFilter === 'completed' && item.done) || (assignmentFilter === 'overdue' && overdue);
  return filterMatch && `${item.title} ${courseName(item.courseId)} ${item.description || ''}`.toLowerCase().includes(assignmentSearch.toLowerCase());
}

function assignments() {
  const rows = data.assignments.filter(assignmentMatches).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  return `${pageHeader('Assignments', 'Keep track of coursework, priorities, and due dates.', addButton('Add assignment', 'assignment'))}<div class="assignment-tools"><label>Search<input id="assignment-search" type="search" value="${esc(assignmentSearch)}" placeholder="Search assignments"></label><label>Status<select id="assignment-filter"><option value="all" ${assignmentFilter === 'all' ? 'selected' : ''}>All assignments</option><option value="pending" ${assignmentFilter === 'pending' ? 'selected' : ''}>Pending</option><option value="completed" ${assignmentFilter === 'completed' ? 'selected' : ''}>Completed</option><option value="overdue" ${assignmentFilter === 'overdue' ? 'selected' : ''}>Overdue</option></select></label></div>${card('Assignments', 'Sorted by due date', rows.length ? rows.map((item) => `<div class="data-row"><div><strong>${esc(item.title)}${!item.done && item.due && item.due < today() ? ' <span class="overdue-tag">Overdue</span>' : ''}</strong><small>${esc(courseName(item.courseId))} · ${dateLabel(item.due)} · ${esc(item.priority || 'Medium')} priority${item.description ? ` · ${esc(item.description)}` : ''}</small></div><div class="row-actions"><button data-action="toggle-assignment" data-id="${esc(item.id)}">${item.done ? 'Undo' : 'Complete'}</button><button data-action="edit" data-kind="assignments" data-id="${esc(item.id)}">Edit</button><button data-action="delete" data-kind="assignments" data-id="${esc(item.id)}">Delete</button></div></div>`).join('') : empty('No matching assignments', 'Try a different filter or add an assignment.', 'assignment'))}`;
}

function gradePage() {
  const courseOptions = data.courses.map((course) => `<option value="${esc(course.id)}">${esc(course.name)}</option>`).join('');
  return `${pageHeader('Grade calculator', 'Track assessment weights and explore what-if outcomes.', button('Add assessment', 'add', 'primary', 'data-kind="assessment"'))}${data.courses.length ? `<section class="form-panel"><form id="whatif-form" class="inline-form"><label>Course<select name="courseId" required>${courseOptions}</select></label><label>Target final grade (%)<input name="target" type="number" min="0" max="100" step="any" value="90" required></label><label>Hypothetical average on remaining work (%)<input name="hypothetical" type="number" min="0" max="100" step="any" placeholder="Optional"></label><button class="button button-primary">Calculate</button></form><div id="whatif-result" class="result-box" aria-live="polite">Choose a course with assessment marks to calculate what you need.</div></section>` : card('Start with a course', 'Add a course before entering assessments or using what-if calculations.', empty('No courses yet', 'Create your first course to continue.', 'course'))}${card('Assessments', 'Marks are weighted using each assessment’s share of its course', data.assessments.length ? data.assessments.map((item) => `<div class="data-row"><div><strong>${esc(item.title)} · ${esc(courseName(item.courseId))}</strong><small>${item.score}/${item.max} marks · ${item.weight}% course weight</small></div><div class="row-actions"><button data-action="edit" data-kind="assessments" data-id="${esc(item.id)}">Edit</button><button data-action="delete" data-kind="assessments" data-id="${esc(item.id)}">Delete</button></div></div>`).join('') : empty('No assessments yet', 'Add an assessment to track a course grade.', data.courses.length ? 'assessment' : 'course'))}`;
}

function timetable() {
  const rows = data.classes.slice().sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || String(a.start).localeCompare(String(b.start)));
  return `${pageHeader('Timetable', 'Your weekly class schedule.', addButton('Add class', 'class'))}${card('Weekly classes', 'Classes are ordered by weekday and start time', rows.length ? rows.map((item) => `<div class="data-row"><div><strong>${esc(item.day)} · ${esc(item.title)}</strong><small>${esc(item.start)}–${esc(item.end)} · ${esc(courseName(item.courseId))} · ${esc(item.location || 'Location not set')}</small></div><div class="row-actions"><button data-action="edit" data-kind="classes" data-id="${esc(item.id)}">Edit</button><button data-action="delete" data-kind="classes" data-id="${esc(item.id)}">Delete</button></div></div>`).join('') : empty('No classes scheduled', 'Add classes to see your weekly timetable.', 'class'))}`;
}

function navRows(items, kind) {
  if (!items.length) return empty('Nothing here yet', `Add ${kind} to keep everything organized.`, kind === 'exams' ? 'exam' : 'assignment');
  return items.slice().sort((a, b) => String(a.date || a.due || '').localeCompare(String(b.date || b.due || ''))).map((item) => `<div class="data-row"><div><strong>${esc(item.title || item.name)}</strong><small>${esc(courseName(item.courseId))}${item.due || item.date ? ` · ${dateLabel(item.due || item.date)}` : ''}${item.description ? ` · ${esc(item.description)}` : ''}${item.date ? ` · ${daysUntil(item.date) < 0 ? `${Math.abs(daysUntil(item.date))} days ago` : `${daysUntil(item.date)} days away`}` : ''}</small></div><div class="row-actions">${kind === 'assignments' ? `<button data-action="toggle-assignment" data-id="${esc(item.id)}">${item.done ? 'Undo' : 'Complete'}</button>` : ''}<button data-action="edit" data-kind="${kind}" data-id="${esc(item.id)}">Edit</button><button data-action="delete" data-kind="${kind}" data-id="${esc(item.id)}">Delete</button></div></div>`).join('');
}

function exams() { return `${pageHeader('Exams', 'See what is coming and prepare early.', addButton('Add exam', 'exam'))}${card('Exam calendar', 'Upcoming and past exams', navRows(data.exams, 'exams'))}`; }

function gpaCourseRow(course, gradeData) {
  const current = gradeData.courses.find((item) => item.course.id === course.id);
  const percent = current?.percentage;
  const grade = percent === null || percent === undefined ? null : gradeFor(percent);
  const mode = course.gradeMode === 'final' ? 'final' : 'assessments';
  const details = grade ? `${percent.toFixed(2)}% · ${grade.letter} · ${grade.points.toFixed(2)} / ${Number(data.settings.maxGpa).toFixed(2)} GPA` : 'No grade entered yet';
  const completion = current?.completion || 0;
  return `<div class="gpa-course"><div class="gpa-course-main"><div><strong>${esc(course.name)}</strong><small>${Number(course.credits) || 0} credits · ${details}</small></div><span class="priority ${completion >= 100 ? 'low' : 'medium'}">${mode === 'final' ? 'Final grade' : completion >= 100 ? 'Complete' : `${completion.toFixed(0)}% graded`}</span></div>${mode === 'final' ? `<form class="final-grade-form" data-course-id="${esc(course.id)}"><label>Final course grade (%)<input name="finalGrade" type="number" min="0" max="100" step="any" value="${course.finalGrade ?? ''}" placeholder="0–100"></label><button class="button button-primary">Save grade</button></form>` : `<div class="gpa-course-actions"><span>${completion < 100 && grade ? `Current assessment average; ${Math.max(0, 100 - completion).toFixed(0)}% weight remains.` : grade ? 'All course weight has a mark.' : 'Track individual assessment marks and weights.'}</span><button class="row-action-button" data-action="add" data-kind="assessment" data-course-id="${esc(course.id)}">Add assessment</button></div>`}${progressBar(completion)}<div class="row-actions gpa-row-actions"><button data-action="toggle-grade-mode" data-id="${esc(course.id)}">Use ${mode === 'final' ? 'assessment tracking' : 'final grade'}</button><button data-action="edit" data-kind="courses" data-id="${esc(course.id)}">Edit course</button><button data-action="delete" data-kind="courses" data-id="${esc(course.id)}">Delete</button></div></div>`;
}

function gpa() {
  const result = gpaSummary();
  const title = result.value === null ? '—' : result.value.toFixed(2);
  const status = result.value === null ? 'Enter a grade to calculate GPA' : `${result.estimated ? 'Estimated current GPA' : 'Final GPA'} · ${Number(data.settings.maxGpa).toFixed(2)} point scale`;
  return `${pageHeader('GPA calculator', 'Add courses, enter a final grade or track assessments, and see your credit-weighted GPA.', addButton('Add course', 'course'))}<section class="stats-grid">${stat('Total courses', data.courses.length, 'Configured courses')}${stat('Graded credits', result.gradedCredits.toLocaleString(), 'Only valid graded credits count')}${stat(result.estimated ? 'Estimated GPA' : 'Current GPA', title, status)}${stat('Maximum scale', Number(data.settings.maxGpa).toFixed(2), 'Configured in university settings')}</section>${card('Your courses', 'Each course is counted once. Choose a final grade or assessment tracking.', data.courses.length ? `<div class="gpa-course-list">${data.courses.map((course) => gpaCourseRow(course, result)).join('')}</div>` : empty('No courses yet', 'Add your first course to get started.', 'course'))}${card('How GPA works', 'Transparent, credit-weighted calculation', `<p class="helper-text">GPA = total of (course GPA points × course credits) ÷ total graded course credits. Ungraded courses and courses with zero or invalid credits are not included. Assessment grades show an estimate until the full course weight is entered; missing work may change the final result.</p><a class="text-link" href="#settings">Review your grade scale ↗</a>`)}`;
}

function settings() {
  const setting = data.settings;
  return `${pageHeader('Settings', 'Configure your university, semester, grade boundaries, and study availability.')}${card('University & grading', 'Use the grading rules from your university. The built-in boundaries scale with the maximum GPA until you customize them.', `<form id="settings-form" class="settings-form"><label>University name<input name="university" value="${esc(setting.university)}" maxlength="120" placeholder="e.g. University name"></label><label>Semester name<input name="semester" value="${esc(setting.semester)}" maxlength="80" placeholder="e.g. Fall semester"></label><div class="two-fields"><label>Semester starts<input name="start" type="date" value="${esc(setting.start)}"></label><label>Semester ends<input name="end" type="date" value="${esc(setting.end)}"></label></div><div class="two-fields"><label>Maximum GPA<input name="maxGpa" type="number" min="1" max="20" step="0.1" value="${setting.maxGpa}" required></label><label>Available study hours per day<input name="availableHours" type="number" min="0.25" max="16" step="0.25" value="${setting.availableHours}" required></label></div><h3>Grade boundaries</h3><p class="helper-text">Each row is a minimum percentage, a letter grade, and GPA points. Keep a 0% boundary and award the selected maximum points at the top boundary.</p><div class="scale-list">${setting.gradeScale.map((grade, index) => scaleRow(grade, index)).join('')}</div><div class="row-actions"><button type="button" class="row-action-button" data-action="scale-add">+ Add boundary</button><button type="button" class="row-action-button" data-action="scale-reset">Reset to defaults for this scale</button></div><div><button class="button button-primary">Save university settings</button></div></form>`)}${card('Data storage', 'Your data stays in this browser', `<p class="helper-text">ACADELY stores your data in this browser’s LocalStorage. It does not sync to your GitHub repository. Export a JSON backup before replacing data with an import.</p><div class="row-actions">${button('Export JSON', 'export')}<label class="button button-secondary import-button">Import JSON<input type="file" accept="application/json,.json" id="import-file" hidden></label></div>`)}${card('About Acadely', 'Learn about the platform and its creator.', '<a class="text-link" href="#about">Read about Acadely ↗</a>')}`;
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || 'S').toUpperCase();
}

function syncProfileDisplay() {
  const name = String(data.studentProfile.fullName || '').trim() || 'Student';
  document.querySelector('.profile-copy strong').textContent = name;
  document.querySelector('.profile-copy small').textContent = 'Local profile · not verified';
  document.querySelector('.avatar').textContent = initials(name);
  document.querySelector('.top-avatar').textContent = initials(name);
  document.querySelector('.top-avatar').title = name;
  document.querySelector('.top-avatar').setAttribute('aria-label', `${name}, local profile`);
}

function profile() {
  const item = data.studentProfile;
  return `${pageHeader('Student profile', 'Your private academic details, saved on this browser.')}${card('Personal details', 'You can update these fields whenever you need. A local profile is not a verified account.', `<div class="profile-preview"><span class="avatar profile-avatar">${esc(initials(item.fullName))}</span><div><strong>${esc(item.fullName || 'Your initials')}</strong><small>Initials are used as your profile image.</small></div></div><form id="student-profile-form" class="settings-form"><label>Full name<input name="fullName" value="${esc(item.fullName)}" maxlength="120" autocomplete="name" placeholder="Your name"></label><label>Student ID / University UID <span class="helper-inline">Optional</span><input name="studentId" value="${esc(item.studentId)}" maxlength="80" autocomplete="off" placeholder="Optional"></label><label>University name<input name="university" value="${esc(item.university || data.settings.university)}" maxlength="120" placeholder="University"></label><label>Major / degree program<input name="major" value="${esc(item.major)}" maxlength="120" placeholder="e.g. Computer Science"></label><div class="two-fields"><label>Academic year<input name="academicYear" value="${esc(item.academicYear)}" maxlength="40" placeholder="e.g. Second year"></label><label>Current semester<input name="semester" value="${esc(item.semester || data.settings.semester)}" maxlength="80" placeholder="e.g. Fall semester"></label></div><label>Email address <span class="helper-inline">Optional</span><input name="email" type="email" value="${esc(item.email)}" maxlength="254" autocomplete="email" placeholder="you@example.edu"></label><div><button class="button button-primary">Save profile</button></div></form><p class="helper-text">Your profile is stored locally in this browser. Acadely does not verify your identity, request university passwords, or sync profile details to a cloud account.</p>`)}`;
}

function about() {
  return `${pageHeader('About Acadely', 'Your academic journey, made clearer.')}`+
    `<section class="about-grid">${card('What Acadely is', 'One clear workspace for the moving parts of university life.', '<p>Acadely brings courses, assignments, exams, grades, timetables, and study plans together so students can see what needs attention.</p>')}${card('Why it was created', 'Less time searching. More time making progress.', '<p>University work is often scattered across calendars, course pages, and personal notes. Acadely was created to make those responsibilities easier to organize in one place.</p>')}${card('Mission', 'Help students make steady, informed progress.', '<p>Make academic planning easier to understand, easier to maintain, and useful across different universities and grading systems.</p>')}${card('Vision', 'A calmer way to manage a semester.', '<p>Give every student a reliable overview of their work, time, and progress without adding more complexity to their day.</p>')}${card('The problems Acadely works to solve', 'Clear deadlines, connected tools, and useful context.', '<ul class="about-list"><li>Deadlines spread across different tools.</li><li>Unclear course progress and grade expectations.</li><li>Difficulty balancing study time with weekly classes.</li><li>Academic information that is hard to review at a glance.</li></ul>')}${card('Creator profile', 'Creator of ACADELY', `<div class="profile-preview"><span class="avatar profile-avatar">${esc(initials(CREATOR_PROFILE.name))}</span><div><strong>${esc(CREATOR_PROFILE.name)}</strong><a class="text-link" href="mailto:${encodeURIComponent(CREATOR_PROFILE.email)}">${esc(CREATOR_PROFILE.email)}</a><small>Public creator contact</small></div></div>`)}</section><div class="version-note">ACADELY · Browser edition · Version ${APP_VERSION}</div>`;
}

function scaleRow(grade, index) {
  return `<div class="scale-row" data-scale-row><label>Letter<input data-scale="letter" value="${esc(grade.letter)}" maxlength="8" required></label><label>Minimum %<input data-scale="min" type="number" min="0" max="100" step="any" value="${grade.min}" required></label><label>GPA points<input data-scale="gpa" type="number" min="0" max="20" step="0.1" value="${grade.gpa}" required></label><button type="button" class="row-action-button" data-action="scale-remove" aria-label="Remove grade boundary ${index + 1}">Remove</button></div>`;
}

function weekSessions() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((day, index) => {
    const date = new Date();
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + index);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { day, count: data.sessions.filter((session) => session.done && session.date === iso).length };
  });
}
function isThisWeek(iso) {
  if (!validDate(iso)) return false;
  const date = new Date(`${iso}T12:00:00`), now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const end = new Date(start); end.setDate(end.getDate() + 7);
  return date >= start && date < end;
}

function overview() {
  const total = data.assignments.length, done = data.assignments.filter((item) => item.done).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const examsSoon = data.exams.filter((item) => item.date && item.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
  const deadlines = data.assignments.filter((item) => !item.done && item.due && item.due >= today()).sort((a, b) => a.due.localeCompare(b.due));
  const workload = data.assignments.filter((item) => !item.done).length + examsSoon.length;
  const week = weekSessions();
  const completedSessions = data.sessions.filter((session) => session.done && isThisWeek(session.date)).length;
  const grades = gpaSummary();
  const dates = [...deadlines.map((item) => ({ title: item.title, date: item.due, type: 'Assignment' })), ...examsSoon.map((item) => ({ title: item.title, date: item.date, type: 'Exam' }))].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  return `${pageHeader('Semester overview', `${esc(data.settings.semester || 'Your semester')} · ${esc(data.settings.university || 'Configure your university in Settings')}`)}<section class="stats-grid">${stat('Academic progress', `${pct}%`, `${done} of ${total} assignments completed`)}${stat('Current GPA', grades.value === null ? '—' : grades.value.toFixed(2), grades.estimated ? 'Estimate · incomplete assessments' : 'Based on graded credits')}${stat('Upcoming exams', examsSoon.length, 'Scheduled future exams')}${stat('Remaining workload', workload, 'Pending assignments and exams')}</section><section class="overview-grid">${card('Course grades', 'Calculated from final grades or assessment marks', data.courses.length ? data.courses.map((course) => { const item = grades.courses.find((row) => row.course.id === course.id); return `<div class="course-progress"><div class="data-row"><div><strong>${esc(course.name)}</strong><small>${item?.percentage == null ? 'No grade entered' : `${item.percentage.toFixed(1)}% · ${item.letter || '—'} · ${Number(course.credits) || 0} credits · ${item.completion.toFixed(0)}% graded`}</small></div><strong>${item?.percentage == null ? '—' : `${item.percentage.toFixed(0)}%`}</strong></div>${progressBar(item?.completion || 0)}</div>`; }).join('') : empty('No courses configured', 'Add courses and grades to see summaries.', 'course'))}${card('Weekly productivity', 'Completed study sessions recorded this week', `<div class="week-bars">${week.map((item) => `<div title="${item.count} completed sessions"><span style="height:${item.count ? Math.min(100, item.count * 22) : 3}%"></span><small>${item.day}</small></div>`).join('')}</div><p class="helper-text">${completedSessions} completed sessions this week. Only saved and completed sessions are counted.</p>`)}${card('Completed assessments', 'Completed assignment work', done ? data.assignments.filter((item) => item.done).map((item) => `<div class="data-row"><div><strong>${esc(item.title)}</strong><small>${esc(courseName(item.courseId))}${item.due ? ` · ${dateLabel(item.due)}` : ''}</small></div><span class="completion-mark">✓</span></div>`).join('') : empty('No completed assessments', 'Mark assignments complete to see them here.'))}${card('Upcoming dates', 'Assignments and exams', dates.length ? dates.map((item) => `<div class="data-row"><div><strong>${esc(item.title)}</strong><small>${item.type} · ${dateLabel(item.date)}</small></div><span class="days-badge">${daysUntil(item.date)}d</span></div>`).join('') : empty('No upcoming dates', 'Add assignment deadlines and exams to plan your semester.'))}</section>`;
}

function makePlan() {
  const tasks = [
    ...data.assignments.filter((item) => !item.done && item.due).map((item) => ({ ...item, due: item.due, exam: false })),
    ...data.exams.filter((item) => item.date && item.date >= today()).map((item) => ({ ...item, due: item.date, priority: 'High', exam: true })),
  ].sort((a, b) => {
    const urgency = (item) => {
      const days = daysUntil(item.due);
      const priority = item.priority === 'High' ? 30 : item.priority === 'Low' ? 0 : 15;
      return (days < 0 ? 1000 + Math.min(365, Math.abs(days)) : 300 - days * 10) + priority + (item.exam ? 20 : 0);
    };
    return urgency(b) - urgency(a);
  });
  let available = Number(data.settings.availableHours) || 2;
  return tasks.map((task) => {
    const hours = Math.min(available, Math.max(0.25, Number(task.studyHours) || (task.exam ? 1.5 : 1)));
    available -= hours;
    const delta = daysUntil(task.due);
    const why = delta < 0 ? 'Overdue work prioritized' : delta <= 2 ? 'Due very soon' : task.exam ? 'Upcoming exam preparation' : task.priority === 'High' ? 'High priority deadline' : 'Earlier deadline prioritized';
    return { task, hours, why, date: task.due };
  }).filter((plan) => plan.hours > 0);
}
function planRow(plan) { return `<div class="data-row"><div><strong>${esc(plan.task.title)} · ${plan.hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}h</strong><small>${esc(courseName(plan.task.courseId))} · ${dateLabel(plan.date)} · ${esc(plan.why)}</small></div></div>`; }

function planner() {
  const suggestions = makePlan();
  return `${pageHeader('Smart study planner', 'A transparent daily plan based on your deadlines and available hours.', button('Refresh suggestions', 'refresh-plan'))}${card('Suggested sessions', 'Urgency uses deadline proximity, priority, and available hours. You can change any suggestion.', suggestions.length ? suggestions.map((plan) => `<div class="data-row"><div><strong>${esc(plan.task.title)} · ${plan.hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} hours</strong><small>${esc(plan.why)} · ${dateLabel(plan.date)}</small></div><div class="row-actions"><button data-action="save-plan" data-id="${esc(plan.task.id)}" data-exam="${plan.task.exam}" data-hours="${plan.hours}" data-date="${esc(plan.date)}">Add to plan</button></div></div>`).join('') : empty('Nothing to schedule', 'Add an assignment or exam with a due date to receive a suggestion.', 'assignment'))}${card('Your study sessions', 'Complete, edit, or remove saved sessions.', data.sessions.length ? data.sessions.map((session) => `<div …1193 tokens truncated… const iso = isoDate(day), items = events.filter((item) => item.date === iso), outside = day.getMonth() !== calendarCursor.getMonth();
    return `<div class="calendar-day${outside ? ' is-outside' : ''}${iso === selected ? ' is-selected' : ''}${iso === today() ? ' is-today' : ''}"><button type="button" class="calendar-date" data-action="calendar-select" data-date="${iso}" aria-label="Select ${day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}">${day.getDate()}</button><div class="calendar-day-events">${items.slice(0, 3).map((item) => calendarEventButton(item, true)).join('')}${items.length > 3 ? `<span class="calendar-more">+${items.length - 3} more</span>` : ''}</div></div>`;
  }).join('');
  return `<div class="calendar-month-grid">${headings}${cells}</div>`;
}
function weekGrid(start) {
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const events = calendarEvents(start, end);
  return `<div class="calendar-week-grid">${DAYS.map((day, index) => {
    const date = new Date(start); date.setDate(date.getDate() + index); const iso = isoDate(date), items = events.filter((item) => item.date === iso);
    return `<section class="calendar-week-day${iso === today() ? ' is-today' : ''}"><button class="calendar-week-date" type="button" data-action="calendar-select" data-date="${iso}"><span>${day.slice(0, 3)}</span><strong>${date.getDate()}</strong></button><div class="calendar-week-events">${items.length ? items.map((item) => calendarEventButton(item)).join('') : '<span class="calendar-no-events">No events</span>'}</div></section>`;
  }).join('')}</div>`;
}
function calendarRange() {
  if (calendarMode === 'month') return { from: new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1, 12), to: new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0, 12) };
  if (calendarMode === 'week') { const from = mondayOf(calendarCursor), to = new Date(from); to.setDate(to.getDate() + 6); return { from, to }; }
  return { from: new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), calendarCursor.getDate(), 12), to: new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), calendarCursor.getDate(), 12) };
}
function calendarTitle(from, to) {
  if (calendarMode === 'month') return from.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  if (isoDate(from) === isoDate(to)) return from.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const sameYear = from.getFullYear() === to.getFullYear();
  return `${from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${to.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${sameYear ? `, ${to.getFullYear()}` : `, ${from.getFullYear()} – ${to.getFullYear()}`}`;
}
function calendarAgenda(date) {
  const events = calendarEvents(dateFromIso(date), dateFromIso(date));
  return events.length ? events.map((item) => `<div class="calendar-agenda-row"><span class="calendar-category-dot event-${esc(item.category)}"></span><div><strong>${esc(item.title)}</strong><small>${esc(categoryLabel(item.category))}${item.start ? ` · ${esc(item.start)}${item.end ? `–${esc(item.end)}` : ''}` : ''}${item.courseId ? ` · ${esc(courseName(item.courseId))}` : ''}${item.description ? ` · ${esc(item.description)}` : ''}${item.done ? ' · Completed' : ''}</small></div><button type="button" class="row-action-button" data-action="calendar-event" data-kind="${esc(item.kind)}" data-id="${esc(item.sourceId || item.id)}" data-date="${esc(item.date)}">Details</button></div>`).join('') : `<div class="empty-state compact"><button type="button" class="empty-icon empty-add" data-action="calendar-add" aria-label="Add calendar event">＋</button><strong>Nothing scheduled</strong><span>Add a personal event or use assignments, exams, and the timetable to fill your calendar.</span></div>`;
}
function calendar() {
  const { from, to } = calendarRange();
  const selected = calendarSelected && validDate(calendarSelected) ? calendarSelected : today();
  const view = calendarMode === 'month' ? monthGrid() : calendarMode === 'week' ? weekGrid(mondayOf(calendarCursor)) : `<div class="calendar-day-view">${calendarEvents(from, to).length ? calendarEvents(from, to).map((item) => `<div class="calendar-day-event">${calendarEventButton(item)}</div>`).join('') : `<div class="empty-state compact"><button type="button" class="empty-icon empty-add" data-action="calendar-add" aria-label="Add calendar event">＋</button><strong>A clear day</strong><span>There are no events scheduled for this date.</span></div>`}</div>`;
  const toolbar = `<div class="calendar-toolbar"><div class="calendar-date-controls"><button type="button" class="calendar-arrow" data-action="calendar-shift" data-direction="-1" aria-label="Previous ${calendarMode}">‹</button><strong>${esc(calendarTitle(from, to))}</strong><button type="button" class="calendar-arrow" data-action="calendar-shift" data-direction="1" aria-label="Next ${calendarMode}">›</button><button type="button" class="button button-secondary calendar-today" data-action="calendar-today">Today</button></div><div class="calendar-toolbar-actions"><div class="calendar-view-switch" role="group" aria-label="Calendar view">${['month', 'week', 'day'].map((mode) => `<button type="button" data-action="calendar-view" data-view="${mode}" aria-pressed="${calendarMode === mode}" class="${calendarMode === mode ? 'active' : ''}">${mode[0].toUpperCase()}${mode.slice(1)}</button>`).join('')}</div>${button('＋ Add event', 'calendar-add', 'primary')}</div></div>`;
  const legend = `<div class="calendar-legend">${[['assignment','Assignments'],['exam','Exams'],['class','Classes'],['personal','Personal events'],['study','Study'],['deadline','Academic dates']].map(([kind,label]) => `<span><i class="event-${kind}"></i>${label}</span>`).join('')}</div>`;
  return `${pageHeader('Academic calendar', 'See coursework, exams, classes, and personal events together.')}${card('Your calendar', 'Select an event to see details. Existing academic records appear here automatically.', `${toolbar}${legend}${view}`)}${card(`Events · ${dateLabel(selected)}`, 'Everything scheduled on the selected date.', `<div class="calendar-agenda">${calendarAgenda(selected)}</div>`)}`;
}

function showCalendarEventForm(record = null) {
  const editing = Boolean(record?.id);
  const modal = document.createElement('dialog'); modal.className = 'app-dialog';
  const current = record || { date: calendarSelected || today(), category: 'personal' };
  modal.innerHTML = `<form class="calendar-form"><div class="panel-heading"><div><h2>${editing ? 'Edit event' : 'Add event'}</h2><p>Personal calendar events are saved in this browser.</p></div><button type="button" class="close-dialog" data-cancel aria-label="Close">×</button></div><div class="dialog-fields"><label>Event title<input name="title" value="${esc(current.title || '')}" maxlength="120" required></label><label>Description<input name="description" value="${esc(current.description || '')}" maxlength="500" placeholder="Optional details"></label><label>Category<select name="category">${['personal','study','deadline','other'].map((category) => `<option value="${category}" ${current.category === category ? 'selected' : ''}>${categoryLabel(category)}</option>`).join('')}</select></label><label>Date<input name="date" type="date" value="${esc(current.date || today())}" required></label><div class="two-fields"><label>Start time<input name="start" type="time" value="${esc(current.start || '')}"></label><label>End time<input name="end" type="time" value="${esc(current.end || '')}"></label></div></div><div class="dialog-actions"><button type="button" class="button button-secondary" data-cancel>Cancel</button><button class="button button-primary">${editing ? 'Save changes' : 'Save event'}</button></div></form>`;
  document.body.append(modal); modal.showModal();
  modal.querySelectorAll('[data-cancel]').forEach((button) => button.addEventListener('click', () => modal.close()));
  modal.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault(); const fields = new FormData(event.currentTarget), date = String(fields.get('date') || ''), start = String(fields.get('start') || ''), end = String(fields.get('end') || '');
    const title = String(fields.get('title') || '').trim();
    if (!title || title.length > 120 || !validDate(date)) return msg('Enter an event title and a valid date.');
    if (start && end && start >= end) return msg('The event end time must be after its start time.');
    const saved = { ...(record || {}), title, description: String(fields.get('description') || '').trim(), category: String(fields.get('category') || 'personal'), date, start, end };
    if (!editing) { saved.id = crypto.randomUUID(); data.events.push(saved); } else Object.assign(record, saved);
    calendarSelected = date; calendarCursor = dateFromIso(date); modal.close(); save(); msg(editing ? 'Event updated.' : 'Event saved.');
  });
  modal.addEventListener('close', () => modal.remove());
}

function showCalendarEventDetails(kind, id, date) {
  let item;
  if (kind === 'custom') item = data.events.find((event) => event.id === id);
  else if (kind === 'assignment') item = data.assignments.find((event) => event.id === id);
  else if (kind === 'exam') item = data.exams.find((event) => event.id === id);
  else if (kind === 'class') item = data.classes.find((event) => event.id === id);
  else if (kind === 'deadline') item = { title: id === 'semester-start' ? 'Semester begins' : 'Semester ends', description: data.settings.semester || '', date };
  if (!item) return;
  const category = kind === 'custom' ? item.category : kind;
  const description = kind === 'class' ? item.location : item.description;
  const time = item.start ? `${item.start}${item.end ? `–${item.end}` : ''}` : '';
  const link = ({ assignment: '#assignments', exam: '#exams', class: '#timetable' })[kind];
  const modal = document.createElement('dialog'); modal.className = 'app-dialog calendar-details';
  modal.innerHTML = `<div class="panel-heading"><div><span class="calendar-detail-category event-${esc(category)}">${esc(categoryLabel(category))}</span><h2>${esc(item.title)}</h2><p>${date ? dateFromIso(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''}${time ? ` · ${esc(time)}` : ''}${item.courseId ? ` · ${esc(courseName(item.courseId))}` : ''}</p></div><button type="button" class="close-dialog" data-cancel aria-label="Close">×</button></div>${description ? `<p class="helper-text">${esc(description)}</p>` : ''}${item.done ? '<p class="completion-mark">Completed assignment</p>' : ''}<div class="dialog-actions">${kind === 'custom' ? `<button type="button" class="button button-secondary" data-action="calendar-edit" data-id="${esc(id)}">Edit event</button><button type="button" class="row-action-button" data-action="calendar-delete" data-id="${esc(id)}">Delete</button>` : link ? `<a class="button button-secondary" href="${link}" data-cancel>Open ${categoryLabel(kind).toLowerCase()} list</a>` : ''}<button type="button" class="button button-primary" data-cancel>Done</button></div>`;
  document.body.append(modal); modal.showModal();
  modal.querySelectorAll('[data-cancel]').forEach((button) => button.addEventListener('click', () => modal.close()));
  modal.addEventListener('close', () => modal.remove());
}

function render() {
  currentPage = validRoute(location.hash.slice(1)) || currentPage || 'dashboard';
  document.querySelectorAll('.nav-item[data-page]').forEach((anchor) => {
    const active = anchor.dataset.page === currentPage;
    anchor.classList.toggle('active', active);
    if (active) anchor.setAttribute('aria-current', 'page'); else anchor.removeAttribute('aria-current');
  });
  const count = document.querySelector('.nav-count');
  if (count) count.textContent = data.assignments.filter((item) => !item.done).length;
  document.querySelector('.breadcrumb strong').textContent = labels[currentPage] || 'Dashboard';
  content.innerHTML = views[currentPage]();
  bindPage();
  syncProfileDisplay();
}

function bindPage() {
  document.querySelector('#settings-form')?.addEventListener('submit', saveSettings);
  document.querySelector('#whatif-form')?.addEventListener('submit', calculateWhatIf);
  document.querySelectorAll('.final-grade-form').forEach((form) => form.addEventListener('submit', saveFinalGrade));
  document.querySelector('#student-profile-form')?.addEventListener('submit', saveStudentProfile);
}

function saveStudentProfile(event) {
  event.preventDefault(); const fields = new FormData(event.currentTarget);
  data.studentProfile = Object.fromEntries(['fullName','studentId','university','major','academicYear','semester','email'].map((key) => [key, String(fields.get(key) || '').trim()]));
  save(); msg('Student profile saved on this browser.');
}

function formFields(kind, record = {}) {
  const courses = selectCourses(record.courseId || '', kind === 'assessment');
  const fields = {
    course: `<label>Course name<input name="name" value="${esc(record.name || '')}" required maxlength="100" autocomplete="off"></label><label>Credit hours<input name="credits" type="number" min="0.1" max="100" step="0.1" value="${record.credits ?? 3}" required></label>`,
    assignment: `<label>Title<input name="title" value="${esc(record.title || '')}" required maxlength="100"></label><label>Course<select name="courseId">${courses}</select></label><label>Description<input name="description" value="${esc(record.description || '')}" maxlength="240"></label><label>Due date<input name="due" type="date" value="${esc(record.due || '')}"></label><label>Estimated study hours<input name="studyHours" type="number" min="0.25" max="100" step="0.25" value="${record.studyHours ?? 2}" required></label><label>Priority<select name="priority">${['Low', 'Medium', 'High'].map((value) => `<option ${record.priority === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>`,
    assessment: `<label>Assessment name<input name="title" value="${esc(record.title || '')}" required maxlength="100"></label><label>Course<select name="courseId" required>${courses}</select></label><div class="two-fields"><label>Score<input name="score" type="number" min="0" step="any" value="${record.score ?? ''}" required></label><label>Maximum marks<input name="max" type="number" min="0.01" step="any" value="${record.max ?? 100}" required></label></div><label>Course weight (%)<input name="weight" type="number" min="0.01" max="100" step="any" value="${record.weight ?? ''}" required></label>`,
    class: `<label>Class name<input name="title" value="${esc(record.title || '')}" required maxlength="100"></label><label>Course<select name="courseId">${courses}</select></label><label>Day<select name="day">${DAYS.map((day) => `<option ${record.day === day ? 'selected' : ''}>${day}</option>`).join('')}</select></label><div class="two-fields"><label>Start<input type="time" name="start" value="${esc(record.start || '')}" required></label><label>End<input type="time" name="end" value="${esc(record.end || '')}" required></label></div><label>Room or location<input name="location" value="${esc(record.location || '')}" maxlength="100"></label>`,
    exam: `<label>Exam name<input name="title" value="${esc(record.title || '')}" required maxlength="100"></label><label>Course<select name="courseId">${courses}</select></label><label>Exam date<input name="date" type="date" value="${esc(record.date || '')}" required></label>`,
  };
  return fields[kind];
}

function openRecordDialog(kind, record = null) {
  if (!['course', 'assignment', 'assessment', 'class', 'exam'].includes(kind)) return;
  if (['assignment', 'assessment', 'class', 'exam'].includes(kind) && !data.courses.length) {
    msg('Add a course first. Opening the course form now.');
    openRecordDialog('course');
    return;
  }
  const editing = Boolean(record?.id);
  const title = `${editing ? 'Edit' : 'Add'} ${kind === 'class' ? 'class' : kind}`;
  const modal = document.createElement('dialog');
  modal.className = 'app-dialog';
  modal.innerHTML = `<form class="record-form"><div class="panel-heading"><div><h2>${title}</h2><p>Complete the required fields before saving.</p></div><button type="button" class="close-dialog" data-cancel aria-label="Close">×</button></div><div class="dialog-fields">${formFields(kind, record || {})}</div><div class="dialog-actions"><button type="button" class="button button-secondary" data-cancel>Cancel</button><button type="submit" class="button button-primary">${editing ? 'Save changes' : 'Save'}</button></div></form>`;
  document.body.append(modal);
  modal.showModal();
  modal.querySelectorAll('[data-cancel]').forEach((control) => control.addEventListener('click', () => modal.close()));
  modal.querySelector('.record-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const error = validateRecord(kind, values, record?.id);
    if (error) { msg(error); return; }
    const saved = { ...(record || {}), ...values };
    if (kind === 'course') { saved.name = values.name.trim(); saved.credits = Number(values.credits); if (!editing) { saved.gradeMode = 'assessments'; saved.finalGrade = null; } }
    if (kind === 'assessment') { saved.score = Number(values.score); saved.max = Number(values.max); saved.weight = Number(values.weight); }
    if (kind === 'assignment') saved.studyHours = Number(values.studyHours);
    if (!editing) { saved.id = crypto.randomUUID(); data[{ course: 'courses', assignment: 'assignments', assessment: 'assessments', class: 'classes', exam: 'exams' }[kind]].push(saved); }
    else Object.assign(record, saved);
    modal.close();
    save();
    msg(`${kind[0].toUpperCase()}${kind.slice(1)} ${editing ? 'updated' : 'saved'}.`);
  });
  modal.addEventListener('close', () => modal.remove());
}

function validateRecord(kind, values, exceptId = '') {
  if (kind !== 'course' && !values.title?.trim()) return 'Please enter a title.';
  if (kind === 'course' && !values.name?.trim()) return 'Please enter a course name.';
  if (kind === 'course' && (!Number.isFinite(Number(values.credits)) || Number(values.credits) <= 0 || Number(values.credits) > 100)) return 'Course credits must be greater than 0 and at most 100.';
  if (kind === 'assignment' && (!Number.isFinite(Number(values.studyHours)) || Number(values.studyHours) <= 0)) return 'Study hours must be greater than 0.';
  if (kind === 'exam' && !validDate(values.date)) return 'Choose a valid exam date.';
  if (kind === 'assignment' && values.due && !validDate(values.due)) return 'Choose a valid assignment date.';
  if (kind === 'class' && (!values.start || !values.end || values.start >= values.end)) return 'Class end time must be after its start time.';
  if (kind === 'assessment') {
    const score = Number(values.score), max = Number(values.max), weight = Number(values.weight);
    if (![score, max, weight].every(Number.isFinite) || max <= 0 || score < 0 || score > max || weight <= 0) return 'Enter a valid score, maximum marks, and positive course weight.';
    const total = data.assessments.filter((item) => item.courseId === values.courseId && item.id !== exceptId).reduce((sum, item) => sum + Number(item.weight || 0), 0);
    if (total + weight > 100 + 1e-8) return `This course already has ${total.toFixed(2)}% assessment weight. The total cannot exceed 100%.`;
  }
  if (values.courseId && !data.courses.some((course) => course.id === values.courseId)) return 'Choose a course that still exists.';
  return '';
}

function addRecord(kind, courseId = '') {
  openRecordDialog(kind, kind === 'assessment' && courseId ? { courseId } : null);
}

function editRecord(collection, id) {
  const record = data[collection]?.find((item) => item.id === id);
  const kind = { courses: 'course', assignments: 'assignment', assessments: 'assessment', classes: 'class', exams: 'exam' }[collection];
  if (!record || !kind) return;
  openRecordDialog(kind, record);
}

function deleteRecord(collection, id) {
  if (!COLLECTIONS.includes(collection)) return;
  const record = data[collection].find((item) => item.id === id);
  if (!record) return;
  if (collection === 'courses') {
    const linked = ['assessments', 'assignments', 'exams', 'classes', 'sessions'].reduce((sum, key) => sum + data[key].filter((item) => item.courseId === id).length, 0);
    if (!confirm(`Delete ${record.name} and its ${linked} linked records? This can’t be undone.`)) return;
    for (const key of ['assessments', 'assignments', 'exams', 'classes', 'sessions']) data[key] = data[key].filter((item) => item.courseId !== id);
  } else if (!confirm('Delete this item? This can’t be undone.')) return;
  data[collection] = data[collection].filter((item) => item.id !== id);
  save(); msg('Item deleted.');
}

function saveFinalGrade(event) {
  event.preventDefault();
  const form = event.currentTarget, course = data.courses.find((item) => item.id === form.dataset.courseId);
  const value = form.elements.finalGrade.value;
  if (!course) return;
  if (value === '') { course.finalGrade = null; save(); msg('Final grade cleared.'); return; }
  const grade = Number(value);
  if (!Number.isFinite(grade) || grade < 0 || grade > 100) { msg('Final course grade must be between 0% and 100%.'); return; }
  course.finalGrade = grade;
  course.gradeMode = 'final';
  save(); msg('Final course grade saved.');
}

function saveSettings(event) {
  event.preventDefault();
  const form = event.currentTarget, fields = new FormData(form);
  const previous = data.settings;
  const maxGpa = Number(fields.get('maxGpa'));
  const availableHours = Number(fields.get('availableHours'));
  const start = fields.get('start'), end = fields.get('end');
  if (!Number.isFinite(maxGpa) || maxGpa < 1 || maxGpa > 20) return msg('Maximum GPA must be between 1 and 20.');
  if (!Number.isFinite(availableHours) || availableHours < 0.25 || availableHours > 16) return msg('Daily study time must be between 0.25 and 16 hours.');
  if ((start && !validDate(start)) || (end && !validDate(end)) || (start && end && start > end)) return msg('Enter valid semester dates and make sure the end date follows the start date.');
  const scale = [...form.querySelectorAll('[data-scale-row]')].map((row) => ({ letter: row.querySelector('[data-scale="letter"]').value, min: Number(row.querySelector('[data-scale="min"]').value), gpa: Number(row.querySelector('[data-scale="gpa"]').value) }));
  const untouchedBuiltIn = !previous.scaleCustomized && sameScale(scale, previous.gradeScale);
  const finalScale = untouchedBuiltIn && maxGpa !== Number(previous.maxGpa) ? defaultScale(maxGpa) : scale;
  const scaleValidation = UniTrackMath.validateGradeScale(finalScale, maxGpa);
  if (!scaleValidation.valid) return msg(scaleValidation.reason);
  data.settings = { ...previous, university: String(fields.get('university') || '').trim(), semester: String(fields.get('semester') || '').trim(), start, end, maxGpa, availableHours, gradeScale: scaleValidation.scale, scaleCustomized: !sameScale(scaleValidation.scale, defaultScale(maxGpa)) };
  save(); msg('University and grading settings saved.');
}

function calculateWhatIf(event) {
  event.preventDefault();
  const form = event.currentTarget, courseId = form.elements.courseId.value;
  const target = Number(form.elements.target.value);
  const rawHypothetical = form.elements.hypothetical.value;
  const hypothetical = rawHypothetical === '' ? null : Number(rawHypothetical);
  const result = document.querySelector('#whatif-result');
  if (!Number.isFinite(target) || target < 0 || target > 100 || (hypothetical !== null && (!Number.isFinite(hypothetical) || hypothetical < 0 || hypothetical > 100))) return msg('Enter percentages from 0 to 100.');
  const course = data.courses.find((item) => item.id === courseId);
  if (!course) return msg('Select a course.');
  const progress = courseProgress(courseId);
  if (progress.error) { result.textContent = 'The assessment data for this course is invalid. Correct the marks and weights before calculating.'; return; }
  if (!progress.total || progress.grade === null) { result.textContent = 'Add at least one valid weighted assessment for this course first.'; return; }
  const calculation = UniTrackMath.requiredAverage(progress.grade, progress.total, target);
  if (calculation.error === 'no-remaining-weight') { result.innerHTML = `All course weight is assessed. Current course grade: <strong>${progress.grade.toFixed(2)}%</strong>.`; return; }
  if (calculation.error) { msg('Check the assessment weights and target grade.'); return; }
  const projected = hypothetical === null ? null : UniTrackMath.projectedGrade(progress.grade, progress.total, hypothetical);
  const need = calculation.alreadyAchieved ? 'You have already reached this target based on your completed work.' : `You need an average of <strong>${calculation.required.toFixed(2)}%</strong> across the remaining ${calculation.remaining.toFixed(2)}% of the course.`;
  const unreachable = calculation.possible ? '' : `<br><strong>Target is mathematically unreachable.</strong> Even with 100% on all remaining work, your maximum final grade is ${calculation.maximum.toFixed(2)}%.`;
  const estimate = progress.remaining > 0 ? `<br>Current assessment average is based on ${progress.total.toFixed(2)}% of course weight; ${progress.remaining.toFixed(2)}% remains.` : '';
  result.innerHTML = `${need}${unreachable}${projected === null ? '' : `<br>With a hypothetical ${hypothetical}% average, your projected final grade is <strong>${projected.toFixed(2)}%</strong>.`}${estimate}`;
}

function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'acadely-data.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function validateImport(imported) {
  if (!imported || typeof imported !== 'object' || Array.isArray(imported)) throw new Error('Choose an ACADELY JSON object.');
  if (imported.settings !== undefined && (!imported.settings || typeof imported.settings !== 'object' || Array.isArray(imported.settings))) throw new Error('The settings section is invalid.');
  if (imported.studentProfile !== undefined && (!imported.studentProfile || typeof imported.studentProfile !== 'object' || Array.isArray(imported.studentProfile))) throw new Error('The student profile section is invalid.');
  if (imported.creatorProfile !== undefined && (!imported.creatorProfile || typeof imported.creatorProfile !== 'object' || Array.isArray(imported.creatorProfile))) throw new Error('The creator profile section is invalid.');
  const merged = { ...defaults(), ...imported, settings: { ...defaults().settings, ...(imported.settings || {}) } };
  merged.studentProfile = { ...defaults().studentProfile, ...(imported.studentProfile || {}) };
  merged.creatorProfile = { ...defaults().creatorProfile, ...(imported.creatorProfile || {}) };
  for (const key of COLLECTIONS) {
    if (merged[key] === undefined) merged[key] = [];
    if (!Array.isArray(merged[key])) throw new Error(`${key} must be a list.`);
    const ids = new Set();
    for (const record of merged[key]) {
      if (!record || typeof record !== 'object' || Array.isArray(record) || typeof record.id !== 'string' || !record.id || ids.has(record.id)) throw new Error(`${key} contains an invalid or duplicate record.`);
      ids.add(record.id);
    }
  }
  const maxGpa = Number(merged.settings.maxGpa);
  const scale = UniTrackMath.validateGradeScale(merged.settings.gradeScale, maxGpa);
  if (!Number.isFinite(maxGpa) || !scale.valid) throw new Error(scale.reason || 'The maximum GPA is invalid.');
  const available = Number(merged.settings.availableHours);
  if (!Number.isFinite(available) || available < 0.25 || available > 16) throw new Error('Daily available study time must be between 0.25 and 16 hours.');
  if ((merged.settings.start && !validDate(merged.settings.start)) || (merged.settings.end && !validDate(merged.settings.end)) || (merged.settings.start && merged.settings.end && merged.settings.start > merged.settings.end)) throw new Error('Semester dates are invalid.');
  for (const course of merged.courses) if (course.credits !== undefined && (!Number.isFinite(Number(course.credits)) || Number(course.credits) < 0)) throw new Error('A course has invalid credits.');
  const courseIds = new Set(merged.courses.map((course) => course.id));
  const assessmentWeights = new Map();
  for (const item of merged.assessments) {
    const score = Number(item.score), max = Number(item.max), weight = Number(item.weight);
    if (!courseIds.has(item.courseId) || ![score, max, weight].every(Number.isFinite) || max <= 0 || score < 0 || score > max || weight <= 0 || weight > 100) throw new Error('An assessment has invalid course, marks, or weight.');
    const total = (assessmentWeights.get(item.courseId) || 0) + weight;
    if (total > 100 + 1e-8) throw new Error('Assessment weights for one course cannot exceed 100%.');
    assessmentWeights.set(item.courseId, total);
  }
  for (const key of ['assignments', 'classes', 'exams', 'sessions']) for (const item of merged[key]) if (item.courseId && !courseIds.has(item.courseId)) throw new Error(`A ${key.slice(0, -1)} refers to a course that is not in this file.`);
  for (const item of merged.assignments) if ((item.due && !validDate(item.due)) || (item.studyHours !== undefined && (!Number.isFinite(Number(item.studyHours)) || Number(item.studyHours) <= 0))) throw new Error('An assignment has an invalid due date or study duration.');
  for (const item of merged.exams) if (!validDate(item.date)) throw new Error('An exam has an invalid date.');
  const eventCategories = new Set(['personal','study','deadline','other']);
  for (const item of merged.events) {
    if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 120 || !validDate(item.date) || !eventCategories.has(item.category || 'personal')) throw new Error('A calendar event has an invalid title, date, or category.');
    if (item.start && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.start)) throw new Error('A calendar event has an invalid start time.');
    if (item.end && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.end)) throw new Error('A calendar event has an invalid end time.');
    if (item.start && item.end && item.start >= item.end) throw new Error('A calendar event end time must follow its start time.');
  }
  for (const item of merged.sessions) if (!validDate(item.date) || !Number.isFinite(Number(item.hours)) || Number(item.hours) <= 0 || Number(item.hours) > 16) throw new Error('A study session has an invalid date or duration.');
  for (const course of merged.courses) if (course.finalGrade != null && course.finalGrade !== '' && (!Number.isFinite(Number(course.finalGrade)) || Number(course.finalGrade) < 0 || Number(course.finalGrade) > 100)) throw new Error('A course has an invalid final grade.');
  return merged;
}

async function importFile(file) {
  try {
    const imported = JSON.parse(await file.text());
    const validated = validateImport(imported);
    if (!confirm('Import this file and replace the ACADELY data saved in this browser? Export a backup first if you need to keep it.')) return;
    data = validated;
    save();
    msg('Data imported successfully.');
  } catch (error) {
    msg(error.message || 'Import failed. Choose a valid ACADELY JSON export.');
  }
}

function toggleMenu(force) {
  const menu = document.querySelector('#menu-toggle'), sidebar = document.querySelector('#sidebar'), overlay = document.querySelector('#mobile-overlay');
  const open = typeof force === 'boolean' ? force : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', open); overlay.classList.toggle('visible', open);
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
}

document.addEventListener('click', (event) => {
  const anchor = event.target.closest('a[href^="#"]');
  if (anchor) {
    const route = validRoute(anchor.getAttribute('href').slice(1));
    if (route) { currentPage = route; toggleMenu(false); render(); }
  }
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const { action, kind, id } = control.dataset;
  if (action === 'calendar-select') { calendarSelected = control.dataset.date; calendarCursor = dateFromIso(calendarSelected); render(); }
  else if (action === 'calendar-view') { calendarMode = ['month','week','day'].includes(control.dataset.view) ? control.dataset.view : 'month'; render(); }
  else if (action === 'calendar-today') { calendarSelected = today(); calendarCursor = dateFromIso(calendarSelected); render(); }
  else if (action === 'calendar-shift') {
    const direction = Number(control.dataset.direction) < 0 ? -1 : 1;
    if (calendarMode === 'month') calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + direction, 1, 12);
    else { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), calendarCursor.getDate() + direction * (calendarMode === 'week' ? 7 : 1), 12); }
    calendarSelected = isoDate(calendarCursor); render();
  }
  else if (action === 'calendar-add') showCalendarEventForm();
  else if (action === 'calendar-event') { event.stopPropagation(); showCalendarEventDetails(kind, id, control.dataset.date); }
  else if (action === 'calendar-edit') { control.closest('dialog')?.close(); showCalendarEventForm(data.events.find((item) => item.id === id)); }
  else if (action === 'calendar-delete') {
    if (confirm('Delete this personal calendar event?')) { control.closest('dialog')?.close(); data.events = data.events.filter((item) => item.id !== id); save(); msg('Calendar event deleted.'); }
  }
  if (action === 'add') addRecord(kind || ({ assignments: 'assignment', timetable: 'class', exams: 'exam', gpa: 'course' }[currentPage] || 'assignment'), control.dataset.courseId || '');
  else if (action === 'quick-add') addRecord(data.courses.length ? 'assignment' : 'course');
  else if (action === 'add-assessment') addRecord('assessment');
  else if (action === 'edit') editRecord(kind, id);
  else if (action === 'delete') deleteRecord(kind, id);
  else if (action === 'toggle-assignment') { const item = data.assignments.find((record) => record.id === id); if (item) { item.done = !item.done; save(); } }
  else if (action === 'toggle-grade-mode') {
    const course = data.courses.find((record) => record.id === id);
    if (course) { course.gradeMode = course.gradeMode === 'final' ? 'assessments' : 'final'; save(); msg(course.gradeMode === 'final' ? 'Final-grade entry selected. Your assessment records are preserved.' : 'Assessment tracking selected. Your final grade is preserved.'); }
  } else if (action === 'save-plan') {
    const source = control.dataset.exam === 'true' ? data.exams : data.assignments;
    const item = source.find((record) => record.id === id);
    if (item) { data.sessions.push({ id: crypto.randomUUID(), title: item.title, courseId: item.courseId, date: control.dataset.date, hours: Number(control.dataset.hours), reason: control.dataset.exam === 'true' ? 'Exam preparation' : 'Deadline-focused study', done: false, sourceId: item.id }); save(); msg('Study session added.'); }
  } else if (action === 'session-toggle') { const session = data.sessions.find((record) => record.id === id); if (session) { session.done = !session.done; save(); } }
  else if (action === 'session-delete') { if (confirm('Delete this study session?')) { data.sessions = data.sessions.filter((session) => session.id !== id); save(); } }
  else if (action === 'session-edit') editSession(id);
  else if (action === 'settings-save') document.querySelector('#settings-form')?.requestSubmit();
  else if (action === 'scale-add') addScaleRow();
  else if (action === 'scale-remove') { control.closest('[data-scale-row]')?.remove(); }
  else if (action === 'scale-reset') { const max = Number(document.querySelector('[name="maxGpa"]').value); document.querySelector('.scale-list').innerHTML = defaultScale(max).map(scaleRow).join(''); }
  else if (action === 'export') exportData();
  else if (action === 'refresh-plan') render();
});

function addScaleRow() {
  const list = document.querySelector('.scale-list');
  const row = document.createElement('div');
  row.innerHTML = scaleRow({ letter: '', min: 0, gpa: 0 }, list.querySelectorAll('[data-scale-row]').length);
  list.append(row.firstElementChild);
}

function editSession(id) {
  const session = data.sessions.find((item) => item.id === id);
  if (!session) return;
  const modal = document.createElement('dialog'); modal.className = 'app-dialog';
  modal.innerHTML = `<form class="session-form"><div class="panel-heading"><div><h2>Edit study session</h2><p>Update how long you will study and when.</p></div><button type="button" class="close-dialog" data-cancel>×</button></div><div class="dialog-fields"><label>Study hours<input name="hours" type="number" min="0.25" max="16" step="0.25" value="${Number(session.hours) || 1}" required></label><label>Session date<input name="date" type="date" value="${esc(session.date)}" required></label></div><div class="dialog-actions"><button class="button button-secondary" type="button" data-cancel>Cancel</button><button class="button button-primary">Save changes</button></div></form>`;
  document.body.append(modal); modal.showModal();
  modal.querySelectorAll('[data-cancel]').forEach((button) => button.addEventListener('click', () => modal.close()));
  modal.querySelector('form').addEventListener('submit', (event) => { event.preventDefault(); const fields = new FormData(event.currentTarget), hours = Number(fields.get('hours')), date = fields.get('date'); if (!Number.isFinite(hours) || hours < 0.25 || hours > 16 || !validDate(date)) return msg('Enter 0.25–16 hours and a valid session date.'); session.hours = hours; session.date = date; modal.close(); save(); msg('Study session updated.'); });
  modal.addEventListener('close', () => modal.remove());
}

document.addEventListener('change', (event) => {
  if (event.target.id === 'assignment-filter') { assignmentFilter = event.target.value; render(); }
  if (event.target.id === 'import-file' && event.target.files?.[0]) importFile(event.target.files[0]);
});
document.addEventListener('input', (event) => {
  if (event.target.id !== 'assignment-search') return;
  assignmentSearch = event.target.value;
  const cursor = event.target.selectionStart;
  render();
  const field = document.querySelector('#assignment-search'); field.focus(); field.setSelectionRange(cursor, cursor);
});
window.addEventListener('hashchange', () => { currentPage = validRoute(location.hash.slice(1)) || 'dashboard'; toggleMenu(false); render(); });
window.addEventListener('storage', (event) => { if (event.key === KEY) { data = load(); render(); msg('Updated from another ACADELY tab.'); } });
document.querySelector('#menu-toggle').addEventListener('click', () => toggleMenu());
document.querySelector('#mobile-overlay').addEventListener('click', () => toggleMenu(false));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') toggleMenu(false); });
document.querySelector('.icon-button[aria-label="Notifications"]')?.addEventListener('click', () => msg('You’re all caught up.'));
document.querySelector('.profile-button')?.addEventListener('click', () => { location.hash = '#profile'; });
document.querySelector('#top-date').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
render();

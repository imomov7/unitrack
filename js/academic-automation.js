// Explicit suggestions only: no guessed university dates or cross-institution credit conversion.
(function(root){
 const terms=['Fall','Spring','Summer','Custom'];
 function semesterParts(name='',now=new Date()) {
  const match=String(name).match(/^(Fall|Spring|Summer)\s+(\d{4})$/i);
  if(match)return {term:terms.find(t=>t.toLowerCase()===match[1].toLowerCase()),year:Number(match[2]),custom:''};
  return {term:name?'Custom':now.getMonth()<5?'Spring':now.getMonth()<8?'Summer':'Fall',year:now.getFullYear(),custom:String(name)};
 }
 function semesterName(term,year,custom='') {
  if(!terms.includes(term)||!Number.isInteger(Number(year))||Number(year)<1900||Number(year)>2200)return null;
  return term==='Custom'?(String(custom).trim().slice(0,80)||null):`${term} ${Number(year)}`;
 }
 function sameUniversity(names,value) {const key=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');return names.some(n=>key(n)===key(value));}
 function universityCourses(groups,university) {
  return groups.filter(g=>sameUniversity(g.universityNames,university)).flatMap(g=>g.courses.map(c=>({...c,source:c.source||g.source,edition:c.edition||g.edition,university:g.universityNames[0]})));
 }
 function semesterSuggestion(university,campus,term,year) {
  if(!sameUniversity(['Rochester Institute of Technology'],university)|| (campus && !/^(rochester|main|rochester campus)$/i.test(campus.trim())))return null;
  const dates={'Fall 2026':['2026-08-24','2026-12-16'],'Spring 2027':['2027-01-11','2027-05-05'],'Summer 2027':['2027-05-12','2027-08-10']};
  const pair=dates[`${term} ${year}`];return pair?{start:pair[0],end:pair[1],source:'https://www.rit.edu/calendar',campus:'Rochester campus',note:'Classes begin through final exams. Breaks are not automatically excluded.'}:null;
 }
 root.AcadelyAutomation={semesterParts,semesterName,sameUniversity,universityCourses,semesterSuggestion};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.AcadelyAutomation;
})(typeof globalThis!=='undefined'?globalThis:window);

// Dialog fields are shared by current, planned and historical semester editors.
function semesterSelectorFields(name,start,end) {
 const p=AcadelyAutomation.semesterParts(name);
 return `<div class="two-fields"><label>Semester<select name="term">${['Fall','Spring','Summer','Custom'].map(t=>`<option value="${t}" ${p.term===t?'selected':''}>${t==='Custom'?'Other / Custom':t}</option>`).join('')}</select></label><label>Academic year<input name="termYear" type="number" min="1900" max="2200" required value="${p.year}"></label></div><label data-custom-semester ${p.term!=='Custom'?'hidden':''}>Semester name<input name="customSemester" maxlength="80" value="${esc(p.custom)}"></label><p class="helper-text">Use the year in which this term starts. Suggested term names are editable; academic calendars differ worldwide.</p><div class="two-fields"><label>Start date<input name="start" type="date" required value="${esc(start||'')}"></label><label>End date<input name="end" type="date" required value="${esc(end||'')}"></label></div><div data-semester-suggestion></div>`;
}
function readSemesterFields(f){return AcadelyAutomation.semesterName(f.get('term'),Number(f.get('termYear')),f.get('customSemester'));}
function bindSemesterSelector(dialog) {
 const form=dialog.querySelector('form');if(!form?.elements.term)return;
 const update=()=>{
  dialog.querySelector('[data-custom-semester]').hidden=form.elements.term.value!=='Custom';form.elements.customSemester.required=form.elements.term.value==='Custom';
  const hint=AcadelyAutomation.semesterSuggestion(data.studentProfile.university||data.settings.university,data.studentProfile.campus,form.elements.term.value,form.elements.termYear.value);
  const area=dialog.querySelector('[data-semester-suggestion]');
  area.innerHTML=hint?`<p class="helper-text">Suggested dates · Rochester campus · classes through final exams. Review before saving.</p><a class="text-link" href="${hint.source}" target="_blank" rel="noopener">Official calendar ↗</a> <button type="button" class="button button-secondary" data-use-term-dates>Use suggested dates</button><p class="helper-text">Breaks are not automatically excluded.</p>`:'<p class="helper-text">No verified dates for this university, campus and term. Enter dates from your academic calendar.</p>';
  area.querySelector('[data-use-term-dates]')?.addEventListener('click',()=>{form.elements.start.value=hint.start;form.elements.end.value=hint.end;});
  window.AcadelyI18n?.apply(dialog);
 };
 form.elements.term.addEventListener('change',update);form.elements.termYear.addEventListener('input',update);update();
}

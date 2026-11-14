// Pure planning helpers: no account, storage, or DOM dependencies.
(function(root) {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const code = value => normalize(value).replace(/[^\p{L}\p{N}]/gu, '');
  function searchUniversities(rows, query) {
    const q = normalize(query);
    if (!q) return [];
    return rows.filter(row => normalize(row.name).includes(q)).sort((a,b) => Number(normalize(b.name).startsWith(q)) - Number(normalize(a.name).startsWith(q)) || a.name.localeCompare(b.name)).slice(0,20);
  }
  function searchCourses(rows, query) {
    const compact = value => normalize(value).replace(/[\s._/–-]+/g,'');
    const tokens = normalize(query).split(/\s+/).filter(Boolean).map(compact);
    return rows.filter(row => tokens.every(token => [row.code,row.name,row.professor].some(value => compact(value).includes(token))));
  }
  function searchMajors(rows, query, university='') {
    const q=normalize(query);if(!q)return [];
    return rows.filter(row=>[row.name,...(row.aliases||[])].some(value=>normalize(value).includes(q)))
      .sort((a,b)=>Number((b.universityNames||[]).some(n=>normalize(n)===normalize(university)))-Number((a.universityNames||[]).some(n=>normalize(n)===normalize(university)))||Number(normalize(b.name).startsWith(q))-Number(normalize(a.name).startsWith(q))||a.name.localeCompare(b.name)).slice(0,20);
  }
  function classOccurs(item, iso, settings) {
    const day = new Date(`${iso}T12:00:00`).getDay();
    const selected = Array.isArray(item.days) ? item.days : [item.day];
    return selected.includes(days[(day + 6) % 7]) && (!settings.start || iso >= settings.start) && (!settings.end || iso <= settings.end) && !(item.cancelledDates || []).includes(iso);
  }
  function semesterGpa(semester) {
    const max = Number(semester.maxGpa);
    let credits = 0, points = 0;
    for (const course of semester.courses || []) {
      if (course.points === '' || course.points == null) continue;
      const c = Number(course.credits), p = Number(course.points);
      if (!Number.isFinite(c) || c <= 0 || !Number.isFinite(p) || p < 0 || p > max) continue;
      credits += c; points += c * p;
    }
    return { value: credits ? points / credits : null, credits, points };
  }
  function cumulativeGpa(semesters) {
    const completed = semesters.filter(s => s.status === 'completed' && semesterGpa(s).credits > 0);
    const scales = [...new Set(completed.map(s => Number(s.maxGpa)))];
    if (scales.length > 1) return { value:null, reason:'These semesters use different GPA scales. View each semester separately.' };
    const totals = completed.reduce((sum,s) => {const g = semesterGpa(s); return {credits:sum.credits+g.credits,points:sum.points+g.points};}, {credits:0,points:0});
    return {value:totals.credits ? totals.points/totals.credits : null,credits:totals.credits,maxGpa:scales[0] || null};
  }
  function recommend(requirements, semesters, currentCourses, plannedCodes) {
    const passed = new Set(semesters.filter(s=>s.status==='completed').flatMap(s=>(s.courses||[]).filter(c=>c.completed===true).map(c=>code(c.code))));
    const completedRecords = semesters.filter(s=>s.status==='completed').flatMap(s=>(s.courses||[]).filter(c=>c.completed===true).map(c=>({...c,maxGpa:s.maxGpa})));
    const prerequisiteMet = (r,p) => passed.has(code(p)) && (r.minimumPrerequisitePoints==null || r.minimumPrerequisitePoints==='' || completedRecords.some(c=>code(c.code)===code(p) && Number(c.maxGpa)===Number(r.maxGpa) && c.points!=='' && c.points!=null && Number(c.points)>=Number(r.minimumPrerequisitePoints)));
    const inProgress = new Set(currentCourses.map(c=>code(c.code)).filter(Boolean));
    const planned = new Set(plannedCodes.map(code));
    return requirements.filter(r=>r.code && !passed.has(code(r.code)) && !inProgress.has(code(r.code)) && !planned.has(code(r.code)))
      .map(r=>({ ...r, eligible:r.prerequisitesVerified===true && (r.prerequisites||[]).every(p=>prerequisiteMet(r,p)), reason:r.prerequisitesVerified!==true ? 'On your degree list. Confirm prerequisites with your adviser.' : (r.prerequisites||[]).every(p=>prerequisiteMet(r,p)) ? ((r.prerequisites||[]).length ? 'On your degree list; all listed prerequisites and recorded grade minima met.' : 'On your degree list; verified with no prerequisites.') : 'On your degree list; complete the listed prerequisites first.' }));
  }
  root.AcadelyPlanning = {searchUniversities,searchCourses,searchMajors,classOccurs,semesterGpa,cumulativeGpa,recommend,code};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.AcadelyPlanning;
})(typeof globalThis !== 'undefined' ? globalThis : window);

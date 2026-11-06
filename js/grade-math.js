// Pure grading functions shared by the browser app and the automated tests.
(function (root) {
  const EPSILON = 1e-8;

  function validateGradeScale(scale, maxGpa) {
    if (!Array.isArray(scale) || !scale.length || !Number.isFinite(Number(maxGpa)) || Number(maxGpa) <= 0) {
      return { valid: false, reason: 'A grade scale and a positive maximum GPA are required.' };
    }
    const normalized = scale.map((grade) => ({
      letter: String(grade?.letter ?? '').trim().toUpperCase(),
      min: Number(grade?.min),
      gpa: Number(grade?.gpa),
    }));
    if (normalized.some((grade) => !grade.letter || !Number.isFinite(grade.min) || grade.min < 0 || grade.min > 100 || !Number.isFinite(grade.gpa) || grade.gpa < 0 || grade.gpa > Number(maxGpa))) {
      return { valid: false, reason: 'Each grade needs a letter, a 0–100 minimum, and GPA points within the selected scale.' };
    }
    if (new Set(normalized.map((grade) => grade.letter)).size !== normalized.length) {
      return { valid: false, reason: 'Each letter grade must be unique.' };
    }
    if (new Set(normalized.map((grade) => grade.min)).size !== normalized.length) {
      return { valid: false, reason: 'Each percentage boundary must be unique.' };
    }
    if (!normalized.some((grade) => grade.min === 0)) {
      return { valid: false, reason: 'Add a 0% boundary so every possible course grade has a defined result.' };
    }
    const ordered = normalized.slice().sort((a, b) => a.min - b.min);
    if (ordered.some((grade, index) => index && grade.gpa < ordered[index - 1].gpa)) {
      return { valid: false, reason: 'Higher percentage boundaries cannot award fewer GPA points.' };
    }
    const top = ordered[ordered.length - 1];
    if (Math.abs(top.gpa - Number(maxGpa)) > EPSILON) {
      return { valid: false, reason: `The top grade boundary must award the full ${Number(maxGpa).toFixed(2)} GPA points.` };
    }
    return { valid: true, scale: ordered };
  }

  function gradeForPercentage(score, scale, maxGpa) {
    const value = Number(score);
    const validation = validateGradeScale(scale, maxGpa);
    if (!Number.isFinite(value) || value < 0 || value > 100 || !validation.valid) return null;
    const grade = validation.scale.slice().sort((a, b) => b.min - a.min).find((item) => value >= item.min);
    return grade ? { letter: grade.letter, points: grade.gpa } : null;
  }

  function courseProgress(assessments, courseId) {
    if (!Array.isArray(assessments)) return { items: [], total: 0, grade: null, remaining: 100, error: 'invalid-assessments' };
    const all = assessments.filter((item) => item && item.courseId === courseId);
    const invalid = all.some((item) => {
      const score = Number(item.score), max = Number(item.max), weight = Number(item.weight);
      return !Number.isFinite(score) || !Number.isFinite(max) || !Number.isFinite(weight) || max <= 0 || score < 0 || score > max || weight <= 0;
    });
    const items = all.filter((item) => Number.isFinite(Number(item.score)) && Number.isFinite(Number(item.max)) && Number.isFinite(Number(item.weight)) && Number(item.max) > 0 && Number(item.score) >= 0 && Number(item.score) <= Number(item.max) && Number(item.weight) > 0);
    const total = items.reduce((sum, item) => sum + Number(item.weight), 0);
    if (invalid || total > 100 + EPSILON) return { items, total, grade: null, remaining: Math.max(0, 100 - total), error: invalid ? 'invalid-assessments' : 'weight-over-100' };
    const weighted = items.reduce((sum, item) => sum + Number(item.weight) * (Number(item.score) / Number(item.max) * 100), 0);
    return { items, total, grade: total ? weighted / total : null, remaining: Math.max(0, 100 - total), complete: total >= 100 - EPSILON, error: null };
  }

  function calculateGpa(courses, assessments, scale, maxGpa) {
    const scaleResult = validateGradeScale(scale, maxGpa);
    if (!scaleResult.valid) return { value: null, gradedCredits: 0, courseCount: 0, courses: [], estimated: false, error: scaleResult.reason };
    const details = (Array.isArray(courses) ? courses : []).map((course) => {
      const credits = Number(course?.credits);
      const validCredits = Number.isFinite(credits) && credits > 0;
      let percentage = null, completion = 0, error = null;
      if (course?.gradeMode === 'final') {
        if (course.finalGrade !== '' && course.finalGrade != null) {
          percentage = Number(course.finalGrade);
          if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) { percentage = null; error = 'invalid-final-grade'; }
          else completion = 100;
        }
      } else {
        const progress = courseProgress(assessments, course?.id);
        percentage = progress.grade;
        completion = progress.total;
        error = progress.error;
      }
      const mapped = percentage === null || error ? null : gradeForPercentage(percentage, scaleResult.scale, maxGpa);
      return { course, credits, validCredits, percentage, completion, letter: mapped?.letter ?? null, points: mapped?.points ?? null, error };
    });
    const graded = details.filter((item) => item.validCredits && item.points !== null && !item.error);
    const gradedCredits = graded.reduce((sum, item) => sum + item.credits, 0);
    const value = gradedCredits > 0 ? graded.reduce((sum, item) => sum + item.credits * item.points, 0) / gradedCredits : null;
    const estimated = graded.some((item) => item.completion < 100 - EPSILON);
    return { value, gradedCredits, courseCount: graded.length, courses: details, estimated, error: null };
  }

  function requiredAverage(currentAverage, completedWeight, target) {
    const remaining = 100 - completedWeight;
    if (![currentAverage, completedWeight, target].every(Number.isFinite) || currentAverage < 0 || currentAverage > 100 || completedWeight < 0 || completedWeight > 100 || target < 0 || target > 100) return { error: 'invalid-input' };
    if (remaining === 0) return { error: 'no-remaining-weight', current: currentAverage };
    const required = (target * 100 - currentAverage * completedWeight) / remaining;
    const maximum = (currentAverage * completedWeight + remaining * 100) / 100;
    return { required, remaining, maximum, possible: required <= 100 + EPSILON, alreadyAchieved: required <= 0 };
  }

  function projectedGrade(currentAverage, completedWeight, hypothetical) {
    const remaining = 100 - completedWeight;
    if (![currentAverage, completedWeight, hypothetical].every(Number.isFinite) || completedWeight < 0 || completedWeight > 100 || currentAverage < 0 || currentAverage > 100 || hypothetical < 0 || hypothetical > 100) return null;
    return (currentAverage * completedWeight + hypothetical * remaining) / 100;
  }

  root.UniTrackMath = { courseProgress, validateGradeScale, gradeForPercentage, calculateGpa, requiredAverage, projectedGrade };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.UniTrackMath;
})(typeof globalThis !== 'undefined' ? globalThis : window);

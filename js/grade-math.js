// Pure grade calculations shared by the interface and the Node test suite.
(function (root) {
  function courseProgress(assessments, courseId) {
    const items = assessments.filter((item) => item.courseId === courseId && Number(item.max) > 0 && Number(item.weight) > 0);
    const total = items.reduce((sum, item) => sum + Number(item.weight), 0);
    const weighted = items.reduce((sum, item) => sum + Number(item.weight) * (Number(item.score) / Number(item.max) * 100), 0);
    return { items, total, grade: total ? weighted / total : null, remaining: Math.max(0, 100 - total) };
  }

  function requiredAverage(currentAverage, completedWeight, target) {
    const remaining = 100 - completedWeight;
    if (![currentAverage, completedWeight, target].every(Number.isFinite) || currentAverage < 0 || currentAverage > 100 || completedWeight < 0 || completedWeight > 100 || target < 0 || target > 100) {
      return { error: 'invalid-input' };
    }
    if (remaining === 0) return { error: 'no-remaining-weight' };
    const required = (target * 100 - currentAverage * completedWeight) / remaining;
    const maximum = (currentAverage * completedWeight + remaining * 100) / 100;
    return { required, remaining, maximum, possible: required <= 100 };
  }

  function projectedGrade(currentAverage, completedWeight, hypothetical) {
    const remaining = 100 - completedWeight;
    if (![currentAverage, completedWeight, hypothetical].every(Number.isFinite) || completedWeight < 0 || completedWeight > 100 || currentAverage < 0 || currentAverage > 100 || hypothetical < 0 || hypothetical > 100) return null;
    return (currentAverage * completedWeight + hypothetical * remaining) / 100;
  }

  root.UniTrackMath = { courseProgress, requiredAverage, projectedGrade };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.UniTrackMath;
})(typeof globalThis !== 'undefined' ? globalThis : window);

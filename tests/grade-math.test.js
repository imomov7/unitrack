const test = require('node:test');
const assert = require('node:assert/strict');
const math = require('../js/grade-math.js');

test('required average matches the 80 over 40 percent example', () => {
  const result = math.requiredAverage(80, 40, 90);
  assert.equal(result.possible, true);
  assert.ok(Math.abs(result.required - 96.6666666667) < 1e-8);
  assert.equal(result.remaining, 60);
});

test('reports an impossible target and maximum possible final grade', () => {
  const result = math.requiredAverage(40, 80, 90);
  assert.equal(result.possible, false);
  assert.equal(result.maximum, 52);
});

test('supports arbitrary mark maxima and weighted averages', () => {
  const result = math.courseProgress([
    { courseId: 'x', score: 18, max: 20, weight: 25 },
    { courseId: 'x', score: 70, max: 100, weight: 15 },
  ], 'x');
  assert.equal(result.total, 40);
  assert.equal(result.grade, 82.5);
  assert.equal(result.remaining, 60);
});

test('handles a fully weighted course and invalid input', () => {
  assert.equal(math.requiredAverage(80, 100, 90).error, 'no-remaining-weight');
  assert.equal(math.requiredAverage(110, 40, 90).error, 'invalid-input');
  assert.equal(math.projectedGrade(80, 40, 95), 89);
  assert.equal(math.projectedGrade(80, 40, 101), null);
});

const fourPointScale = [
  { letter: 'A', min: 90, gpa: 4 },
  { letter: 'B', min: 80, gpa: 3 },
  { letter: 'C', min: 70, gpa: 2 },
  { letter: 'D', min: 60, gpa: 1 },
  { letter: 'F', min: 0, gpa: 0 },
];

test('calculates credit-weighted GPA and rounds the standard example to 3.43', () => {
  const result = math.calculateGpa([
    { id: 'a', credits: 3, gradeMode: 'final', finalGrade: 95 },
    { id: 'b', credits: 4, gradeMode: 'final', finalGrade: 85 },
  ], [], fourPointScale, 4);
  assert.equal(result.value.toFixed(2), '3.43');
  assert.equal(result.gradedCredits, 7);
});

test('supports a configured 5.0 maximum and returns 5.0 points', () => {
  const scale = [{ letter: 'A', min: 90, gpa: 5 }, { letter: 'B', min: 80, gpa: 4 }, { letter: 'F', min: 0, gpa: 0 }];
  const result = math.calculateGpa([{ id: 'a', credits: 2, gradeMode: 'final', finalGrade: 99 }], [], scale, 5);
  assert.equal(result.value, 5);
});

test('does not count ungraded courses and safely returns no GPA', () => {
  const result = math.calculateGpa([{ id: 'blank', credits: 3 }], [], fourPointScale, 4);
  assert.equal(result.value, null);
  assert.equal(result.gradedCredits, 0);
});

test('uses decimal credits and ignores courses with zero or invalid credits', () => {
  const result = math.calculateGpa([
    { id: 'a', credits: 2.5, gradeMode: 'final', finalGrade: 95 },
    { id: 'b', credits: 3.5, gradeMode: 'final', finalGrade: 85 },
    { id: 'zero', credits: 0, gradeMode: 'final', finalGrade: 99 },
    { id: 'bad', credits: -2, gradeMode: 'final', finalGrade: 99 },
  ], [], fourPointScale, 4);
  assert.equal(result.gradedCredits, 6);
  assert.equal(result.value.toFixed(2), '3.42');
});

test('marks partial assessment grades and the GPA as estimates', () => {
  const result = math.calculateGpa([{ id: 'a', credits: 3 }], [{ courseId: 'a', score: 27, max: 30, weight: 30 }], fourPointScale, 4);
  assert.equal(result.estimated, true);
  assert.equal(result.courses[0].percentage, 90);
  assert.equal(result.courses[0].completion, 30);
});

test('rejects invalid marks, weights, and inconsistent grading boundaries', () => {
  assert.equal(math.courseProgress([{ courseId: 'a', score: 101, max: 100, weight: 30 }], 'a').error, 'invalid-assessments');
  assert.equal(math.courseProgress([{ courseId: 'a', score: 80, max: 100, weight: 60 }, { courseId: 'a', score: 80, max: 100, weight: 50 }], 'a').error, 'weight-over-100');
  assert.equal(math.validateGradeScale([{ letter: 'A', min: 90, gpa: 4 }, { letter: 'F', min: 0, gpa: 0 }], 5).valid, false);
  assert.equal(math.validateGradeScale([{ letter: 'A', min: 90, gpa: 4 }, { letter: 'A', min: 0, gpa: 0 }], 4).valid, false);
});

test('grade boundaries classify below the lowest letter threshold correctly', () => {
  assert.deepEqual(math.gradeForPercentage(40, fourPointScale, 4), { letter: 'F', points: 0 });
});

test('required average handles already achieved targets and impossible targets', () => {
  assert.equal(math.requiredAverage(100, 90, 90).alreadyAchieved, true);
  assert.equal(math.requiredAverage(20, 90, 90).possible, false);
  assert.equal(math.requiredAverage(80, 100, 90).error, 'no-remaining-weight');
});

// Source-contract checks: these do NOT simulate successful physical gameplay.
// They ensure that completion calls remain behind the intended requirements.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'public/js/shared/student-lesson-controller.js'), 'utf8');

function activity(name) {
  const marker = `  function ${name}()`;
  const begin = source.indexOf(marker);
  expect(begin, `${name} must exist`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf('\n  function ', begin + marker.length);
  return source.slice(begin, next < 0 ? source.length : next);
}
function hasCompletion(text) {
  return /window\.HandsOnMouseData\?\.complete\?\.\(\)/.test(text);
}
function assertCountGate(name, count, total) {
  const code = activity(name);
  expect(code).toMatch(new RegExp(`\\b${count}\\s*>=\\s*${total}\\.length`));
  expect(hasCompletion(code), `${name} must signal completion`).toBe(true);
  expect(code.indexOf(`${count} >=`)).toBeLessThan(code.indexOf('window.HandsOnMouseData?.complete?.()'));
}

test('Warm-Up requires all backpack objects before completion', () => {
  assertCountGate('startWeek4WarmUpBehavior', 'packedCount', 'objects');
});
test('Clean Up requires all objects before completion', () => {
  assertCountGate('startWeek4CleanUpBehavior', 'completedCount', 'objects');
});
test('Puzzle requires all pieces before completion', () => {
  assertCountGate('startWeek4PuzzleBehavior', 'completedCount', 'pieces');
});
test('Sort It! has a completion signal gated by progress', () => {
  const code = activity('startWeek4SortBehavior');
  expect(hasCompletion(code)).toBe(true);
  expect(code).toMatch(/completedCount\s*>=|sortedCount\s*>=|completedCount\s*===|sortedCount\s*===/);
});
test('Moving Targets has a completion signal gated by progress', () => {
  const code = activity('startWeek4MovingTargetsBehavior');
  expect(hasCompletion(code)).toBe(true);
  expect(code).toMatch(/completedCount\s*>=|successCount\s*>=|completedCount\s*===|successCount\s*===|roundIndex\s*>=/);
});
test('Quick Activities requires three distinct mini-game completions', () => {
  const code = activity('startWeek4ActivitiesBehavior');
  expect(code).toContain('const completedMiniGames = new Set()');
  for (const id of ['feed-animals', 'build-robot', 'make-pizza']) expect(code).toContain(`"${id}"`);
  expect(code).toContain('completedMiniGames.add(completedId)');
  expect(code).toMatch(/completedMiniGames\.size\s*===\s*3\)\s*window\.HandsOnMouseData\?\.complete\?\.\(\)/);
  expect((code.match(/window\.HandsOnMouseData\?\.complete\?\.\(\)/g) || []).length).toBe(1);
});
test('Drag Master Challenge requires five rounds before completion', () => {
  const code = activity('startWeek4ChallengeBehavior');
  expect(code).toContain('const ROUND_COUNT = 5');
  expect(code).toMatch(/roundIndex\s*>=\s*ROUND_COUNT/);
  expect(code).toContain('finishChallenge()');
  expect(code).toMatch(/function finishChallenge\(\)[\s\S]*?window\.HandsOnMouseData\?\.complete\?\.\(\)/);
});

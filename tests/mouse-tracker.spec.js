const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const tracker = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'shared', 'student-data.js'), 'utf8');

async function setup(page, { delayStart = 0, delayPut = 0 } = {}) {
  const records = [];
  let nextId = 0;
  await page.route('http://mouse-checker.invalid/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/api/mouse-data/attempts/start') {
      if (delayStart) await new Promise(resolve => setTimeout(resolve, delayStart));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tracked: true, attempt: { id: `fake-${++nextId}` } }) });
    }
    if (url.pathname.startsWith('/api/mouse-data/attempts/') && req.method() === 'PUT') {
      const payload = JSON.parse(req.postData());
      if (delayPut) await new Promise(resolve => setTimeout(resolve, delayPut));
      records.push({ id: url.pathname.split('/').pop(), ...payload });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    }
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><div id="studentLessonView"></div></body></html>' });
  });
  await page.addInitScript(() => {
    localStorage.setItem('handsOnMouseStudentDataSession', JSON.stringify({ token:'fake-token', student:{id:'fake-student'}, classroom:{id:'fake-class'} }));
    window.HandsOnMouseTeacherSession = { isTeacherSession: () => false };
  });
  await page.goto('http://mouse-checker.invalid/');
  await page.evaluate(tracker);
  return records;
}

async function start(page, stepId) {
  await page.evaluate(stepId => window.HandsOnMouseData.beginStep({ lessonId:'week4', stepId, stepTitle:stepId, stepType:'practice' }), stepId);
}

test('a wrong action is saved on leaving the activity', async ({ page }) => {
  const records = await setup(page);
  await start(page, 'week4-sort');
  await page.evaluate(() => { window.HandsOnMouseData.wrongEach(); window.HandsOnMouseData.leaveStep(); });
  await expect.poll(() => records.length).toBeGreaterThan(0);
  expect(records.at(-1).wrongActions).toBe(1);
  expect(records.at(-1).status).toBe('incomplete');
});

test('completed activity is saved', async ({ page }) => {
  const records = await setup(page);
  await start(page, 'week4-puzzle');
  await page.evaluate(() => window.HandsOnMouseData.complete());
  await expect.poll(() => records.some(x => x.status === 'completed')).toBe(true);
});

test('completion before start response is preserved', async ({ page }) => {
  const records = await setup(page, { delayStart: 450 });
  await page.evaluate(() => { window.__starting = window.HandsOnMouseData.beginStep({ lessonId:'week4', stepId:'week4-warm-up', stepTitle:'Warm-Up' }); });
  await page.waitForTimeout(80);
  await page.evaluate(() => { window.HandsOnMouseData.wrongEach(); window.HandsOnMouseData.complete(); });
  await page.evaluate(() => window.__starting);
  await page.waitForTimeout(200);
  expect(records.some(x => x.status === 'completed' && x.wrongActions === 1)).toBe(true);
});

test('rapid step transition does not lose first attempt', async ({ page }) => {
  const records = await setup(page, { delayStart: 400 });
  await page.evaluate(() => { window.__first = window.HandsOnMouseData.beginStep({ lessonId:'week4', stepId:'week4-sort', stepTitle:'Sort' }); });
  await page.waitForTimeout(70);
  await page.evaluate(() => window.HandsOnMouseData.wrongEach());
  await page.evaluate(() => { window.__second = window.HandsOnMouseData.beginStep({ lessonId:'week4', stepId:'week4-puzzle', stepTitle:'Puzzle' }); });
  await Promise.all([page.evaluate(() => window.__first), page.evaluate(() => window.__second)]);
  await page.waitForTimeout(150);
  expect(records.some(x => x.wrongActions === 1 && x.status === 'incomplete')).toBe(true);
});

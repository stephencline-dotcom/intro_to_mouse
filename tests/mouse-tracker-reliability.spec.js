const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const tracker = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'shared', 'student-data.js'), 'utf8');

async function harness(page, { slowFirstPut = false } = {}) {
  const writes = [];
  const stored = new Map();
  let id = 0;
  let puts = 0;
  await page.route('http://mouse-checker.invalid/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/mouse-data/attempts/start') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tracked: true, attempt: { id: `phase2-${++id}` } }) });
    }
    if (pathname.startsWith('/api/mouse-data/attempts/') && request.method() === 'PUT') {
      const key = pathname.split('/').pop();
      const data = JSON.parse(request.postData());
      const sequence = ++puts;
      if (slowFirstPut && sequence === 1) await new Promise(resolve => setTimeout(resolve, 400));
      stored.set(key, data);
      writes.push({ key, sequence, ...data });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    }
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><div id="studentLessonView"></div></body></html>' });
  });
  await page.addInitScript(() => {
    localStorage.setItem('handsOnMouseStudentDataSession', JSON.stringify({ token: 'fake-token', student: { id: 'fake-student' }, classroom: { id: 'fake-class' } }));
    window.HandsOnMouseTeacherSession = { isTeacherSession: () => false };
  });
  await page.goto('http://mouse-checker.invalid/');
  await page.evaluate(tracker);
  return { writes, stored };
}

async function begin(page, stepId) {
  await page.evaluate(stepId => window.HandsOnMouseData.beginStep({ lessonId: 'week4', stepId, stepTitle: stepId, stepType: 'practice' }), stepId);
}

test('overlapping writes retain the newest wrong-action total and completed status', async ({ page }) => {
  const { stored, writes } = await harness(page, { slowFirstPut: true });
  await begin(page, 'week4-sort');
  await page.evaluate(() => {
    const tracker = window.HandsOnMouseData;
    tracker.wrongEach();
    window.__firstWrite = tracker.freezeEnded(); // no-op if not frozen
    tracker.complete();
    tracker.wrongEach();
    window.__lastWrite = tracker.leaveStep();
  });
  await page.evaluate(() => window.__lastWrite);
  await expect.poll(() => writes.length).toBeGreaterThanOrEqual(2);
  const final = [...stored.values()][0];
  expect(final.status).toBe('completed');
  expect(final.wrongActions).toBe(2);
});

test('frozen interval increments freeze statistics and does not inflate active time', async ({ page }) => {
  const { stored } = await harness(page);
  await begin(page, 'week4-puzzle');
  await page.evaluate(() => window.HandsOnMouseData.freezeStarted());
  await page.waitForTimeout(320);
  await page.evaluate(() => window.HandsOnMouseData.freezeEnded());
  await page.evaluate(() => window.HandsOnMouseData.leaveStep());
  await expect.poll(() => stored.size).toBe(1);
  const final = [...stored.values()][0];
  expect(final.freezeCount).toBe(1);
  expect(final.frozenMs).toBeGreaterThanOrEqual(220);
  expect(final.activeMs).toBeLessThan(250);
});

test('separate activity attempts keep their own wrong counts and statuses', async ({ page }) => {
  const { stored } = await harness(page);
  await begin(page, 'week4-sort');
  await page.evaluate(() => window.HandsOnMouseData.wrongEach(3));
  await begin(page, 'week4-puzzle');
  await page.evaluate(() => { window.HandsOnMouseData.wrongEach(); window.HandsOnMouseData.complete(); });
  await page.evaluate(() => window.HandsOnMouseData.leaveStep());
  await expect.poll(() => stored.size).toBe(2);
  const first = stored.get('phase2-1');
  const second = stored.get('phase2-2');
  expect(first.status).toBe('incomplete');
  expect(first.wrongActions).toBe(3);
  expect(second.status).toBe('completed');
  expect(second.wrongActions).toBe(1);
});

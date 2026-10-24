const { test, expect } = require('@playwright/test');

const state = {
  freezeScreenArmed: false, freezeCycle: 0, freezeUnlockVersion: 0,
  trainingPaused: false, currentLessonStep: 0, lessonControlMode: 'student',
  activeLesson: 'week4', reviewMovementReleased: false,
  reviewActivitiesReleased: false, fingerHighlight: null
};

async function setup(page) {
  const attempts = new Map();
  let serial = 0;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const json = data => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(data)});
    if (pathname === '/api/classroom-state') return json(state);
    if (pathname === '/api/settings') return json({soundEnabled:false, freezeScreenFeatureEnabled:false, trainingPauseEnabled:false, mousePracticeEnabled:true});
    if (pathname === '/api/mouse-data/join') return json({token:'fake-token', student:{id:'fake-student',name:'Automated Student'}, classroom:{id:'fake-class',name:'Automated Class',code:'TEST01'}});
    if (pathname === '/api/mouse-data/attempts/start') {
      const meta = request.postDataJSON();
      const id = `mock-${++serial}`;
      attempts.set(id, {id, ...meta, status:'started', wrongActions:0, correctActions:0});
      return json({tracked:true, attempt:{id,attempt_number:1}});
    }
    const match = pathname.match(/^\/api\/mouse-data\/attempts\/(mock-\d+)$/);
    if (match && request.method() === 'PUT') {
      const current = attempts.get(match[1]);
      if (!current) return route.fulfill({status:404,contentType:'application/json',body:'{"error":"Missing mock attempt"}'});
      Object.assign(current, request.postDataJSON());
      return json({success:true});
    }
    // Any unexpected API request must not reach real Supabase or classroom state.
    return route.fulfill({status:200, contentType:'application/json', body:'{}'});
  });
  await page.goto('/?student-signin=1');
  await expect(page.locator('#mouseStudentSignIn')).toBeVisible({timeout:15000});
  await page.locator('[name="classCode"]').fill('TEST01');
  await page.locator('[name="studentName"]').fill('Automated Student');
  await page.locator('#mouseStudentSignIn button[type="submit"]').click();
  await expect(page.locator('#mouseStudentSignIn')).toHaveCount(0);
  return attempts;
}

async function findStep(page, target) {
  await expect(page.locator('#studentNextButton')).toBeVisible({timeout:15000});
  for (let i = 0; i < 25; i++) {
    if (await page.locator(target).count()) return;
    const next = page.locator('#studentNextButton');
    if (await next.isDisabled()) break;
    await next.click();
  }
  throw new Error(`Could not reach ${target} through student Next navigation`);
}

async function incorrectDrag(page, selector) {
  const obj = page.locator(selector).first();
  await expect(obj).toBeVisible();
  const box = await obj.boundingBox();
  if (!box) throw new Error(`No bounding box for ${selector}`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x+75,y+35,{steps:12});
  await page.mouse.up();
}


// Real browser completion tests. Never call HandsOnMouseData.complete() directly.
// The browser uses the existing local server and intercepts every /api request.
async function center(locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('Element has no visible bounding box');
  return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};
}
async function dragTo(page, from, to) {
  const start = await center(from), end = await center(to);
  await page.mouse.move(start.x,start.y);
  await page.mouse.down();
  await page.mouse.move(end.x,end.y,{steps:25});
  await page.mouse.up();
}
async function assertSavedCompleted(page, attempts, stepId) {
  await expect.poll(() => [...attempts.values()].some(
    a => a.stepId === stepId && a.status === 'completed'
  ), {timeout:12000}).toBe(true);
}

test('Warm-Up: packing all three items saves completed', async ({page}) => {
  const attempts = await setup(page);
  await findStep(page,'#week4BackpackArea');
  const items = page.locator('.week4-backpack-object');
  await expect(items).toHaveCount(3);
  for (let i=0;i<3;i++) {
    await dragTo(page,items.nth(i),page.locator('#week4Backpack'));
    await expect(items.nth(i)).toHaveClass(/week4-backpack-object-packed/);
  }
  await expect(page.locator('#week4Backpack')).toHaveClass(/week4-backpack-complete/);
  await assertSavedCompleted(page,attempts,'week4-warm-up');
});

test('Clean Up: all matching objects save completed', async ({page}) => {
  const attempts = await setup(page);
  await findStep(page,'#week4CleanUpArea');
  const items = page.locator('.week4-clean-object');
  const total = await items.count();
  expect(total).toBeGreaterThan(0);
  for (let i=0;i<total;i++) {
    const item=items.nth(i);
    const match=await item.getAttribute('data-match');
    const target=page.locator(`.week4-clean-destination[data-match="${match}"]`);
    await expect(target).toHaveCount(1);
    await dragTo(page,item,target);
    await expect(item).toHaveClass(/week4-clean-object-complete/);
  }
  await expect(page.locator('#week4CleanUpArea')).toHaveClass(/week4-clean-area-complete/);
  await assertSavedCompleted(page,attempts,'week4-clean-up');
});

test('Puzzle: placing every matching piece saves completed', async ({page}) => {
  const attempts = await setup(page);
  await findStep(page,'#week4PuzzleArea');
  const pieces=page.locator('.week4-puzzle-piece');
  const total=await pieces.count();
  expect(total).toBeGreaterThan(0);
  for(let i=0;i<total;i++) {
    const piece=pieces.nth(i);
    const match=await piece.getAttribute('data-match');
    const slot=page.locator(`.week4-puzzle-slot[data-match="${match}"]`);
    await expect(slot).toHaveCount(1);
    await dragTo(page,piece,slot);
    await expect(piece).toHaveClass(/week4-puzzle-piece-complete/);
  }
  await expect(page.locator('#week4PuzzleArea')).toHaveClass(/week4-puzzle-complete/);
  await assertSavedCompleted(page,attempts,'week4-puzzle');
});

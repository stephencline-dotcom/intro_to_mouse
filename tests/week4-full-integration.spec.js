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

for (const item of [
  {name:'Sort It!', target:'#week4SortArea', object:'.week4-sort-object', step:'week4-sort'},
  {name:'Moving Targets', target:'#week4MovingArea', object:'#week4MovingObject', step:'week4-moving-targets'}
]) {
  test(`${item.name}: real website incorrect drag reaches saved attempt`, async ({page}) => {
    const attempts = await setup(page);
    await findStep(page,item.target);
    await expect.poll(() => [...attempts.values()].some(x => x.stepId === item.step), {timeout:10000}).toBe(true);
    await incorrectDrag(page,item.object);
    // Move to another step to force a final save of this attempt.
    await page.locator('#studentNextButton').click();
    await expect.poll(() => [...attempts.values()].some(x => x.stepId === item.step && x.wrongActions === 1), {timeout:10000}).toBe(true);
    const result = [...attempts.values()].find(x => x.stepId === item.step);
    expect(result.status).toBe('incomplete');
  });
}

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


// All interactions below use the actual student page and physical Playwright mouse input.
// Do not call HandsOnMouseData.complete() or game-internal completion functions.
async function assertNotCompleted(attempts, step) {
  expect([...attempts.values()].some(a=>a.stepId===step && a.status==='completed')).toBe(false);
}
async function selectMiniGame(page, id, area) {
  await page.locator(`[data-week4-activity="${id}"]`).click();
  await expect(page.locator(area)).toBeVisible();
  await page.waitForTimeout(120);
}
async function returnToHub(page) {
  await expect(page.locator('#week4ActivityCompleteOverlay')).toBeVisible({timeout:12000});
  await page.locator('#week4ActivityBackButton').click();
  await expect(page.locator('#week4ActivitiesHub')).toBeVisible();
}

test('Quick Activities: three different finished games are required to save completed', async ({page}) => {
  const attempts=await setup(page);
  await findStep(page,'#week4ActivitiesHub');
  await selectMiniGame(page,'feed-animals','#week4FeedAnimalsArea');
  const foods=page.locator('.week4-feed-food');
  await expect(foods).toHaveCount(5);
  for (let i=0;i<5;i++) {
    const food=foods.nth(i);
    const name=await food.getAttribute('data-for-animal');
    await dragTo(page,food,page.locator(`.week4-feed-animal[data-animal="${name}"]`));
    await expect(food).toHaveClass(/week4-feed-food-complete/);
  }
  await returnToHub(page);
  await assertNotCompleted(attempts,'week4-activities');

  await selectMiniGame(page,'build-robot','#week4RobotArea');
  const parts=page.locator('.week4-robot-part');
  await expect(parts).toHaveCount(5);
  for (let i=0;i<5;i++) {
    const part=parts.nth(i);
    const name=await part.getAttribute('data-match');
    await dragTo(page,part,page.locator(`.week4-robot-slot[data-match="${name}"]`));
    await expect(page.locator('#week4RobotProgress')).toContainText(`${i+1} of 5`);
  }
  await returnToHub(page);
  await assertNotCompleted(attempts,'week4-activities');

  await selectMiniGame(page,'make-pizza','#week4PizzaArea');
  const choices=page.locator('.week4-pizza-topping-choice');
  await expect(choices).toHaveCount(4);
  for (let i=0;i<10;i++) {
    await dragTo(page,choices.nth(i%4),page.locator('#week4Pizza'));
    await expect(page.locator('#week4PizzaProgress')).toContainText(`${i+1} of 10`);
  }
  await expect(page.locator('#week4ActivityCompleteOverlay')).toBeVisible({timeout:15000});
  await assertSavedCompleted(page,attempts,'week4-activities');
});

// Stage-aware challenge test. A failure identifies the round that did not advance.
async function dragChallenge(page, objectSelector, targetSelector, via=[]) {
  const object=page.locator(objectSelector);
  const start=await center(object);
  await page.mouse.move(start.x,start.y);
  await page.mouse.down();
  for (const selector of via) {
    const waypoint=await center(page.locator(selector));
    await page.mouse.move(waypoint.x,waypoint.y,{steps:12});
  }
  const target=await center(page.locator(targetSelector));
  await page.mouse.move(target.x,target.y,{steps:20});
  await page.mouse.up();
}
async function expectRound(page, round) {
  await expect(page.locator('#week4ChallengeRoundLabel')).toContainText(`Round ${round}`,{timeout:12000});
}
test('Drag Master Challenge: all five rounds must save completed', async ({page}) => {
  const attempts=await setup(page);
  await findStep(page,'#week4ChallengeArea');
  await expectRound(page,1);
  await dragChallenge(page,'[data-master-object="fish"]','[data-master-target="water"]');
  await expectRound(page,2);
  await assertNotCompleted(attempts,'week4-challenge');
  await dragChallenge(page,'[data-master-object="bird"]','[data-master-target="nest"]');
  await expectRound(page,3);
  await assertNotCompleted(attempts,'week4-challenge');
  // Inspect the actual browser geometry before attempting Round 3.
  const geometry = await page.evaluate(() => {
    const selectors = [
      '#week4ChallengeStage',
      '[data-master-object="star"]',
      '.week4-master-obstacle.obstacle-a',
      '.week4-master-obstacle.obstacle-b',
      '.week4-master-obstacle.obstacle-c',
      '[data-master-target="finish"]'
    ];

    return selectors.map(selector => {
      const element = document.querySelector(selector);
      if (!element) return { selector, missing: true };

      const rect = element.getBoundingClientRect();

      return {
        selector,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    });
  });

  console.log('ROUND 3 GEOMETRY:', JSON.stringify(geometry, null, 2));

  // The obstacle course is traversed above the obstacles before dropping at finish.
  // Navigate Round 3 through the actual obstacle gaps.
  const route = await page.evaluate(() => {
    const rect = selector =>
      document.querySelector(selector).getBoundingClientRect();

    const stage = rect('#week4ChallengeStage');
    const star = rect('[data-master-object="star"]');
    const a = rect('.week4-master-obstacle.obstacle-a');
    const b = rect('.week4-master-obstacle.obstacle-b');
    const c = rect('.week4-master-obstacle.obstacle-c');
    const finish = rect('[data-master-target="finish"]');

    const radius = star.height / 2;
    const margin = 8;

    const low = Math.min(
      stage.bottom - radius - margin,
      Math.max(a.bottom, c.bottom) + radius + margin
    );

    const high = Math.max(
      stage.top + radius + margin,
      b.top - radius - margin
    );

    return [
      {x: star.left + star.width/2, y: star.top + star.height/2},
      {x: a.left - radius - margin, y: low},
      {x: a.right + radius + margin, y: low},
      {x: b.left - radius - margin, y: high},
      {x: b.right + radius + margin, y: high},
      {x: c.left - radius - margin, y: low},
      {x: c.right + radius + margin, y: low},
      {x: finish.left + finish.width/2,
       y: finish.top + finish.height/2}
    ];
  });

  await page.mouse.move(route[0].x,route[0].y);
  await page.mouse.down();

  for (const point of route.slice(1)) {
    await page.mouse.move(point.x,point.y,{steps:20});
  }

  await page.mouse.up();
  await expectRound(page,4);
  await assertNotCompleted(attempts,'week4-challenge');
  // Follow the winding road using the actual five rendered road segments.
  await dragChallenge(page,'[data-master-object="firetruck"]','[data-master-target="fire"]',
    ['.week4-fire-road-segment.road-one','.week4-fire-road-segment.road-two',
     '.week4-fire-road-segment.road-three','.week4-fire-road-segment.road-four',
     '.week4-fire-road-segment.road-five']);
  await expectRound(page,5);
  await assertNotCompleted(attempts,'week4-challenge');
  // The final target moves. Follow its live bounding box until the object is inside.
  const lightning=page.locator('[data-master-object="lightning"]');
  const moving=page.locator('[data-master-target="moving"]');
  const start=await center(lightning);
  await page.mouse.move(start.x,start.y);
  await page.mouse.down();
  for(let i=0;i<150;i++) {
    const target=await center(moving);
    await page.mouse.move(target.x,target.y,{steps:2});
    const aligned=await page.evaluate(()=>{
      const a=document.querySelector('[data-master-object="lightning"]')?.getBoundingClientRect();
      const b=document.querySelector('[data-master-target="moving"]')?.getBoundingClientRect();
      if(!a||!b)return false;
      const x=a.left+a.width/2,y=a.top+a.height/2;
      return x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;
    });
    if(aligned) break;
  }
  await page.mouse.up();
  await expect(page.locator('#week4ChallengeArea')).toHaveClass(/week4-challenge-complete/,{timeout:12000});
  await assertSavedCompleted(page,attempts,'week4-challenge');
});



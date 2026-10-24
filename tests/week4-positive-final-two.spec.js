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


async function center(locator) {
  const b=await locator.boundingBox();
  if (!b) throw new Error('Missing visible element');
  return {x:b.x+b.width/2,y:b.y+b.height/2};
}
async function dragTo(page,from,to) {
  const a=await center(from),b=await center(to);
  await page.mouse.move(a.x,a.y);
  await page.mouse.down();
  await page.mouse.move(b.x,b.y,{steps:30});
  await page.mouse.up();
}
async function saved(page, attempts, step) {
  await expect.poll(()=>[...attempts.values()].some(a=>a.stepId===step && a.status==='completed'),{timeout:15000}).toBe(true);
}

test('Sort It!: all six correct drops save completed', async ({page})=>{
  const attempts=await setup(page);
  await findStep(page,'#week4SortArea');
  const items=page.locator('.week4-sort-object');
  await expect(items).toHaveCount(6);
  for(let i=0;i<6;i++){
    const item=items.nth(i);
    const category=await item.getAttribute('data-category');
    const bin=page.locator(`.week4-sort-bin[data-category="${category}"]`);
    await expect(bin).toHaveCount(1);
    await dragTo(page,item,bin);
    await expect(item).toHaveClass(/week4-sort-object-complete/);
  }
  await expect(page.locator('#week4SortArea')).toHaveClass(/week4-sort-complete/);
  await saved(page,attempts,'week4-sort');
});

test('Moving Targets: five successful drops save completed', async ({page})=>{
  const attempts=await setup(page);
  await findStep(page,'#week4MovingArea');
  const obj=page.locator('#week4MovingObject');
  const target=page.locator('#week4MovingDestination');
  for(let round=1;round<=5;round++){
    await expect(page.locator('#week4MovingProgress')).toContainText(`${round} of 5`,{timeout:15000});
    let advanced = false;

    for (let attempt = 0; attempt < 5 && !advanced; attempt++) {
      const start = await center(obj);

      await page.mouse.move(start.x, start.y);
      await page.mouse.down();

      for (let follow = 0; follow < 120; follow++) {
        const destination = await center(target);

        await page.mouse.move(
          destination.x,
          destination.y,
          { steps: 2 }
        );

        const ready = await page.locator('#week4MovingObject')
          .evaluate(el => {
            const a = el.getBoundingClientRect();
            const b = document
              .getElementById('week4MovingDestination')
              .getBoundingClientRect();

            const x = a.left + a.width / 2;
            const y = a.top + a.height / 2;

            return (
              x >= b.left &&
              x <= b.right &&
              y >= b.top &&
              y <= b.bottom
            );
          });

        if (ready) break;
      }

      await page.mouse.up();

      if (round === 5) {
        advanced = await page.locator('#week4MovingArea')
          .evaluate(el => el.classList.contains('week4-moving-complete'));

        if (!advanced) {
          await page.waitForTimeout(800);
          advanced = await page.locator('#week4MovingArea')
            .evaluate(el => el.classList.contains('week4-moving-complete'));
        }
      } else {
        await page.waitForTimeout(800);
        advanced = (await page.locator('#week4MovingProgress')
          .innerText()).includes(`${round + 1} of 5`);
      }
    }

    expect(advanced, `Moving Targets round ${round} did not advance`).toBe(true);

    if(round<5){
      await expect(page.locator('#week4MovingProgress')).toContainText(`${round+1} of 5`,{timeout:15000});
    }
  }
  await expect(page.locator('#week4MovingArea')).toHaveClass(/week4-moving-complete/);
  await saved(page,attempts,'week4-moving-targets');
});


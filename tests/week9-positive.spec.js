const { test, expect } = require('@playwright/test');

async function setup(page) {
  const attempts = new Map();
  let serial = 0;

  await page.route('**/api/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;

    const json = data => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data)
    });

    if (path === '/api/classroom-state') {
      return json({
        freezeScreenArmed: false,
        freezeCycle: 0,
        freezeUnlockVersion: 0,
        trainingPaused: false,
        currentLessonStep: 0,
        lessonControlMode: 'student',
        activeLesson: 'week9',
        reviewMovementReleased: false,
        reviewActivitiesReleased: false,
        fingerHighlight: null
      });
    }

    if (path === '/api/settings') {
      return json({
        soundEnabled: false,
        freezeScreenFeatureEnabled: false,
        trainingPauseEnabled: false,
        mousePracticeEnabled: true
      });
    }

    if (path === '/api/mouse-data/join') {
      return json({
        token: 'fake-token',
        student: {
          id: 'fake-student',
          name: 'Automated Student'
        },
        classroom: {
          id: 'fake-class',
          name: 'Automated Class',
          code: 'TEST01'
        }
      });
    }

    if (path === '/api/mouse-data/attempts/start') {
      const id = `mock-${++serial}`;

      attempts.set(id, {
        id,
        ...req.postDataJSON(),
        status: 'started',
        wrongActions: 0
      });

      return json({
        tracked: true,
        attempt: { id, attempt_number: 1 }
      });
    }

    const match = path.match(
      /^\/api\/mouse-data\/attempts\/(mock-\d+)$/
    );

    if (match && req.method() === 'PUT') {
      const attempt = attempts.get(match[1]);

      if (!attempt) {
        return route.fulfill({
          status: 404,
          body: '{}'
        });
      }

      Object.assign(attempt, req.postDataJSON());
      return json({ success: true });
    }

    return json({});
  });

  await page.goto('/?student-signin=1');

  await expect(
    page.locator('#mouseStudentSignIn')
  ).toBeVisible({ timeout: 15000 });

  await page.locator('[name="classCode"]').fill('TEST01');
  await page.locator('[name="studentName"]').fill('Automated Student');

  await page.locator(
    '#mouseStudentSignIn button[type="submit"]'
  ).click();

  await expect(
    page.locator('#mouseStudentSignIn')
  ).toHaveCount(0);

  return attempts;
}

async function reach(page, attempts, id) {
  await expect(
    page.locator('#studentNextButton')
  ).toBeVisible({ timeout: 15000 });

  for (let n = 0; n < 45; n++) {
    if ([...attempts.values()].some(a => a.stepId === id)) {
      return;
    }

    const next = page.locator('#studentNextButton');

    if (await next.isDisabled()) break;

    await next.click();
    await page.waitForTimeout(80);
  }

  throw Error('Could not reach ' + id);
}

async function physicalClick(page, locator, button = 'left') {
  await expect(locator).toBeVisible({ timeout: 12000 });

  for (let attempt = 0; attempt < 40; attempt++) {
    const info = await locator.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);

      return {
        x,
        y,
        hittable: hit === el || el.contains(hit),
        hit: hit?.outerHTML?.slice(0, 180) || 'none'
      };
    });

    if (info.hittable) {
      // Confirm the target remains hittable after animation settles.
      await page.waitForTimeout(120);

      const stable = await locator.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);

        return {
          x,
          y,
          hittable: hit === el || el.contains(hit)
        };
      });

      if (stable.hittable &&
          Math.abs(stable.x - info.x) < 2 &&
          Math.abs(stable.y - info.y) < 2) {
        console.log(
          'STABLE PHYSICAL',
          button,
          stable.x,
          stable.y
        );

        await page.mouse.move(stable.x, stable.y);
        await page.mouse.click(stable.x, stable.y, { button });
        return;
      }
    }

    await page.waitForTimeout(100);
  }

  throw Error('Physical target never became stable and hittable');
}
test(
  'week9-meet-right-click: real right click and choice save completed',
  async ({ page }) => {
    const id = 'week9-meet-right-click';
    const attempts = await setup(page);

    await reach(page, attempts, id);

    const records = () =>
      [...attempts.values()].filter(a => a.stepId === id);

    const completed = () =>
      records().some(a => a.status === 'completed');

    const object = page.locator('#week9RightObject');
    const menu = page.locator('#week9RightMenu');
    const complete = page.locator('#week9RightComplete');

    await expect(object).toBeVisible();
    expect(completed()).toBe(false);
    await expect(complete).toBeHidden();

    console.log('RIGHT CLICK MYSTERY BOX');

    await physicalClick(page, object, 'right');

    await expect(menu).toBeVisible();

    // Opening the menu must not finish the activity.
    expect(completed()).toBe(false);
    await expect(complete).toBeHidden();

    console.log('LEFT CLICK STAR CHOICE');

    await physicalClick(
      page,
      page.locator('[data-week9-right-choice="star"]'),
      'left'
    );

    await expect(complete).toBeVisible({
      timeout: 12000
    });

    const next = page.locator('#studentNextButton');

    if (await next.isDisabled()) {
      await page.locator('#studentBackButton').click();
    } else {
      await next.click();
    }

    await expect.poll(
      () => completed(),
      { timeout: 12000 }
    ).toBe(true);

    const record = records().find(a => a.status === 'completed');

    expect(record).toBeTruthy();
    expect(record.wrongActions).toBe(0);

    console.log('SAVED COMPLETED ATTEMPT', record);
  }
);

test(
  'week9-dress-character: all four clothing choices save completed',
  async ({ page }) => {
    const id = 'week9-dress-character';
    const attempts = await setup(page);

    await reach(page, attempts, id);

    const records = () =>
      [...attempts.values()].filter(a => a.stepId === id);

    const completed = () =>
      records().some(a => a.status === 'completed');

    const character = page.locator('#week9DressCharacter');
    const menu = page.locator('#week9DressMenu');
    const complete = page.locator('#week9DressComplete');

    const choices = ['shirt', 'hat', 'shoes', 'glasses'];

    await expect(character).toBeVisible();
    await expect(complete).toBeHidden();
    expect(completed()).toBe(false);

    for (let i = 0; i < choices.length; i++) {
      const item = choices[i];

      console.log('DRESS ROUND', i + 1, item);

      await physicalClick(page, character, 'right');
      await expect(menu).toBeVisible();

      expect(completed()).toBe(false);

      const choice = page.locator(
        `[data-week9-dress-choice="${item}"]`
      );

      await physicalClick(page, choice, 'left');

      await expect(
        page.locator(
          `[data-week9-dress-star="${item}"]`
        )
      ).toHaveClass(/week9-dress-star-complete/);

      if (i < choices.length - 1) {
        expect(completed()).toBe(false);
        await expect(complete).toBeHidden();
      }
    }

    await expect(complete).toBeVisible({
      timeout: 12000
    });

    const next = page.locator('#studentNextButton');

    if (await next.isDisabled()) {
      await page.locator('#studentBackButton').click();
    } else {
      await next.click();
    }

    await expect.poll(
      () => completed(),
      { timeout: 12000 }
    ).toBe(true);

    const record = records().find(a => a.status === 'completed');

    expect(record).toBeTruthy();
    expect(record.wrongActions).toBe(0);

    console.log('DRESS SAVED', record);
  }
);

test(
  'week9-pet-care: all four care actions save completed',
  async ({ page }) => {
    const id = 'week9-pet-care';
    const attempts = await setup(page);

    await reach(page, attempts, id);

    const records = () =>
      [...attempts.values()].filter(a => a.stepId === id);

    const completed = () =>
      records().some(a => a.status === 'completed');

    const pet = page.locator('#week9PetAnimal');
    const menu = page.locator('#week9PetMenu');
    const complete = page.locator('#week9PetComplete');

    const choices = ['food', 'brush', 'ball', 'bath'];

    await expect(pet).toBeVisible();
    await expect(complete).toBeHidden();
    expect(completed()).toBe(false);

    for (let i = 0; i < choices.length; i++) {
      const item = choices[i];

      console.log('PET ROUND', i + 1, item);

      await physicalClick(page, pet, 'right');
      await expect(menu).toBeVisible();

      expect(completed()).toBe(false);

      const choice = page.locator(
        `[data-week9-pet-choice="${item}"]`
      );

      await physicalClick(page, choice, 'left');

      await expect(
        page.locator(
          `[data-week9-pet-goal="${item}"]`
        )
      ).toHaveClass(/week9-pet-goal-complete/);

      if (i < choices.length - 1) {
        expect(completed()).toBe(false);
        await expect(complete).toBeHidden();
      }
    }

    await expect(complete).toBeVisible({
      timeout: 12000
    });

    const next = page.locator('#studentNextButton');

    if (await next.isDisabled()) {
      await page.locator('#studentBackButton').click();
    } else {
      await next.click();
    }

    await expect.poll(
      () => completed(),
      { timeout: 12000 }
    ).toBe(true);

    const record = records().find(a => a.status === 'completed');

    expect(record).toBeTruthy();
    expect(record.wrongActions).toBe(0);

    console.log('PET SAVED', record);
  }
);


async function leaveCompletedActivity(page) {
  const next = page.locator('#studentNextButton');

  if (await next.isDisabled()) {
    await page.locator('#studentBackButton').click();
  } else {
    await next.click();
  }
}

async function verifyCompletedAttempt(attempts, id) {
  const records = () =>
    [...attempts.values()].filter(a => a.stepId === id);

  await expect.poll(
    () => records().some(a => a.status === 'completed'),
    { timeout: 12000 }
  ).toBe(true);

  const record = records().find(a => a.status === 'completed');

  expect(record).toBeTruthy();
  expect(record.wrongActions).toBe(0);

  console.log('SAVED COMPLETED', id, record);
}

test(
  'week9-robot-repair: all parts repaired with correct tools',
  async ({ page }) => {
    const id = 'week9-robot-repair';
    const attempts = await setup(page);

    await reach(page, attempts, id);

    const completed = () =>
      [...attempts.values()].some(
        a => a.stepId === id && a.status === 'completed'
      );

    const parts = page.locator('[data-week9-robot-part]');
    const count = await parts.count();
    const complete = page.locator('#week9RobotComplete');

    expect(count).toBeGreaterThan(0);
    expect(completed()).toBe(false);
    await expect(complete).toBeHidden();

    for (let round = 0; round < count; round++) {
      const active = page.locator(
        '[data-week9-robot-part].week9-robot-part-active'
      );

      await expect(active).toHaveCount(1, {
        timeout: 12000
      });

      const partName = await active.getAttribute(
        'data-week9-robot-part'
      );

      const tool = await active.getAttribute(
        'data-week9-robot-tool'
      );

      expect(tool).toBeTruthy();

      console.log('ROBOT ROUND', round + 1, partName, tool);

      await physicalClick(page, active, 'right');

      await expect(
        page.locator('#week9RobotMenu')
      ).toBeVisible();

      expect(completed()).toBe(false);

      const choice = page.locator(
        `[data-week9-robot-choice="${tool}"]`
      );

      await physicalClick(page, choice, 'left');

      await expect(
        page.locator(
          `[data-week9-robot-part="${partName}"]`
        )
      ).toHaveClass(/week9-robot-part-repaired/);

      if (round < count - 1) {
        expect(completed()).toBe(false);
        await expect(complete).toBeHidden();
      }
    }

    await expect(complete).toBeVisible({
      timeout: 15000
    });

    await leaveCompletedActivity(page);
    await verifyCompletedAttempt(attempts, id);
  }
);

test(
  'week9-treasure-map: all clues found with correct actions',
  async ({ page }) => {
    const id = 'week9-treasure-map';
    const attempts = await setup(page);

    await reach(page, attempts, id);

    const completed = () =>
      [...attempts.values()].some(
        a => a.stepId === id && a.status === 'completed'
      );

    const spots = page.locator('[data-week9-treasure-spot]');
    const count = await spots.count();
    const complete = page.locator('#week9TreasureComplete');

    expect(count).toBeGreaterThan(0);
    expect(completed()).toBe(false);
    await expect(complete).toBeHidden();

    for (let round = 0; round < count; round++) {
      const active = page.locator(
        '[data-week9-treasure-spot].week9-treasure-spot-active'
      );

      await expect(active).toHaveCount(1, {
        timeout: 12000
      });

      const spotName = await active.getAttribute(
        'data-week9-treasure-spot'
      );

      const action = await active.getAttribute(
        'data-week9-treasure-action'
      );

      expect(action).toBeTruthy();

      console.log(
        'TREASURE ROUND',
        round + 1,
        spotName,
        action
      );

      await physicalClick(page, active, 'right');

      await expect(
        page.locator('#week9TreasureMenu')
      ).toBeVisible();

      expect(completed()).toBe(false);

      const choice = page.locator(
        `[data-week9-treasure-choice="${action}"]`
      );

      await physicalClick(page, choice, 'left');

      await expect(
        page.locator(
          `[data-week9-treasure-spot="${spotName}"]`
        )
      ).toHaveClass(/week9-treasure-spot-found/);

      if (round < count - 1) {
        expect(completed()).toBe(false);
        await expect(complete).toBeHidden();
      }
    }

    await expect(complete).toBeVisible({
      timeout: 15000
    });

    await leaveCompletedActivity(page);
    await verifyCompletedAttempt(attempts, id);
  }
);

test(
  'week9-silly-scene: four distinct changes save completed',
  async ({ page }) => {
    const id = 'week9-silly-scene';
    const attempts = await setup(page);

    await reach(page, attempts, id);

    const completed = () =>
      [...attempts.values()].some(
        a => a.stepId === id && a.status === 'completed'
      );

    const changes = [
      { target: 'sky', choice: 'night' },
      { target: 'ground', choice: 'flowers' },
      { target: 'tree', choice: 'apples' },
      { target: 'character', choice: 'cowboy' }
    ];

    const tray = page.locator('#week9SillyTray');
    const complete = page.locator('#week9SillyComplete');

    expect(completed()).toBe(false);
    await expect(complete).toBeHidden();

    for (let i = 0; i < changes.length; i++) {
      const { target, choice } = changes[i];

      console.log('SILLY ROUND', i + 1, target, choice);

      const zone = page.locator(
        `[data-week9-silly-target="${target}"]`
      );

      await physicalClickClearPoint(page, zone, 'right');

      await expect(tray).toBeVisible();

      expect(completed()).toBe(false);

      const option = page.locator(
        `[data-week9-silly-choice="${choice}"]`
      );

      await physicalClick(page, option, 'left');

      await expect(tray).toBeHidden();

      if (i < changes.length - 1) {
        expect(completed()).toBe(false);
        await expect(complete).toBeHidden();
      }
    }

    // The celebration is temporary. Completion tracking persists.
    await expect.poll(
      () => completed(),
      { timeout: 12000 }
    ).toBe(true);

    await leaveCompletedActivity(page);
    await verifyCompletedAttempt(attempts, id);
  }
);


async function physicalClickClearPoint(page, locator, button = 'right') {
  await expect(locator).toBeVisible({ timeout: 12000 });

  for (let attempt = 0; attempt < 40; attempt++) {
    const result = await locator.evaluate(el => {
      const rect = el.getBoundingClientRect();

      const fractions = [
        [0.5, 0.5],
        [0.2, 0.2],
        [0.8, 0.2],
        [0.2, 0.8],
        [0.8, 0.8],
        [0.1, 0.5],
        [0.9, 0.5],
        [0.5, 0.1],
        [0.5, 0.9]
      ];

      for (const [fx, fy] of fractions) {
        const x = rect.left + rect.width * fx;
        const y = rect.top + rect.height * fy;

        const hit = document.elementFromPoint(x, y);

        if (hit === el || el.contains(hit)) {
          return { x, y, found: true };
        }
      }

      return { found: false };
    });

    if (result.found) {
      await page.waitForTimeout(120);

      const stable = await page.evaluate(({ x, y, selector }) => {
        const el = document.querySelector(selector);
        const hit = document.elementFromPoint(x, y);

        return !!el && (hit === el || el.contains(hit));
      }, {
        x: result.x,
        y: result.y,
        selector: await locator.evaluate(el => {
          return `[data-week9-silly-target="${el.dataset.week9SillyTarget}"]`;
        })
      });

      if (stable) {
        console.log(
          'SILLY CLEAR POINT',
          button,
          result.x,
          result.y
        );

        await page.mouse.move(result.x, result.y);
        await page.mouse.click(result.x, result.y, { button });

        return;
      }
    }

    await page.waitForTimeout(100);
  }

  throw Error('Silly Scene target has no clear clickable point');
}

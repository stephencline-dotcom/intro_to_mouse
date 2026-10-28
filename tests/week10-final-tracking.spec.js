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
        activeLesson: 'week10',
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
async function enterFinal(page) {
  const attempts = await setup(page);

  await reach(page, attempts, 'week10-final-mission');

  await expect(
    page.locator('#week10FinalArena')
  ).toBeVisible({ timeout: 12000 });

  await expect(
    page.locator('.week10-final-target[data-correct="true"]')
  ).toHaveCount(1, { timeout: 12000 });

  return attempts;
}

function finalRecords(attempts) {
  return [...attempts.values()].filter(
    a => a.stepId === 'week10-final-mission'
  );
}

async function leaveFinal(page) {
  const next = page.locator('#studentNextButton');

  if (await next.isDisabled()) {
    await page.locator('#studentBackButton').click();
  } else {
    await next.click();
  }
}

async function verifyFinalIncomplete(attempts, wrongCount) {
  await expect.poll(
    () => finalRecords(attempts).some(
      a => a.status === 'incomplete'
    ),
    { timeout: 12000 }
  ).toBe(true);

  const record = finalRecords(attempts).find(
    a => a.status === 'incomplete'
  );

  expect(record.wrongActions).toBe(wrongCount);

  console.log('FINAL INCOMPLETE', record);
}

test(
  'week10-final-mission: wrong target saves one mistake',
  async ({ page }) => {
    const attempts = await enterFinal(page);

    const wrongTarget = page.locator(
      '.week10-final-target[data-correct="false"]'
    ).first();

    await physicalClick(page, wrongTarget, 'right');

    await leaveFinal(page);

    await verifyFinalIncomplete(attempts, 1);
  }
);

test(
  'week10-final-mission: wrong action saves one mistake',
  async ({ page }) => {
    const attempts = await enterFinal(page);

    const correctTarget = page.locator(
      '.week10-final-target[data-correct="true"]'
    );

    await physicalClick(page, correctTarget, 'right');

    await expect(
      page.locator('#week10FinalMenu')
    ).toBeVisible();

    const wrongAction = page.locator(
      '#week10FinalMenu [data-correct="false"]'
    ).first();

    await physicalClick(page, wrongAction, 'left');

    await leaveFinal(page);

    await verifyFinalIncomplete(attempts, 1);
  }
);

test(
  'week10-final-mission: leaving early saves incomplete',
  async ({ page }) => {
    const attempts = await enterFinal(page);

    await leaveFinal(page);

    await verifyFinalIncomplete(attempts, 0);
  }
);

test(
  'week10-final-mission: all six rounds save completed',
  async ({ page }) => {
    const attempts = await enterFinal(page);

    const completed = () =>
      finalRecords(attempts).some(
        a => a.status === 'completed'
      );

    expect(completed()).toBe(false);

    for (let round = 0; round < 6; round++) {
      console.log('FINAL MISSION ROUND', round + 1);

      const target = page.locator(
        '.week10-final-target[data-correct="true"]'
      );

      await expect(target).toHaveCount(1, {
        timeout: 12000
      });

      await physicalClick(page, target, 'right');

      await expect(
        page.locator('#week10FinalMenu')
      ).toBeVisible();

      const action = page.locator(
        '#week10FinalMenu [data-correct="true"]'
      );

      await expect(action).toHaveCount(1);

      await physicalClick(page, action, 'left');

      if (round < 5) {
        expect(completed()).toBe(false);

        await expect(
          page.locator('#week10FinalComplete')
        ).toBeHidden();

        await page.waitForTimeout(1150);
      }
    }

    await expect(
      page.locator('#week10FinalComplete')
    ).toBeVisible({ timeout: 15000 });

    await leaveFinal(page);

    await expect.poll(
      () => completed(),
      { timeout: 12000 }
    ).toBe(true);

    const record = finalRecords(attempts).find(
      a => a.status === 'completed'
    );

    expect(record.wrongActions).toBe(0);

    console.log('FINAL MISSION COMPLETED', record);
  }
);

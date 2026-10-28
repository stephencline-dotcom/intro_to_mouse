const { test, expect } = require("@playwright/test");

async function prepareStudent(page) {
  const state = {
    freezeScreenArmed: false,
    freezeUnlockVersion: 0
  };

  await page.route("**/api/classroom-state", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(state)
    });
  });

  await page.goto("/");

  await page.evaluate(() => {
    window.__freezeEvents = [];

    window.HandsOnMouseData = {
      freezeStarted() {
        window.__freezeEvents.push({
          type: "start",
          time: performance.now()
        });
      },
      freezeEnded() {
        window.__freezeEvents.push({
          type: "end",
          time: performance.now()
        });
      }
    };
  });

  await expect(
    page.locator("#studentFreezeOverlay")
  ).toHaveCount(1);

  return state;
}

async function waitForState(page, armed) {
  await expect.poll(
    () => page.locator("html").getAttribute("data-freeze-armed")
  ).toBe(String(armed));
}

test("first student interaction activates Freeze", async ({ page }) => {
  const state = await prepareStudent(page);

  state.freezeScreenArmed = true;
  await waitForState(page, true);

  await expect(
    page.locator("#studentFreezeOverlay")
  ).not.toHaveAttribute("data-active", "true");

  await page.mouse.move(600, 400);

  await expect(
    page.locator("#studentFreezeOverlay")
  ).toHaveAttribute("data-active", "true");

  await expect(
    page.locator("#studentFreezeOverlay")
  ).toContainText("Eyes Up Front");

  const events = await page.evaluate(() => window.__freezeEvents);

  expect(events.filter(event => event.type === "start")).toHaveLength(1);
});

test("frozen overlay blocks student clicks", async ({ page }) => {
  const state = await prepareStudent(page);

  await page.evaluate(() => {
    const button = document.createElement("button");
    button.id = "freezeTestButton";
    button.textContent = "Test Lesson Action";
    button.style.cssText =
      "position:fixed;left:500px;top:350px;z-index:1;padding:30px";
    button.addEventListener("click", () => {
      window.__lessonClicks = (window.__lessonClicks || 0) + 1;
    });
    document.body.appendChild(button);
    window.__lessonClicks = 0;
  });

  state.freezeScreenArmed = true;
  await waitForState(page, true);

  await page.mouse.move(600, 400);

  await expect(
    page.locator("#studentFreezeOverlay")
  ).toHaveAttribute("data-active", "true");

  await page.mouse.click(600, 400);

  expect(
    await page.evaluate(() => window.__lessonClicks)
  ).toBe(0);
});

test("Release Unlocked keeps frozen students frozen", async ({ page }) => {
  const state = await prepareStudent(page);

  state.freezeScreenArmed = true;
  await waitForState(page, true);

  await page.mouse.move(600, 400);

  await expect(
    page.locator("#studentFreezeOverlay")
  ).toHaveAttribute("data-active", "true");

  state.freezeScreenArmed = false;
  await waitForState(page, false);

  await expect(
    page.locator("#studentFreezeOverlay")
  ).toHaveAttribute("data-active", "true");
});

test("Unlock All ends freeze and records duration", async ({ page }) => {
  const state = await prepareStudent(page);

  state.freezeScreenArmed = true;
  await waitForState(page, true);

  await page.mouse.move(600, 400);

  await expect(
    page.locator("#studentFreezeOverlay")
  ).toHaveAttribute("data-active", "true");

  await page.waitForTimeout(600);

  state.freezeScreenArmed = false;
  state.freezeUnlockVersion += 1;

  await expect(
    page.locator("#studentFreezeOverlay")
  ).toHaveAttribute("data-active", "false");

  const events = await page.evaluate(() => window.__freezeEvents);

  expect(events.filter(event => event.type === "start")).toHaveLength(1);
  expect(events.filter(event => event.type === "end")).toHaveLength(1);

  const start = events.find(event => event.type === "start");
  const end = events.find(event => event.type === "end");

  expect(end.time - start.time).toBeGreaterThan(500);
});

test("teacher logout releases Freeze before ending session", async ({ page }) => {
  const requests = [];

  await page.route("**/api/classroom-state", async route => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      requests.push(body);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          freezeScreenArmed: false,
          trainingPaused: false
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        freezeScreenArmed: true,
        freezeUnlockVersion: 0
      })
    });
  });

  await page.goto("/pages/admin.html");

  await page.locator("#teacherLogoutButton").click();

  await expect(page).toHaveURL(/login\.html/);

  expect(requests.some(
    body => body.freezeScreenArmed === false &&
      body.trainingPaused === false
  )).toBe(true);
});

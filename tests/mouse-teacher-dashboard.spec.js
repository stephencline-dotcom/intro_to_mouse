const { test, expect } = require("@playwright/test");

const classId = "11111111-1111-4111-8111-111111111111";
const alphaId = "22222222-2222-4222-8222-222222222222";
const betaId = "33333333-3333-4333-8333-333333333333";

const classroom = {
  id: classId,
  name: "Dashboard Integration Test",
  join_code: "TEST42"
};

const classes = [{
  ...classroom,
  active: true,
  mouse_students: [
    { id: alphaId, display_name: "Mouse Test Alpha", active: true },
    { id: betaId, display_name: "Mouse Test Beta", active: true }
  ]
}];

const week = {
  lessonId: "week10",
  grade: 3,
  score: 82,
  completion: 83,
  accuracy: 90,
  pace: 75,
  completed: 5,
  required: 6,
  wrongActions: 2,
  incomplete: 1,
  activeMs: 120000,
  freezes: 1,
  frozenMs: 5000
};

const report = {
  classroom,
  assignedLessons: [
    { lesson_id: "week10", included_in_grade: true }
  ],
  students: [
    {
      id: alphaId,
      name: "Mouse Test Alpha",
      grade: {
        grade: 3,
        score: 82,
        completion: 83,
        accuracy: 90,
        pace: 75,
        completed: 5,
        required: 6,
        weeks: [week]
      },
      awareness: {
        wrongActions: 2,
        incomplete: 1,
        freezes: 1,
        frozenMs: 5000
      },
      attempts: [{
        id: "attempt-alpha",
        lesson_id: "week10",
        step_id: "week10-potion-lab",
        step_title: "Magic Potion Lab",
        attempt_number: 1,
        status: "completed",
        active_ms: 120000,
        correct_actions: 3,
        wrong_actions: 2,
        freeze_count: 1
      }]
    },
    {
      id: betaId,
      name: "Mouse Test Beta",
      grade: {
        grade: 1,
        score: 0,
        completion: 0,
        accuracy: 0,
        pace: 0,
        completed: 0,
        required: 6,
        weeks: [{
          ...week,
          grade: 1,
          score: 0,
          completion: 0,
          accuracy: 0,
          completed: 0,
          wrongActions: 0,
          incomplete: 0,
          activeMs: 0,
          freezes: 0,
          frozenMs: 0
        }]
      },
      awareness: {
        wrongActions: 0,
        incomplete: 0,
        freezes: 0,
        frozenMs: 0
      },
      attempts: []
    }
  ]
};

async function setup(page) {
  await page.route("**/api/teacher-login", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        token: "dashboard-test-token"
      })
    });
  });

  await page.route("**/api/mouse-data/classes", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ classes })
    });
  });

  await page.route("**/api/mouse-data/reports/**", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(report)
    });
  });

  await page.goto("/pages/data.html");

  await page.locator(
    '#teacherDataUnlock input[name="password"]'
  ).fill("fictional-test-password");

  await page.getByRole("button", {
    name: "Open Student Data"
  }).click();

  await expect(
    page.locator('[data-class-id="' + classId + '"]')
  ).toBeVisible();
}

async function openReport(page) {
  await page.locator(
    '[data-class-id="' + classId + '"]'
  ).click();

  await expect(
    page.locator("#reportTitle")
  ).toHaveText("Dashboard Integration Test");
}

test("teacher can sign in and see class", async ({ page }) => {
  await setup(page);

  await expect(
    page.locator('[data-class-id="' + classId + '"]')
  ).toContainText("TEST42");
});

test("class report displays student data", async ({ page }) => {
  await setup(page);
  await openReport(page);

  const row = page.locator(
    '[data-student-id="' + alphaId + '"]'
  );

  await expect(row).toContainText("Mouse Test Alpha");
  await expect(row.locator("td").nth(1)).toHaveText("3");
  await expect(row.locator("td").nth(2)).toHaveText("82");
  await expect(row.locator("td").nth(3)).toHaveText("5/6");
  await expect(row.locator("td").nth(4)).toHaveText("90%");
  await expect(row.locator("td").nth(5)).toHaveText("2");
  await expect(row.locator("td").nth(6)).toHaveText("1");
  await expect(row.locator("td").nth(7)).toHaveText("1");
  await expect(row.locator("td").nth(8)).toHaveText("0m 5s");
});

test("student detail displays weekly results", async ({ page }) => {
  await setup(page);
  await openReport(page);

  await page.locator(
    '[data-student-id="' + alphaId + '"]'
  ).click();

  const detail = page.locator("#studentDetail");

  await expect(detail).toBeVisible();
  await expect(detail).toContainText("Mouse Test Alpha");
  await expect(detail).toContainText("Week 10");
  await expect(detail).toContainText("5/6");

  await detail.getByText("View individual activity history").click();

  await expect(detail).toContainText("Magic Potion Lab");
  await expect(detail).toContainText("Attempt 1");
  await expect(detail).toContainText("completed");
});

test("student records remain separate", async ({ page }) => {
  await setup(page);
  await openReport(page);

  const alpha = page.locator(
    '[data-student-id="' + alphaId + '"]'
  );

  const beta = page.locator(
    '[data-student-id="' + betaId + '"]'
  );

  await expect(alpha).toContainText("5/6");
  await expect(beta).toContainText("0/6");

  await beta.click();

  await expect(
    page.locator("#studentDetail")
  ).toContainText("Mouse Test Beta");

  await expect(
    page.locator("#studentDetail")
  ).not.toContainText("Magic Potion Lab");
});

test("print button invokes browser printing", async ({ page }) => {
  await setup(page);
  await openReport(page);

  await page.evaluate(() => {
    window.__printCalled = false;
    window.print = () => {
      window.__printCalled = true;
    };
  });

  await page.locator("#printData").click();

  await expect.poll(
    () => page.evaluate(() => window.__printCalled)
  ).toBe(true);
});

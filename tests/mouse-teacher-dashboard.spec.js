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
test("class management: cancel deletion makes no API request", async ({ page }) => {
  let deletes = 0;

  await page.route("**/api/mouse-data/classes/*", async route => {
    if (route.request().method() === "DELETE") {
      deletes++;
      await route.fulfill({ status: 200, body: "{}" });
      return;
    }
    await route.continue();
  });

  await setup(page);

  page.once("dialog", dialog => dialog.dismiss());

  await page.locator(`[data-delete-class="${classId}"]`).click();

  await expect(
    page.locator(`[data-class-id="${classId}"]`)
  ).toBeVisible();

  expect(deletes).toBe(0);
});

test("class management: confirmed deletion targets selected class once", async ({ page }) => {
  const deleted = [];

  await page.route("**/api/mouse-data/classes/*", async route => {
    if (route.request().method() === "DELETE") {
      deleted.push(route.request().url());

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          deletedClassId: classId
        })
      });
      return;
    }
    await route.continue();
  });

  await setup(page);

  page.once("dialog", dialog => dialog.accept());

  await page.locator(`[data-delete-class="${classId}"]`).click();

  await expect.poll(() => deleted.length).toBe(1);

  expect(new URL(deleted[0]).pathname).toBe(
    `/api/mouse-data/classes/${classId}`
  );
});

test("class management: deleting selected class clears report", async ({ page }) => {
  await page.route("**/api/mouse-data/classes/*", async route => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          deletedClassId: classId
        })
      });
      return;
    }
    await route.continue();
  });

  await setup(page);
  await openReport(page);

  await expect(page.locator("#reportSection")).toBeVisible();

  page.once("dialog", dialog => dialog.accept());

  await page.locator(`[data-delete-class="${classId}"]`).click();

  await expect(page.locator("#reportSection")).toBeHidden();
  await expect(page.locator("#studentDetail")).toBeHidden();
});

test("class management: rename preserves student identity and grades", async ({ page }) => {
  const renamed = structuredClone(report);
  renamed.students[0].name = "Mouse Test Alexandra";

  let savedRequest = null;

  await page.route("**/api/mouse-data/reports/**", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(savedRequest ? renamed : report)
    });
  });

  await page.route("**/api/mouse-data/classes/*/students/*", async route => {
    savedRequest = {
      method: route.request().method(),
      path: new URL(route.request().url()).pathname,
      body: route.request().postDataJSON()
    };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        student: {
          id: alphaId,
          name: "Mouse Test Alexandra"
        }
      })
    });
  });

  await setup(page);

  // Override the default report mock after setup.
  await page.route("**/api/mouse-data/reports/**", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(savedRequest ? renamed : report)
    });
  });

  await openReport(page);

  await page.locator(`[data-student-id="${alphaId}"]`).click();

  page.once("dialog", dialog => {
    expect(dialog.type()).toBe("prompt");
    dialog.accept("Mouse Test Alexandra");
  });

  await page.locator(`[data-edit-student="${alphaId}"]`).click();

  await expect(
    page.locator("#studentDetail")
  ).toContainText("Mouse Test Alexandra");

  expect(savedRequest).toEqual({
    method: "PUT",
    path: `/api/mouse-data/classes/${classId}/students/${alphaId}`,
    body: { name: "Mouse Test Alexandra" }
  });

  const row = page.locator(`[data-student-id="${alphaId}"]`);

  await expect(row).toContainText("Mouse Test Alexandra");
  await expect(row).toContainText("5/6");
  await expect(row).toContainText("82");

  await expect(
    page.locator("#studentDetail")
  ).toContainText("Magic Potion Lab");
});

test("class management: duplicate name error preserves student", async ({ page }) => {
  await page.route("**/api/mouse-data/classes/*/students/*", async route => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Another student already has that name."
      })
    });
  });

  await setup(page);
  await openReport(page);

  await page.locator(`[data-student-id="${alphaId}"]`).click();

  const messages = [];

  page.on("dialog", async dialog => {
    if (dialog.type() === "prompt") {
      await dialog.accept("Mouse Test Beta");
    } else {
      messages.push(dialog.message());
      await dialog.accept();
    }
  });

  await page.locator(`[data-edit-student="${alphaId}"]`).click();

  await expect.poll(() => messages.length).toBe(1);

  expect(messages[0]).toContain(
    "Another student already has that name."
  );

  await expect(
    page.locator(`[data-student-id="${alphaId}"]`)
  ).toContainText("Mouse Test Alpha");
});

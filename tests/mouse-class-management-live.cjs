require("dotenv").config({ quiet: true });

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const supabase = require("../server/supabase");
const {
  registerMouseDataRoutes,
  teacherToken
} = require("../server/mouseDataRoutes");

const app = express();
app.use(express.json());
registerMouseDataRoutes(app, supabase);

const server = app.listen(0, "127.0.0.1");

let createdClassId = null;
let cleanupVerified = false;
const results = [];

function record(message) {
  results.push("PASS: " + message);
}

async function api(base, path, method, token, body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    ...(body === undefined ? {} : {
      body: JSON.stringify(body)
    })
  });

  const result = await response.json().catch(() => ({}));

  return {
    status: response.status,
    result
  };
}

async function cleanup() {
  if (!createdClassId) return;

  const { error } = await supabase
    .from("mouse_classes")
    .delete()
    .eq("id", createdClassId);

  if (error) {
    throw new Error("Cleanup failed: " + error.message);
  }

  const { data, error: verifyError } = await supabase
    .from("mouse_classes")
    .select("id")
    .eq("id", createdClassId)
    .maybeSingle();

  if (verifyError || data) {
    throw new Error("Temporary class deletion not verified.");
  }

  cleanupVerified = true;
}

async function run() {
  await new Promise((resolve, reject) => {
    if (server.listening) {
      resolve();
      return;
    }

    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();

  if (!address || !address.port) {
    throw new Error("Temporary test server did not start.");
  }

  const base = "http://127.0.0.1:" + address.port;
  const token = teacherToken();
  const unique = crypto.randomUUID().slice(0, 8);

  const created = await api(
    base,
    "/api/mouse-data/classes",
    "POST",
    token,
    {
      name: "MOUSE CLASS MANAGEMENT TEST " + unique,
      students: ["Test Alpha " + unique, "Test Beta " + unique]
    }
  );

  assert.equal(created.status, 200);
  createdClassId = created.result.classroom.id;
  record("Temporary class created");

  const { data: students, error } = await supabase
    .from("mouse_students")
    .select("id,display_name")
    .eq("class_id", createdClassId);

  assert.ifError(error);
  assert.equal(students.length, 2);

  const alpha = students.find(
    student => student.display_name.startsWith("Test Alpha")
  );

  const beta = students.find(
    student => student.display_name.startsWith("Test Beta")
  );

  assert.ok(alpha && beta);
  record("Two temporary students created");

  // ACTIVITY_HISTORY_PRESERVATION_V1
  const { data: savedAttempt, error: insertError } = await supabase
    .from("mouse_attempts")
    .insert({
      class_id: createdClassId,
      student_id: alpha.id,
      lesson_id: "week10",
      step_id: "week10-potion-lab",
      step_title: "Magic Potion Lab",
      attempt_number: 1,
      status: "completed",
      active_ms: 125000,
      correct_actions: 3,
      wrong_actions: 2,
      freeze_count: 1,
      frozen_ms: 5000
    })
    .select("id")
    .single();

  assert.ifError(insertError);
  assert.ok(savedAttempt?.id);
  record("Completed activity saved before rename");

  const renamed = await api(
    base,
    `/api/mouse-data/classes/${createdClassId}/students/${alpha.id}`,
    "PUT",
    token,
    { name: "Corrected Alpha " + unique }
  );

  assert.equal(renamed.status, 200);
  assert.equal(renamed.result.student.id, alpha.id);
  record("Student renamed without changing ID");

  const duplicate = await api(
    base,
    `/api/mouse-data/classes/${createdClassId}/students/${alpha.id}`,
    "PUT",
    token,
    { name: beta.display_name }
  );

  assert.equal(duplicate.status, 409);
  record("Duplicate student name rejected");

  const { data: verifiedStudent, error: studentError } =
    await supabase
      .from("mouse_students")
      .select("id,display_name")
      .eq("id", alpha.id)
      .single();

  assert.ifError(studentError);
  assert.equal(verifiedStudent.id, alpha.id);
  assert.equal(
    verifiedStudent.display_name,
    "Corrected Alpha " + unique
  );

  record("Corrected name saved in database");

  const { data: preserved, error: historyError } = await supabase
    .from("mouse_attempts")
    .select("*")
    .eq("id", savedAttempt.id)
    .eq("student_id", alpha.id)
    .single();

  assert.ifError(historyError);
  assert.equal(preserved.class_id, createdClassId);
  assert.equal(preserved.status, "completed");
  assert.equal(Number(preserved.correct_actions), 3);
  assert.equal(Number(preserved.wrong_actions), 2);
  assert.equal(Number(preserved.active_ms), 125000);
  assert.equal(Number(preserved.freeze_count), 1);
  assert.equal(Number(preserved.frozen_ms), 5000);

  record("Completed activity history preserved after rename");

  const deleted = await api(
    base,
    `/api/mouse-data/classes/${createdClassId}`,
    "DELETE",
    token
  );

  assert.equal(deleted.status, 200);
  assert.equal(deleted.result.deletedClassId, createdClassId);
  record("Temporary class deleted through API");

  await cleanup();
  record("Temporary class deletion verified");

  const { data: remainingAttempts, error: remainingError } = await supabase
    .from("mouse_attempts")
    .select("id")
    .eq("id", savedAttempt.id);

  assert.ifError(remainingError);
  assert.equal(remainingAttempts.length, 0);

  record("Temporary activity history removed by class deletion");
}

(async () => {
  let failure = null;

  try {
    await run();
  } catch (error) {
    failure = error;
  }

  try {
    await cleanup();
  } catch (error) {
    failure = failure
      ? new Error(failure.message + "; " + error.message)
      : error;
  }

  await new Promise(resolve => server.close(resolve));

  console.log("=== LIVE CLASS MANAGEMENT INTEGRATION ===");

  for (const result of results) {
    console.log(result);
  }

  console.log(
    "Cleanup verified:",
    cleanupVerified ? "YES" : "NO"
  );

  if (failure) {
    console.error("RESULT: FAIL");
    console.error(failure.message);
    process.exitCode = 1;
  } else {
    console.log("RESULT: PASS");
  }
})();

(() => {
  const TOKEN_KEY = "handsOnMouseTeacherDataToken";
  let token = sessionStorage.getItem(TOKEN_KEY) || "";
  let currentReport = null;
  let selectedClassId = null;
  let classManagementBusy = false;
  const classList = document.getElementById("classList");
  const reportSection = document.getElementById("reportSection");
  const unlock = document.getElementById("teacherDataUnlock");

  function headers() { return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }; }
  function duration(ms) { const seconds = Math.round(Number(ms || 0) / 1000); return `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }
  function escapeHtml(value) { const div = document.createElement("div"); div.textContent = String(value ?? ""); return div.innerHTML; }
  function lessonLabel(lessonId) {
    if (lessonId === "review1") {
      return "Week 2";
    }

    const match =
      String(lessonId || "").match(/^week(\d+)$/);

    return match
      ? `Week ${match[1]}`
      : String(lessonId || "");
  }

  function gradeExplanation(week) {
    const score = Number(week.score || 0);
    const completion = Number(week.completion || 0);
    const accuracy = Number(week.accuracy || 0);
    const grade = Number(week.grade || 1);
    const label = { 1: 'Low', 2: 'Needs Work', 3: 'On Level', 4: 'Above' }[grade];
    const details = [`${week.completed}/${week.required} activities completed`, `${accuracy}% accuracy`, `activity score ${score}/100`];
    let reason;
    if (grade === 4) {
      reason = 'Meets all Above requirements: activity score at least 90, completion at least 95%, and accuracy at least 90%.';
    } else if (grade === 3) {
      const missing = [];
      if (score < 90) missing.push('activity score below 90');
      if (completion < 95) missing.push('completion below 95%');
      if (accuracy < 90) missing.push('accuracy below 90%');
      reason = `Meets On Level requirements (75 score, 80% completion, 75% accuracy), but not Above: ${missing.join(', ')}.`;
    } else if (grade === 2) {
      const missing = [];
      if (score < 75) missing.push('activity score below 75');
      if (completion < 80) missing.push('completion below 80%');
      if (accuracy < 75) missing.push('accuracy below 75%');
      reason = `Does not meet all On Level requirements: ${missing.join(', ')}.`;
    } else {
      reason = 'Does not yet meet the Needs Work threshold (score at least 50 or completion at least 50%).';
    }
    return `${label} (${grade}): ${details.join('; ')}. ${reason}`;
  }
  async function request(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) { token = ""; sessionStorage.removeItem(TOKEN_KEY); showUnlock(); throw new Error("Teacher sign-in required."); }
    if (!response.ok) throw new Error(result.error || "Request failed.");
    return result;
  }
  function showUnlock() { unlock.hidden = false; }
  unlock.querySelector("form").addEventListener("submit", async event => {
    event.preventDefault(); const status = unlock.querySelector("p:last-child"); status.textContent = "Checking...";
    try {
      const response = await fetch("/api/teacher-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: new FormData(event.target).get("password") }) });
      const result = await response.json(); if (!response.ok || !result.success || !result.token) throw new Error("Incorrect password.");
      token = result.token; sessionStorage.setItem(TOKEN_KEY, token); window.HandsOnMouseTeacherSession?.startTeacherSession(token); unlock.hidden = true; await loadClasses();
    } catch (error) { status.textContent = error.message; }
  });
  async function loadClasses() {
    try {
      const result = await request("/api/mouse-data/classes");
      if (!result.classes.length) { classList.innerHTML = "<p>No classes yet. Create your first class.</p>"; return; }
      classList.innerHTML = result.classes.map(item => `
        <div class="managed-class">
          <button class="class-button" data-class-id="${item.id}">
            <strong>${escapeHtml(item.name)}</strong>
            <span class="class-code">CODE: ${escapeHtml(item.join_code)}</span>
            <span>${item.mouse_students?.filter(s => s.active).length || 0} students</span>
          </button>
          <button
            type="button"
            class="class-delete-button"
            data-delete-class="${item.id}"
            data-class-name="${escapeHtml(item.name).replace(/"/g, "&quot;")}"
          >Delete Class</button>
        </div>
      `).join("");
    } catch (error) { classList.innerHTML = `<p>${escapeHtml(error.message)}</p>`; }
  }
  async function loadReport(classId) {
    const result = await request(`/api/mouse-data/reports/${classId}`); currentReport = result; selectedClassId = classId; reportSection.hidden = false;
    document.getElementById("reportTitle").textContent = result.classroom.name;
    document.getElementById("reportCode").textContent = `CLASS CODE ${result.classroom.join_code}`;
    document.getElementById("reportWeeks").textContent = result.assignedLessons.length ? `Current average includes: ${result.assignedLessons.map(x => lessonLabel(x.lesson_id)).join(", ")}` : "No graded weeks have started yet.";
    document.getElementById("reportBody").innerHTML = result.students.map(student => {
      const grade = student.grade.grade; return `<tr data-student-id="${student.id}"><td><strong>${escapeHtml(student.name)}</strong></td><td><span class="grade-pill grade-${grade || "none"}">${grade || "–"}</span></td><td>${student.grade.score ?? "–"}</td><td>${student.grade.completed}/${student.grade.required}</td><td>${student.grade.accuracy}%</td><td>${student.awareness.wrongActions}</td><td>${student.awareness.incomplete}</td><td>${student.awareness.freezes}</td><td>${duration(student.awareness.frozenMs)}</td></tr>`;
    }).join("");
    reportSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function showStudent(studentId) {
    const student =
      currentReport?.students.find(
        item => item.id === studentId
      );

    if (!student) {
      return;
    }

    const detail =
      document.getElementById("studentDetail");

    detail.hidden = false;

    const weekRows =
      student.grade.weeks.map(week => {
        const grade = week.grade || "–";

        return `
          <tr>
            <td><strong>${escapeHtml(lessonLabel(week.lessonId))}</strong></td>
            <td><span class="grade-pill grade-${grade === "–" ? "none" : grade}">${grade}</span></td>
            <td>${week.score}</td>
            <td>${week.completed}/${week.required}</td>
            <td>${week.accuracy}%</td>
            <td>${week.wrongActions}</td>
            <td>${week.incomplete}</td>
            <td>${duration(week.activeMs)}</td>
            <td>${week.freezes}</td>
            <td>${duration(week.frozenMs)}</td>
          </tr>
          <tr class="week-grade-explanation"><td colspan="10"><details><summary>Why this grade?</summary><p>${escapeHtml(gradeExplanation(week))}</p></details></td></tr>
        `;
      }).join("");

    const attempts =
      student.attempts.map(item => `
        <div class="attempt-card">
          <strong>${escapeHtml(item.step_title || item.step_id)}</strong>
          <span>
            ${escapeHtml(lessonLabel(item.lesson_id))}
            · Attempt ${item.attempt_number}
            · ${escapeHtml(item.status)}
          </span>
          <span>
            Active ${duration(item.active_ms)}
            · Wrong ${item.wrong_actions}
            · Freezes ${item.freeze_count}
          </span>
        </div>
      `).join("");

    detail.innerHTML = `
      <div class="student-detail-heading">
        <div>
          <span>STUDENT REPORT</span>
          <h3>${escapeHtml(student.name)}</h3>
          <button
            type="button"
            class="student-edit-name-button"
            data-edit-student="${student.id}"
          >Edit Name</button>
        </div>

        <div class="student-overall-grade">
          <small>Current Grade</small>
          <strong>${student.grade.grade || "–"}</strong>
          <span>Activity Score ${student.grade.score ?? "–"} / 100</span>
        </div>
      </div>

      <p>
        The current grade averages only the weeks taught
        so far and updates as new weeks are completed.
      </p>

      <h4>Week-by-Week Results</h4>
      <p class="score-help">Activity Score /100 = completion 60% + accuracy 30% + pace 10%. This is not a percentage grade; proficiency grades also require minimum accuracy and completion.</p>

      <div class="weekly-report-wrap">
        <table class="weekly-report-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Grade</th>
              <th title="Activity Score (0-100)">Score /100</th>
              <th>Complete</th>
              <th>Accuracy</th>
              <th>Wrong</th>
              <th>Missed</th>
              <th>Time</th>
              <th>Freezes</th>
              <th>Frozen</th>
            </tr>
          </thead>
          <tbody>
            ${weekRows}
          </tbody>
        </table>
      </div>

      <details class="attempt-history">
        <summary>View individual activity history</summary>
        <div class="attempt-grid">
          ${attempts || "<p>No activity attempts yet.</p>"}
        </div>
      </details>
    `;

    detail.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  document.getElementById("createClassForm").addEventListener("submit", async event => {
    event.preventDefault(); const status = document.getElementById("createStatus"); const form = new FormData(event.target); status.textContent = "Creating class...";
    try { const result = await request("/api/mouse-data/classes", { method: "POST", body: JSON.stringify({ name: form.get("className"), students: String(form.get("students") || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean) }) }); status.textContent = `Class created. Student code: ${result.classroom.join_code}`; event.target.reset(); await loadClasses(); }
    catch (error) { status.textContent = error.message; }
  });
  // tracking-mouse-class-management-ui
  classList.addEventListener("click", async event => {
    const deleteButton = event.target.closest("[data-delete-class]");

    if (deleteButton) {
      if (classManagementBusy) return;

      const classId = deleteButton.dataset.deleteClass;
      const className = deleteButton.dataset.className;

      if (!window.confirm(
        `Delete "${className}" and permanently remove its students, grades, and activity history?`
      )) {
        return;
      }

      classManagementBusy = true;
      deleteButton.disabled = true;

      try {
        await request(
          `/api/mouse-data/classes/${encodeURIComponent(classId)}`,
          { method: "DELETE" }
        );

        if (selectedClassId === classId) {
          selectedClassId = null;
          currentReport = null;
          reportSection.hidden = true;
          document.getElementById("studentDetail").hidden = true;
        }

        await loadClasses();
      } catch (error) {
        window.alert(error.message);
      } finally {
        classManagementBusy = false;
        deleteButton.disabled = false;
      }

      return;
    }

    const button = event.target.closest("[data-class-id]");

    if (button && !classManagementBusy) {
      loadReport(button.dataset.classId)
        .catch(error => window.alert(error.message));
    }
  });

  document.getElementById("studentDetail").addEventListener("click", async event => {
    const editButton = event.target.closest("[data-edit-student]");
    if (!editButton || !currentReport || !selectedClassId || classManagementBusy) return;

    const student = currentReport.students.find(
      item => item.id === editButton.dataset.editStudent
    );

    if (!student) return;

    const newName = window.prompt(
      "Correct student name:",
      student.name
    );

    if (newName === null) return;

    const cleaned = newName.trim().replace(/\s+/g, " ");

    if (!cleaned) {
      window.alert("Enter a valid student name.");
      return;
    }

    if (cleaned === student.name) return;

    classManagementBusy = true;
    editButton.disabled = true;

    try {
      await request(
        `/api/mouse-data/classes/${encodeURIComponent(selectedClassId)}/students/${encodeURIComponent(student.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({ name: cleaned })
        }
      );

      const studentId = student.id;
      const classId = selectedClassId;

      await loadReport(classId);
      showStudent(studentId);
      await loadClasses();
    } catch (error) {
      window.alert(error.message);
    } finally {
      classManagementBusy = false;
      editButton.disabled = false;
    }
  });
  document.getElementById("reportBody").addEventListener("click", event => { const row = event.target.closest("[data-student-id]"); if (row) showStudent(row.dataset.studentId); });
  document.getElementById("refreshData").addEventListener("click", loadClasses);
  document.getElementById("printData").addEventListener("click", () => window.print());
  if (!token) showUnlock(); else loadClasses();
})();

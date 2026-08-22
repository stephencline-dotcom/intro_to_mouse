(() => {
  const teacherSession = window.HandsOnMouseTeacherSession;

  if (teacherSession && teacherSession.isTeacherSession()) {
    return;
  }

  let freezeArmed = false;
  let interactionTriggered = false;

  let overlay = document.getElementById("studentFreezeOverlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "studentFreezeOverlay";
    overlay.innerHTML = `
      <div class="freeze-overlay-card">
        <h1>Eyes Up Front</h1>
        <p>Look at the teacher.</p>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  function showOverlay() {
    overlay.dataset.active = "true";
    document.body.classList.add("student-screen-frozen");
  }

  function hideOverlay() {
    overlay.dataset.active = "false";
    document.body.classList.remove("student-screen-frozen");
  }

  function handleStudentInteraction() {
    if (!freezeArmed || interactionTriggered) {
      return;
    }

    interactionTriggered = true;
    showOverlay();
  }

  document.addEventListener("pointermove", handleStudentInteraction);
  document.addEventListener("pointerdown", handleStudentInteraction);
  document.addEventListener("wheel", handleStudentInteraction, { passive: true });

  async function checkClassroomState() {
    try {
      const response = await fetch("/api/classroom-state", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Unable to load classroom state.");
      }

      const state = await response.json();
      const newFreezeArmed = state.freezeScreenArmed === true;

      if (!newFreezeArmed) {
        freezeArmed = false;
        interactionTriggered = false;
        hideOverlay();
        return;
      }

      if (!freezeArmed) {
        freezeArmed = true;
        interactionTriggered = false;
        hideOverlay();
      }
    } catch (error) {
      console.error("Student Freeze Screen:", error);
    }
  }

  checkClassroomState();
  setInterval(checkClassroomState, 1000);
})();

(() => {
  const teacherSession = window.HandsOnMouseTeacherSession;

  if (teacherSession && teacherSession.isTeacherSession()) {
    return;
  }

  let overlay = document.getElementById("studentPauseOverlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "studentPauseOverlay";

    overlay.innerHTML = `
      <div class="pause-overlay-card">
        <h1>Training Paused</h1>
        <p>Your teacher has paused the activity.</p>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  function setPaused(isPaused) {
    overlay.dataset.active = String(isPaused);

    document.body.classList.toggle(
      "student-training-paused",
      isPaused
    );
  }

  async function checkClassroomState() {
    try {
      const response = await fetch("/api/classroom-state", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Unable to load classroom state.");
      }

      const state = await response.json();

      setPaused(state.trainingPaused === true);
    } catch (error) {
      console.error("Student Training Pause:", error);
    }
  }

  checkClassroomState();

  setInterval(checkClassroomState, 1000);
})();

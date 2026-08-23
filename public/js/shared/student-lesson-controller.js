(() => {
  const teacherSession = window.HandsOnMouseTeacherSession;

  if (teacherSession && teacherSession.isTeacherSession()) {
    return;
  }

  const lesson = window.HandsOnMouseLessons?.week1;

  if (!lesson || !Array.isArray(lesson.steps)) {
    console.error("Student lesson controller: Week 1 lesson definition missing.");
    return;
  }

  const INDEPENDENT_STEP_KEY = "handsOnMouseIndependentStep";

  let currentDisplayedStep = -1;
  let currentMode = null;

  function getLessonContainer() {
    let container = document.getElementById("studentLessonView");

    if (!container) {
      container = document.createElement("section");
      container.id = "studentLessonView";
      document.body.appendChild(container);
    }

    return container;
  }

  function showLessonView() {
    const homePage = document.querySelector(".home-page");

    if (homePage) {
      homePage.hidden = true;
    }

    getLessonContainer().hidden = false;
  }

  function renderStep(stepIndex, mode) {
    const safeIndex = Math.min(
      Math.max(stepIndex, 0),
      lesson.steps.length - 1
    );

    currentDisplayedStep = safeIndex;

    const step = lesson.steps[safeIndex];
    const container = getLessonContainer();

    const independentControls =
      mode === "student"
        ? `
          <div class="student-independent-controls">
            <button
              id="studentBackButton"
              type="button"
              ${safeIndex <= 0 ? "disabled" : ""}
            >
              Back
            </button>

            <button
              id="studentNextButton"
              type="button"
              ${safeIndex >= lesson.steps.length - 1 ? "disabled" : ""}
            >
              Next
            </button>
          </div>
        `
        : "";

    container.innerHTML = `
      <div class="student-lesson-card">
        <p class="student-lesson-progress">
          Step ${safeIndex + 1} of ${lesson.steps.length}
        </p>

        <h1>${step.title}</h1>

        <p class="student-lesson-type">
          ${
            step.type === "practice"
              ? "Practice"
              : step.type === "complete"
                ? "Complete"
                : "Learn"
          }
        </p>

        ${independentControls}
      </div>
    `;

    if (mode === "student") {
      const backButton = document.getElementById("studentBackButton");
      const nextButton = document.getElementById("studentNextButton");

      backButton?.addEventListener("click", () => {
        const newStep = Math.max(currentDisplayedStep - 1, 0);

        sessionStorage.setItem(
          INDEPENDENT_STEP_KEY,
          String(newStep)
        );

        renderStep(newStep, "student");
      });

      nextButton?.addEventListener("click", () => {
        const newStep = Math.min(
          currentDisplayedStep + 1,
          lesson.steps.length - 1
        );

        sessionStorage.setItem(
          INDEPENDENT_STEP_KEY,
          String(newStep)
        );

        renderStep(newStep, "student");
      });
    }
  }

  function getIndependentStep() {
    const saved = Number(
      sessionStorage.getItem(INDEPENDENT_STEP_KEY)
    );

    if (!Number.isInteger(saved)) {
      return 0;
    }

    return Math.min(
      Math.max(saved, 0),
      lesson.steps.length - 1
    );
  }

  async function syncLessonState() {
    try {
      const response = await fetch("/api/classroom-state", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Unable to load classroom lesson state.");
      }

      const state = await response.json();
      const mode = state.lessonControlMode || "teacher";

      showLessonView();

      if (mode === "teacher") {
        if (
          currentMode !== "teacher" ||
          currentDisplayedStep !== (state.currentLessonStep ?? 0)
        ) {
          currentMode = "teacher";
          renderStep(state.currentLessonStep ?? 0, "teacher");
        }
      } else {
        if (currentMode !== "student") {
          currentMode = "student";
          renderStep(getIndependentStep(), "student");
        }
      }
    } catch (error) {
      console.error("Student lesson controller:", error);
    }
  }

  syncLessonState();
  setInterval(syncLessonState, 1000);
})();

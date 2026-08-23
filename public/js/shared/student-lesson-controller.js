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

  let currentDisplayedStep = -1;

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

  function showHomePage() {
    const homePage = document.querySelector(".home-page");
    const lessonView = document.getElementById("studentLessonView");

    if (homePage) {
      homePage.hidden = false;
    }

    if (lessonView) {
      lessonView.hidden = true;
    }
  }

  function renderStep(stepIndex) {
    const safeIndex = Math.min(
      Math.max(stepIndex, 0),
      lesson.steps.length - 1
    );

    if (safeIndex === currentDisplayedStep) {
      return;
    }

    currentDisplayedStep = safeIndex;

    const step = lesson.steps[safeIndex];
    const container = getLessonContainer();

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
      </div>
    `;
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

      if (state.lessonControlMode === "teacher") {
        showLessonView();
        renderStep(state.currentLessonStep ?? 0);
      } else {
        showHomePage();
      }
    } catch (error) {
      console.error("Student lesson controller:", error);
    }
  }

  syncLessonState();
  setInterval(syncLessonState, 1000);
})();

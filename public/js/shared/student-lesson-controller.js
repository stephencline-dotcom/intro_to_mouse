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

  function getStepContent(step, safeIndex) {
    if (step.id === "meet-the-mouse") {
      return `
        <div class="lesson-screen lesson-screen-meet-mouse">

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Meet the Mouse</h1>

            <p class="lesson-instruction">
              Move the mouse. Watch the pointer move.
            </p>
          </div>

          <div class="meet-mouse-visuals">

            <div class="mouse-demo">
              <div id="lessonMouseMovement" class="mouse-movement-demo">
                <div class="mouse-demo-hand">
                  <div class="mouse-demo-palm"></div>
                  <div class="mouse-demo-finger mouse-demo-index"></div>
                  <div class="mouse-demo-finger mouse-demo-middle"></div>
                  <div class="mouse-demo-finger mouse-demo-pinky"></div>
                </div>

                <div class="mouse-demo-body">
                  <div class="mouse-demo-left"></div>
                  <div class="mouse-demo-right"></div>
                  <div class="mouse-demo-wheel"></div>
                </div>
              </div>

              <p>Move the Mouse</p>
            </div>

            <div class="mouse-demo-arrow">
              →
            </div>

            <div class="pointer-demo">
              <div id="pointerPracticeArea" class="pointer-practice-area">
                <div id="lessonDemoPointer" class="pointer-demo-icon">➤</div>
              </div>
              <p>Pointer</p>
            </div>

          </div>

          <p class="lesson-coaching">
            When you move the mouse, the pointer moves on the screen.
          </p>

        </div>
      `;
    }

    return `
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

  let removeMeetMouseMovementListener = null;

  function stopStepBehavior() {
    if (removeMeetMouseMovementListener) {
      removeMeetMouseMovementListener();
      removeMeetMouseMovementListener = null;
    }
  }

  function startMeetMouseBehavior() {
    const input = window.HandsOnMouseInput;
    const area = document.getElementById("pointerPracticeArea");
    const pointer = document.getElementById("lessonDemoPointer");
    const mouseVisual = document.getElementById("lessonMouseMovement");

    if (!input || !area || !pointer || !mouseVisual) {
      return;
    }

    let pointerX = area.clientWidth / 2;
    let pointerY = area.clientHeight / 2;

    let visualX = 0;
    let visualY = 0;
    let targetVisualX = 0;
    let targetVisualY = 0;
    let animationFrame = null;

    function positionPointer() {
      const maxX = Math.max(area.clientWidth - pointer.offsetWidth, 0);
      const maxY = Math.max(area.clientHeight - pointer.offsetHeight, 0);

      pointerX = Math.min(Math.max(pointerX, 0), maxX);
      pointerY = Math.min(Math.max(pointerY, 0), maxY);

      pointer.style.left = `${pointerX}px`;
      pointer.style.top = `${pointerY}px`;
    }

    positionPointer();

    removeMeetMouseMovementListener = input.subscribe("move", (event) => {
      mouseVisual.classList.add("has-mouse-movement");

      pointerX += event.movementX;
      pointerY += event.movementY;

      positionPointer();

      targetVisualX += event.movementX * 0.45;
      targetVisualY += event.movementY * 0.45;

      targetVisualX = Math.max(
        -55,
        Math.min(55, targetVisualX)
      );

      targetVisualY = Math.max(
        -35,
        Math.min(35, targetVisualY)
      );

      if (!animationFrame) {
        const animateVisualMouse = () => {
          visualX += (targetVisualX - visualX) * 0.22;
          visualY += (targetVisualY - visualY) * 0.22;

          mouseVisual.style.transform =
            `translate3d(${visualX}px, ${visualY}px, 0)`;

          const stillMoving =
            Math.abs(targetVisualX - visualX) > 0.2 ||
            Math.abs(targetVisualY - visualY) > 0.2;

          if (stillMoving) {
            animationFrame = requestAnimationFrame(
              animateVisualMouse
            );
          } else {
            animationFrame = null;
          }
        };

        animationFrame = requestAnimationFrame(
          animateVisualMouse
        );
      }
    });
  }

  function renderStep(stepIndex, mode) {
    const safeIndex = Math.min(
      Math.max(stepIndex, 0),
      lesson.steps.length - 1
    );

    currentDisplayedStep = safeIndex;

    stopStepBehavior();

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
      ${getStepContent(step, safeIndex)}
      ${independentControls}
    `;

    if (step.id === "meet-the-mouse") {
      startMeetMouseBehavior();
    }

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

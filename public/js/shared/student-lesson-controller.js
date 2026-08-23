(() => {
  const teacherSession = window.HandsOnMouseTeacherSession;
  const isTeacher =
    teacherSession && teacherSession.isTeacherSession();

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
    if (step.id === "left-click") {
      return `
        <div class="lesson-screen lesson-screen-left-click">

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Left Click</h1>

            <p class="lesson-instruction">
              Press the left button one time.
            </p>
          </div>

          <div class="left-click-demo">

            <div class="hold-mouse-visual">

              <div id="leftClickHand" class="mouse-demo-hand left-click-hand">
                <div class="mouse-demo-palm"></div>
                <div id="leftClickFinger" class="mouse-demo-finger mouse-demo-index"></div>
                <div class="mouse-demo-finger mouse-demo-middle"></div>
                <div class="mouse-demo-finger mouse-demo-pinky"></div>
              </div>

              <div class="mouse-demo-body">
                <div id="leftClickButtonVisual" class="mouse-demo-left"></div>
                <div class="mouse-demo-right"></div>
                <div class="mouse-demo-wheel"></div>
              </div>

            </div>

            <div class="left-click-instruction-card">
              <strong>Click once</strong>
              <p>Press down and let go.</p>
            </div>

          </div>

          <p id="leftClickStatus" class="lesson-coaching">
            Try one left click.
          </p>

        </div>
      `;
    }

    if (step.id === "left-button") {
      return `
        <div class="lesson-screen lesson-screen-left-button">

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Meet the Left Button</h1>

            <p class="lesson-instruction">
              Your pointer finger rests on the left mouse button.
            </p>
          </div>

          <div class="left-button-demo">

            <div class="hold-mouse-visual left-button-mouse-visual">

              <div class="mouse-demo-hand left-button-hand">
                <div class="mouse-demo-palm"></div>
                <div class="mouse-demo-finger mouse-demo-index left-button-finger"></div>
                <div class="mouse-demo-finger mouse-demo-middle"></div>
                <div class="mouse-demo-finger mouse-demo-pinky"></div>
              </div>

              <div class="mouse-demo-body">
                <div class="mouse-demo-left left-button-highlight"></div>
                <div class="mouse-demo-right"></div>
                <div class="mouse-demo-wheel"></div>
              </div>

            </div>

            <div class="left-button-explanation">
              <div class="left-button-label">
                <span class="left-button-label-dot"></span>
                <strong>Left Button</strong>
              </div>

              <p>
                Use your pointer finger for a left click.
              </p>
            </div>

          </div>

          <p class="lesson-coaching">
            Rest your finger gently. Do not click yet.
          </p>

        </div>
      `;
    }

    if (step.id === "movement-practice") {
      return `
        <div class="lesson-screen lesson-screen-movement-practice">

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Movement Practice</h1>

            <p id="movementPracticeInstruction" class="lesson-instruction">
              Move to the cow.
            </p>
          </div>

          <div class="movement-practice-board" id="movementPracticeArea">

            <div class="direction-target practice-target direction-up" data-direction="up">
              <span class="direction-animal">🐄</span>
              <strong>UP</strong>
            </div>

            <div class="direction-target practice-target direction-right" data-direction="right">
              <span class="direction-animal">🐕</span>
              <strong>RIGHT</strong>
            </div>

            <div class="direction-target practice-target direction-down" data-direction="down">
              <span class="direction-animal">🐈</span>
              <strong>DOWN</strong>
            </div>

            <div class="direction-target practice-target direction-left" data-direction="left">
              <span class="direction-animal">🐖</span>
              <strong>LEFT</strong>
            </div>

            <div id="movementPracticePointer" class="pointer-demo-icon">➤</div>

          </div>

          <p id="movementPracticeStatus" class="lesson-coaching">
            Follow the directions.
          </p>

        </div>
      `;
    }

    if (step.id === "move-the-mouse") {
      return `
        <div class="lesson-screen lesson-screen-move-mouse">

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Move the Mouse</h1>

            <p class="lesson-instruction">
              Move the mouse up, down, left, and right.
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
              <div id="pointerPracticeArea" class="pointer-practice-area direction-practice-area">

                <div class="direction-target direction-up">
                  <span class="direction-animal">🐄</span>
                  <strong>UP</strong>
                </div>

                <div class="direction-target direction-right">
                  <span class="direction-animal">🐕</span>
                  <strong>RIGHT</strong>
                </div>

                <div class="direction-target direction-down">
                  <span class="direction-animal">🐈</span>
                  <strong>DOWN</strong>
                </div>

                <div class="direction-target direction-left">
                  <span class="direction-animal">🐖</span>
                  <strong>LEFT</strong>
                </div>

                <div id="lessonDemoPointer" class="pointer-demo-icon">➤</div>
              </div>

              <p>Move the Pointer</p>
            </div>

          </div>

          <p class="lesson-coaching">
            Try moving slowly in every direction.
          </p>

        </div>
      `;
    }

    if (step.id === "hold-the-mouse") {
      return `
        <div class="lesson-screen lesson-screen-hold-mouse">

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>How to Hold the Mouse</h1>

            <p class="lesson-instruction">
              Rest your hand gently on the mouse.
            </p>
          </div>

          <div class="hold-mouse-demo">

            <div class="hold-mouse-visual">
              <div class="mouse-demo-hand hold-mouse-hand">
                <div class="mouse-demo-palm highlight-palm"></div>
                <div class="mouse-demo-finger mouse-demo-index highlight-pointer"></div>
                <div class="mouse-demo-finger mouse-demo-middle highlight-middle"></div>
                <div class="mouse-demo-finger mouse-demo-pinky highlight-other"></div>
              </div>

              <div class="mouse-demo-body">
                <div class="mouse-demo-left"></div>
                <div class="mouse-demo-right"></div>
                <div class="mouse-demo-wheel"></div>
              </div>
            </div>

            <div class="finger-guide">
              <div class="finger-guide-item">
                <span class="finger-number">1</span>
                <span>Thumb rests on the side</span>
              </div>

              <div class="finger-guide-item">
                <span class="finger-number">2</span>
                <span>Pointer finger rests on the left button</span>
              </div>

              <div class="finger-guide-item">
                <span class="finger-number">3</span>
                <span>Middle finger rests on the right button</span>
              </div>

              <div class="finger-guide-item">
                <span class="finger-number">4–5</span>
                <span>Other fingers rest along the side</span>
              </div>
            </div>

          </div>

          <p class="lesson-coaching">
            Keep your hand relaxed. You do not need to squeeze the mouse.
          </p>

        </div>
      `;
    }

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
  let movementSound = null;
  let movementSoundStopTimer = null;
  let soundEnabled = true;


  function stopStepBehavior() {
    if (removeMeetMouseMovementListener) {
      removeMeetMouseMovementListener();
      removeMeetMouseMovementListener = null;
    }

    if (removeMovementPracticeListener) {
      removeMovementPracticeListener();
      removeMovementPracticeListener = null;
    }

    if (removeLeftClickListener) {
      removeLeftClickListener();
      removeLeftClickListener = null;
    }
  }

  async function loadSoundSetting() {
    try {
      const response = await fetch("/api/settings");

      if (!response.ok) {
        return;
      }

      const settings = await response.json();
      soundEnabled = settings.soundEnabled !== false;
    } catch (error) {
      console.error("Could not load sound setting:", error);
    }
  }

  function startMovementSound() {
    if (!soundEnabled) {
      return;
    }

    if (!movementSound) {
      movementSound = new Audio("/sounds/swoosh.mp3");
      movementSound.loop = true;
      movementSound.volume = 0.35;
    }

    clearTimeout(movementSoundStopTimer);

    if (movementSound.paused) {
      movementSound.play().catch(() => {});
    }

    movementSoundStopTimer = setTimeout(() => {
      if (movementSound) {
        movementSound.pause();
        movementSound.currentTime = 0;
      }
    }, 180);
  }

  function startMeetMouseBehavior() {
    const input = window.HandsOnMouseInput;
    const area = document.getElementById("pointerPracticeArea");
    const pointer = document.getElementById("lessonDemoPointer");
    const mouseVisual = document.getElementById("lessonMouseMovement");

    if (!input || !area || !pointer || !mouseVisual) {
      return;
    }

    let pointerX = 0;
    let pointerY = 0;

    let visualX = 0;
    let visualY = 0;
    let targetVisualX = 0;
    let targetVisualY = 0;
    let animationFrame = null;

    function positionPointer() {
      const tipOffsetX = pointer.offsetWidth * 0.72;
      const tipOffsetY = pointer.offsetHeight * 0.72;

      const minX = -tipOffsetX;
      const minY = -tipOffsetY;

      const maxX = area.clientWidth - tipOffsetX;
      const extraDownReach = 30;
      const maxY =
        area.clientHeight - tipOffsetY + extraDownReach;

      pointerX = Math.min(Math.max(pointerX, minX), maxX);
      pointerY = Math.min(Math.max(pointerY, minY), maxY);

      pointer.style.left = `${pointerX}px`;
      pointer.style.top = `${pointerY}px`;
    }

    function centerPointer() {
      const tipOffsetX = pointer.offsetWidth * 0.72;
      const tipOffsetY = pointer.offsetHeight * 0.72;

      pointerX = area.clientWidth / 2 - tipOffsetX;
      pointerY = area.clientHeight / 2 - tipOffsetY;

      positionPointer();
    }

    centerPointer();

    removeMeetMouseMovementListener = input.subscribe("move", (event) => {
      mouseVisual.classList.add("has-mouse-movement");

      startMovementSound();

      const areaRect = area.getBoundingClientRect();

      const tipOffsetX = pointer.offsetWidth * 0.72;
      const tipOffsetY = pointer.offsetHeight * 0.72;

      pointerX =
        event.x - areaRect.left - tipOffsetX;

      pointerY =
        event.y - areaRect.top - tipOffsetY;

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

  let removeMovementPracticeListener = null;
  let removeLeftClickListener = null;
  let leftClickSound = null;


  function startMovementPracticeBehavior() {
    const input = window.HandsOnMouseInput;
    const area = document.getElementById("movementPracticeArea");
    const pointer = document.getElementById("movementPracticePointer");
    const instruction = document.getElementById("movementPracticeInstruction");
    const status = document.getElementById("movementPracticeStatus");

    if (!input || !area || !pointer || !instruction || !status) {
      return;
    }

    const directions = [
      { id: "up", label: "cow" },
      { id: "down", label: "cat" },
      { id: "left", label: "pig" },
      { id: "right", label: "dog" }
    ];

    let directionIndex = 0;

    let pointerX = 0;
    let pointerY = 0;

    function positionPointer() {
      const maxX = Math.max(area.clientWidth - pointer.offsetWidth, 0);
      const maxY = Math.max(area.clientHeight - pointer.offsetHeight, 0);

      pointerX = Math.min(Math.max(pointerX, 0), maxX);
      pointerY = Math.min(Math.max(pointerY, 0), maxY);

      pointer.style.left = `${pointerX}px`;
      pointer.style.top = `${pointerY}px`;
    }

    function centerPointer() {
      const maxX = Math.max(area.clientWidth - pointer.offsetWidth, 0);
      const maxY = Math.max(area.clientHeight - pointer.offsetHeight, 0);

      pointerX = maxX / 2;
      pointerY = maxY / 2;

      positionPointer();
    }

    function updateInstruction() {
      const current = directions[directionIndex];

      instruction.textContent =
        `Move to the ${current.label}.`;

      document.querySelectorAll(".practice-target").forEach((target) => {
        target.classList.toggle(
          "active-practice-target",
          target.dataset.direction === current.id
        );
      });
    }

    function checkTarget() {
      const current = directions[directionIndex];
      const target = document.querySelector(
        `.practice-target[data-direction="${current.id}"]`
      );

      if (!target) {
        return;
      }

      const pointerRect = pointer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const pointerTipX =
        pointerRect.left + pointerRect.width * 0.72;

      const pointerTipY =
        pointerRect.top + pointerRect.height * 0.72;

      const hit =
        pointerTipX >= targetRect.left &&
        pointerTipX <= targetRect.right &&
        pointerTipY >= targetRect.top &&
        pointerTipY <= targetRect.bottom;

      if (!hit) {
        return;
      }

      status.textContent = "Great job!";

      directionIndex += 1;

      if (directionIndex >= directions.length) {
        status.textContent = "You moved in every direction!";
        instruction.textContent = "Movement practice complete!";
        return;
      }

      updateInstruction();
    }

    centerPointer();
    updateInstruction();

    removeMovementPracticeListener = input.subscribe("move", (event) => {
      const areaRect = area.getBoundingClientRect();

      const tipOffsetX = pointer.offsetWidth * 0.72;
      const tipOffsetY = pointer.offsetHeight * 0.72;

      pointerX =
        event.x - areaRect.left - tipOffsetX;

      pointerY =
        event.y - areaRect.top - tipOffsetY;

      positionPointer();
      startMovementSound();
      checkTarget();
    });
  }

  function startLeftClickBehavior() {
    const input = window.HandsOnMouseInput;
    const finger = document.getElementById("leftClickFinger");
    const button = document.getElementById("leftClickButtonVisual");
    const status = document.getElementById("leftClickStatus");

    if (!input || !finger || !button || !status) {
      return;
    }

    removeLeftClickListener = input.subscribe("leftDown", () => {
      finger.classList.add("left-click-pressed");
      button.classList.add("left-click-button-pressed");

      status.textContent = "Great click!";

      if (soundEnabled) {
        if (!leftClickSound) {
          leftClickSound = new Audio("/sounds/mouseclick.mp3");
          leftClickSound.volume = 0.5;
        }

        leftClickSound.currentTime = 0;
        leftClickSound.play().catch(() => {});
      }

      setTimeout(() => {
        finger.classList.remove("left-click-pressed");
        button.classList.remove("left-click-button-pressed");
      }, 180);
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

    if (
      step.id === "meet-the-mouse" ||
      step.id === "move-the-mouse"
    ) {
      startMeetMouseBehavior();
    }

    if (step.id === "movement-practice") {
      startMovementPracticeBehavior();
    }

    if (step.id === "left-click") {
      startLeftClickBehavior();
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

  function updateFingerHighlight(value) {
    const hand = document.querySelector(".hold-mouse-hand");

    if (!hand) {
      return;
    }

    hand.dataset.highlight = value || "";
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

      if (isTeacher) {
        if (
          currentMode !== "teacher-view" ||
          currentDisplayedStep !== (state.currentLessonStep ?? 0)
        ) {
          currentMode = "teacher-view";
          renderStep(state.currentLessonStep ?? 0, "teacher");
        }
      } else if (mode === "teacher") {
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

      updateFingerHighlight(state.fingerHighlight);
    } catch (error) {
      console.error("Student lesson controller:", error);
    }
  }

  loadSoundSetting();
  syncLessonState();
  setInterval(syncLessonState, 1000);
})();

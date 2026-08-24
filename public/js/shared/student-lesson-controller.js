(() => {
  const teacherSession = window.HandsOnMouseTeacherSession;
  const isTeacher =
    teacherSession && teacherSession.isTeacherSession();

  let lesson = window.HandsOnMouseLessons?.week1;

  if (!lesson || !Array.isArray(lesson.steps)) {
    console.error("Student lesson controller: lesson definition missing.");
    return;
  }

  const INDEPENDENT_STEP_KEY = "handsOnMouseIndependentStep";

  let currentDisplayedStep = -1;
  let currentDisplayedLessonId = "week1";
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
    if (step.id === "review-week1") {
      return `
        <div class="lesson-screen lesson-screen-review-board">

          <div class="review-board-heading">
            <span class="review-board-badge">QUICK REVIEW</span>
            <h1>Show What You Remember!</h1>
          </div>

          <div class="review-board-grid">

            <section class="review-card review-card-hand">

              <div class="review-card-number">1</div>

              <div class="review-card-visual">
                <div class="hold-mouse-visual review-hand-visual">

                  <div class="mouse-demo-hand hold-mouse-hand">
                    <div class="mouse-demo-palm"></div>
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
              </div>

              <h2>Hold the Mouse</h2>
              <p>Show where your fingers belong.</p>

            </section>

            <section class="review-card review-card-move">

              <div class="review-card-number">2</div>

              <div id="reviewMoveArea" class="review-move-area">

                <div class="review-direction review-up">
                  <span>🐄</span>
                  <strong>UP</strong>
                </div>

                <div class="review-direction review-right">
                  <span>🐕</span>
                  <strong>RIGHT</strong>
                </div>

                <div class="review-direction review-down">
                  <span>🐈</span>
                  <strong>DOWN</strong>
                </div>

                <div class="review-direction review-left">
                  <span>🐖</span>
                  <strong>LEFT</strong>
                </div>

                <div
                  id="reviewMovePointer"
                  class="pointer-demo-icon"
                >
                  ➤
                </div>

              </div>

              <h2>Move the Mouse</h2>
              <p>Move the pointer where I tell you.</p>

            </section>

            <section class="review-card review-card-click">

              <div class="review-card-number">3</div>

              <div id="reviewClickArea" class="review-click-area">

                <button
                  id="reviewClickTarget"
                  class="review-click-target"
                  type="button"
                >
                  ★
                </button>

                <div
                  id="reviewClickPointer"
                  class="pointer-demo-icon"
                >
                  ➤
                </div>

              </div>

              <h2>Move & Left Click</h2>
              <p>Point to the star and click once.</p>

            </section>

          </div>

        </div>
      `;
    }

    if (step.id === "complete") {
      return `
        <div class="lesson-screen lesson-screen-complete">

          <div class="lesson-complete-content">

            <div class="lesson-complete-badge">
              ★
            </div>

            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Mouse Master!</h1>

            <p class="lesson-complete-message">
              You finished your first mouse lesson!
            </p>

            <div class="lesson-complete-skills">

              <div class="complete-skill">
                <span class="complete-skill-icon">↔</span>
                <strong>Move</strong>
              </div>

              <div class="complete-skill">
                <span class="complete-skill-icon">➤</span>
                <strong>Point</strong>
              </div>

              <div class="complete-skill">
                <span class="complete-skill-icon">☝</span>
                <strong>Left Click</strong>
              </div>

            </div>

            <p class="lesson-complete-footer">
              Great job using the mouse!
            </p>

          </div>

        </div>
      `;
    }

    if (step.id === "guided-practice") {
      return `
        <div class="lesson-screen lesson-screen-mouse-challenge">

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Mouse Challenge</h1>

            <p class="lesson-instruction">
              Move to each target and left-click once.
            </p>
          </div>

          <div id="mouseChallengeArea" class="mouse-challenge-area">

            <button
              id="mouseChallengeTarget"
              class="mouse-challenge-target"
              type="button"
            >
              ★
            </button>

            <div
              id="mouseChallengePointer"
              class="pointer-demo-icon"
            >
              ➤
            </div>

          </div>

          <div id="mouseChallengeProgress" class="mouse-challenge-progress">
            0 of 5
          </div>

          <p id="mouseChallengeStatus" class="lesson-coaching">
            Find the first target.
          </p>

        </div>
      `;
    }

    if (step.id === "move-and-click") {
      return `
        <div class="lesson-screen lesson-screen-move-and-click">

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Move & Click</h1>

            <p class="lesson-instruction">
              Move to the target. Then left-click once.
            </p>
          </div>

          <div id="moveClickArea" class="move-click-area">

            <button
              id="moveClickTarget"
              class="move-click-target"
              type="button"
            >
              ★
            </button>

            <div
              id="moveClickPointer"
              class="pointer-demo-icon"
            >
              ➤
            </div>

          </div>

          <div class="click-practice-progress">
            <span id="moveClickDot1" class="click-practice-dot"></span>
            <span id="moveClickDot2" class="click-practice-dot"></span>
            <span id="moveClickDot3" class="click-practice-dot"></span>
          </div>

          <p id="moveClickStatus" class="lesson-coaching">
            Find the target.
          </p>

        </div>
      `;
    }

    if (step.id === "left-click-practice") {
      return `
        <div class="lesson-screen lesson-screen-left-click-practice">

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Left-Click Practice</h1>

            <p class="lesson-instruction">
              Point to the target and left-click.
            </p>
          </div>

          <div class="left-click-practice-area">

            <button
              id="leftClickPracticeTarget"
              class="left-click-practice-target"
              type="button"
            >
              ★
            </button>

          </div>

          <div class="click-practice-progress">
            <span id="clickPracticeDot1" class="click-practice-dot"></span>
            <span id="clickPracticeDot2" class="click-practice-dot"></span>
            <span id="clickPracticeDot3" class="click-practice-dot"></span>
          </div>

          <p id="leftClickPracticeStatus" class="lesson-coaching">
            Click the star 3 times.
          </p>

        </div>
      `;
    }

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
  let removeMovementPracticeListener = null;
  let removeLeftClickListener = null;
  let removeLeftClickPracticeListener = null;
  let removeWrongButtonListener = null;
  let movementSound = null;
  let movementSoundStopTimer = null;
  let soundEnabled = true;
  let leftClickSound = null;


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

    if (removeLeftClickPracticeListener) {
      removeLeftClickPracticeListener();
      removeLeftClickPracticeListener = null;
    }

    if (removeWrongButtonListener) {
      removeWrongButtonListener();
      removeWrongButtonListener = null;
    }

    if (removeMoveClickMoveListener) {
      removeMoveClickMoveListener();
      removeMoveClickMoveListener = null;
    }

    if (removeMoveClickLeftListener) {
      removeMoveClickLeftListener();
      removeMoveClickLeftListener = null;
    }

    if (removeMoveClickRightListener) {
      removeMoveClickRightListener();
      removeMoveClickRightListener = null;
    }

    if (removeMouseChallengeMoveListener) {
      removeMouseChallengeMoveListener();
      removeMouseChallengeMoveListener = null;
    }

    if (removeMouseChallengeLeftListener) {
      removeMouseChallengeLeftListener();
      removeMouseChallengeLeftListener = null;
    }

    if (removeMouseChallengeRightListener) {
      removeMouseChallengeRightListener();
      removeMouseChallengeRightListener = null;
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

    removeMeetMouseMovementListener =
      input.subscribe("move", (event) => {
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

        targetVisualX += event.movementX * 0.7;
        targetVisualY += event.movementY * 0.7;

        targetVisualX = Math.max(
          -80,
          Math.min(80, targetVisualX)
        );

        targetVisualY = Math.max(
          -55,
          Math.min(55, targetVisualY)
        );

        if (!animationFrame) {
          const animateVisualMouse = () => {
            visualX +=
              (targetVisualX - visualX) * 0.16;

            visualY +=
              (targetVisualY - visualY) * 0.16;

            mouseVisual.style.transform =
              `translate3d(${visualX}px, ${visualY}px, 0)`;

            const stillMoving =
              Math.abs(targetVisualX - visualX) > 0.2 ||
              Math.abs(targetVisualY - visualY) > 0.2;

            if (stillMoving) {
              animationFrame =
                requestAnimationFrame(
                  animateVisualMouse
                );
            } else {
              animationFrame = null;
            }
          };

          animationFrame =
            requestAnimationFrame(
              animateVisualMouse
            );
        }
      });
  }

  function startMovementPracticeBehavior() {
    const input = window.HandsOnMouseInput;
    const area = document.getElementById("movementPracticeArea");
    const pointer = document.getElementById("movementPracticePointer");
    const instruction =
      document.getElementById("movementPracticeInstruction");
    const status =
      document.getElementById("movementPracticeStatus");

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
      const tipOffsetX = pointer.offsetWidth * 0.72;
      const tipOffsetY = pointer.offsetHeight * 0.72;

      const minX = -tipOffsetX;
      const minY = -tipOffsetY;

      const maxX = area.clientWidth - tipOffsetX;
      const maxY = area.clientHeight - tipOffsetY;

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

    function updateInstruction() {
      const current = directions[directionIndex];

      instruction.textContent =
        `Move to the ${current.label}.`;

      document
        .querySelectorAll(".practice-target")
        .forEach((target) => {
          target.classList.toggle(
            "active-practice-target",
            target.dataset.direction === current.id
          );
        });
    }

    function checkTarget() {
      if (directionIndex >= directions.length) {
        return;
      }

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

      directionIndex += 1;

      if (directionIndex >= directions.length) {
        status.textContent =
          "You moved in every direction!";

        instruction.textContent =
          "Movement practice complete!";

        document
          .querySelectorAll(".practice-target")
          .forEach((target) => {
            target.classList.remove(
              "active-practice-target"
            );
          });

        return;
      }

      status.textContent = "Great job!";
      updateInstruction();
    }

    centerPointer();
    updateInstruction();

    removeMovementPracticeListener =
      input.subscribe("move", (event) => {
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

  function attachLeftClickCoaching({
    input,
    onWrongButton,
    onFastClick
  }) {
    const cleanup = [];

    if (input && typeof onWrongButton === "function") {
      cleanup.push(
        input.subscribe("rightDown", () => {
          showWrongButtonWarning();
          onWrongButton();
        })
      );
    }

    return () => {
      cleanup.forEach((removeListener) => {
        removeListener();
      });
    };
  }

  let removeMoveClickMoveListener = null;
  let removeMoveClickLeftListener = null;
  let removeMoveClickRightListener = null;

  let removeMouseChallengeMoveListener = null;
  let removeMouseChallengeLeftListener = null;
  let removeMouseChallengeRightListener = null;

  function startMouseChallengeBehavior() {
    const input = window.HandsOnMouseInput;
    const area = document.getElementById("mouseChallengeArea");
    const pointer = document.getElementById("mouseChallengePointer");
    const target = document.getElementById("mouseChallengeTarget");
    const status = document.getElementById("mouseChallengeStatus");
    const progress = document.getElementById("mouseChallengeProgress");

    if (!input || !area || !pointer || !target || !status || !progress) {
      return;
    }

    const positions = [
      { x: 18, y: 20 },
      { x: 80, y: 22 },
      { x: 22, y: 72 },
      { x: 76, y: 70 },
      { x: 50, y: 48 }
    ];

    let completedTargets = 0;
    let pendingClickTimer = null;
    let nextAllowedClickTime = 0;

    const DOUBLE_CLICK_WINDOW = 450;
    const CLICK_WAIT_TIME = 1000;

    function updateProgress() {
      progress.textContent =
        `${completedTargets} of ${positions.length}`;
    }

    function positionTarget() {
      if (completedTargets >= positions.length) {
        return;
      }

      const position = positions[completedTargets];

      target.style.left = `${position.x}%`;
      target.style.top = `${position.y}%`;
    }

    function pointerIsOnTarget() {
      const pointerRect = pointer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const pointerTipX =
        pointerRect.left + pointerRect.width * 0.72;

      const pointerTipY =
        pointerRect.top + pointerRect.height * 0.72;

      return (
        pointerTipX >= targetRect.left &&
        pointerTipX <= targetRect.right &&
        pointerTipY >= targetRect.top &&
        pointerTipY <= targetRect.bottom
      );
    }

    function resetChallenge() {
      completedTargets = 0;
      nextAllowedClickTime = 0;

      if (pendingClickTimer) {
        clearTimeout(pendingClickTimer);
        pendingClickTimer = null;
      }

      updateProgress();
      positionTarget();

      status.textContent =
        "Start again. Click once, then wait.";

      showClickWarning();
    }

    removeMouseChallengeMoveListener =
      input.subscribe("move", (event) => {
        const areaRect = area.getBoundingClientRect();

        const tipOffsetX = pointer.offsetWidth * 0.72;
        const tipOffsetY = pointer.offsetHeight * 0.72;

        pointer.style.left =
          `${event.x - areaRect.left - tipOffsetX}px`;

        pointer.style.top =
          `${event.y - areaRect.top - tipOffsetY}px`;

        startMovementSound();
      });

    removeMouseChallengeRightListener =
      input.subscribe("rightDown", () => {
        showWrongButtonWarning();
      });

    removeMouseChallengeLeftListener =
      input.subscribe("leftDown", () => {
        if (completedTargets >= positions.length) {
          return;
        }

        if (!pointerIsOnTarget()) {
          status.textContent =
            "Move onto the target before you click.";
          return;
        }

        const now = Date.now();

        if (
          pendingClickTimer ||
          now < nextAllowedClickTime
        ) {
          resetChallenge();
          return;
        }

        status.textContent = "Wait...";

        pendingClickTimer = setTimeout(() => {
          pendingClickTimer = null;

          if (soundEnabled) {
            if (!leftClickSound) {
              leftClickSound =
                new Audio("/sounds/mouseclick.mp3");
              leftClickSound.volume = 0.5;
            }

            leftClickSound.currentTime = 0;
            leftClickSound.play().catch(() => {});
          }

          completedTargets += 1;

          nextAllowedClickTime =
            Date.now() + CLICK_WAIT_TIME;

          updateProgress();

          if (completedTargets >= positions.length) {
            status.textContent =
              "Mouse Challenge complete!";

            target.textContent = "✓";

            if (!isTeacher) {
              sessionStorage.setItem(
                "handsOnMouseWeek1Complete",
                "true"
              );

              setTimeout(() => {
                renderStep(
                  lesson.steps.length - 1,
                  "teacher"
                );
              }, 700);
            }

            return;
          }

          status.textContent =
            "Great! Find the next target.";

          positionTarget();
        }, DOUBLE_CLICK_WINDOW);
      });

    positionTarget();
    updateProgress();
  }

  function startMoveAndClickBehavior() {
    const input = window.HandsOnMouseInput;
    const area = document.getElementById("moveClickArea");
    const pointer = document.getElementById("moveClickPointer");
    const target = document.getElementById("moveClickTarget");
    const status = document.getElementById("moveClickStatus");

    if (!input || !area || !pointer || !target || !status) {
      return;
    }

    const positions = [
      { x: 20, y: 25 },
      { x: 78, y: 28 },
      { x: 50, y: 72 }
    ];

    let completedTargets = 0;
    let pendingClickTimer = null;
    let nextAllowedClickTime = 0;

    const DOUBLE_CLICK_WINDOW = 450;
    const CLICK_WAIT_TIME = 1000;

    function updateProgress() {
      for (let i = 1; i <= 3; i += 1) {
        const dot = document.getElementById(`moveClickDot${i}`);

        if (dot) {
          dot.classList.toggle(
            "complete",
            i <= completedTargets
          );
        }
      }
    }

    function positionTarget() {
      if (completedTargets >= positions.length) {
        return;
      }

      const position = positions[completedTargets];

      target.style.left = `${position.x}%`;
      target.style.top = `${position.y}%`;
    }

    function pointerIsOnTarget() {
      const pointerRect = pointer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const pointerTipX =
        pointerRect.left + pointerRect.width * 0.72;

      const pointerTipY =
        pointerRect.top + pointerRect.height * 0.72;

      return (
        pointerTipX >= targetRect.left &&
        pointerTipX <= targetRect.right &&
        pointerTipY >= targetRect.top &&
        pointerTipY <= targetRect.bottom
      );
    }

    function resetForFastClick() {
      completedTargets = 0;
      nextAllowedClickTime = 0;

      if (pendingClickTimer) {
        clearTimeout(pendingClickTimer);
        pendingClickTimer = null;
      }

      updateProgress();
      positionTarget();

      status.textContent =
        "Start again. Click once, then wait.";

      showClickWarning();
    }

    removeMoveClickMoveListener =
      input.subscribe("move", (event) => {
        const areaRect = area.getBoundingClientRect();

        const tipOffsetX = pointer.offsetWidth * 0.72;
        const tipOffsetY = pointer.offsetHeight * 0.72;

        pointer.style.left =
          `${event.x - areaRect.left - tipOffsetX}px`;

        pointer.style.top =
          `${event.y - areaRect.top - tipOffsetY}px`;

        startMovementSound();
      });

    removeMoveClickRightListener =
      input.subscribe("rightDown", () => {
        showWrongButtonWarning();
      });

    removeMoveClickLeftListener =
      input.subscribe("leftDown", () => {
        if (completedTargets >= positions.length) {
          return;
        }

        if (!pointerIsOnTarget()) {
          status.textContent =
            "Move onto the target before you click.";
          return;
        }

        const now = Date.now();

        if (
          pendingClickTimer ||
          now < nextAllowedClickTime
        ) {
          resetForFastClick();
          return;
        }

        status.textContent = "Wait...";

        pendingClickTimer = setTimeout(() => {
          pendingClickTimer = null;

          if (soundEnabled) {
            if (!leftClickSound) {
              leftClickSound =
                new Audio("/sounds/mouseclick.mp3");
              leftClickSound.volume = 0.5;
            }

            leftClickSound.currentTime = 0;
            leftClickSound.play().catch(() => {});
          }

          completedTargets += 1;

          nextAllowedClickTime =
            Date.now() + CLICK_WAIT_TIME;

          updateProgress();

          if (completedTargets >= positions.length) {
            status.textContent =
              "Move & Click complete!";

            target.textContent = "✓";
            return;
          }

          status.textContent =
            "Great click! Find the next target.";

          positionTarget();
        }, DOUBLE_CLICK_WINDOW);
      });

    positionTarget();
    updateProgress();
  }

  let clickWarningTimer = null;

  function showClickWarning() {
    let warning =
      document.getElementById("clickTooFastWarning");

    if (!warning) {
      warning = document.createElement("div");
      warning.id = "clickTooFastWarning";

      warning.innerHTML = `
        <div class="click-too-fast-popup-card">
          <div class="click-too-fast-icon">✋</div>

          <div class="click-too-fast-message">
            <strong>Slow Down!</strong>
            <span>Click once, then wait.</span>
          </div>
        </div>
      `;

      document.body.appendChild(warning);
    }

    warning.classList.remove("show");

    void warning.offsetWidth;

    warning.classList.add("show");

    if (soundEnabled) {
      const mistakeSound =
        new Audio("/sounds/mistake.mp3");

      mistakeSound.volume = 0.6;
      mistakeSound.play().catch(() => {});
    }

    clearTimeout(clickWarningTimer);

    clickWarningTimer = setTimeout(() => {
      warning.classList.remove("show");
    }, 1400);
  }

  function startLeftClickPracticeBehavior() {
    const input = window.HandsOnMouseInput;
    const target = document.getElementById("leftClickPracticeTarget");
    const status = document.getElementById("leftClickPracticeStatus");

    if (!input || !target || !status) {
      return;
    }

    let correctClicks = 0;
    let pendingClickTimer = null;
    let nextAllowedClickTime = 0;

    const DOUBLE_CLICK_WINDOW = 450;
    const CLICK_WAIT_TIME = 1000;

    function updateProgress() {
      for (let i = 1; i <= 3; i += 1) {
        const dot = document.getElementById(
          `clickPracticeDot${i}`
        );

        if (dot) {
          dot.classList.toggle(
            "complete",
            i <= correctClicks
          );
        }
      }
    }

    function resetForFastClick() {
      correctClicks = 0;
      nextAllowedClickTime = 0;

      if (pendingClickTimer) {
        clearTimeout(pendingClickTimer);
        pendingClickTimer = null;
      }

      updateProgress();

      status.textContent =
        "Too fast! Start again. Click once, then wait.";

      target.classList.remove("clicked");
      target.classList.remove("clicked-too-fast");

      requestAnimationFrame(() => {
        target.classList.add("clicked-too-fast");
      });

      showClickWarning();
    }

    removeWrongButtonListener =
      input.subscribe("rightDown", () => {
        showWrongButtonWarning();
      });

    removeLeftClickPracticeListener =
      input.subscribe("leftDown", (event) => {
        if (correctClicks >= 3) {
          return;
        }

        const targetRect = target.getBoundingClientRect();

        const hit =
          event.x >= targetRect.left &&
          event.x <= targetRect.right &&
          event.y >= targetRect.top &&
          event.y <= targetRect.bottom;

        if (!hit) {
          status.textContent = "Point to the star first.";
          return;
        }

        const now = Date.now();

        /*
         * If a second click arrives while the first click
         * is still waiting to be confirmed, treat both as
         * a double-click mistake.
         */
        if (pendingClickTimer) {
          resetForFastClick();
          return;
        }

        /*
         * Even after a click is confirmed, require the
         * student to wait before beginning another click.
         */
        if (now < nextAllowedClickTime) {
          resetForFastClick();
          return;
        }

        status.textContent = "Wait...";

        pendingClickTimer = setTimeout(() => {
          pendingClickTimer = null;

          correctClicks += 1;

          nextAllowedClickTime =
            Date.now() + CLICK_WAIT_TIME;

          target.classList.remove("clicked-too-fast");
          target.classList.remove("clicked");

          requestAnimationFrame(() => {
            target.classList.add("clicked");
          });

          if (soundEnabled) {
            if (!leftClickSound) {
              leftClickSound =
                new Audio("/sounds/mouseclick.mp3");
              leftClickSound.volume = 0.5;
            }

            leftClickSound.currentTime = 0;
            leftClickSound.play().catch(() => {});
          }

          updateProgress();

          if (correctClicks >= 3) {
            status.textContent =
              "Click practice complete!";
            target.textContent = "✓";
          } else {
            status.textContent =
              "Great click! Wait... then click again.";
          }
        }, DOUBLE_CLICK_WINDOW);
      });

    updateProgress();
  }

  let wrongButtonWarningTimer = null;

  function showWrongButtonWarning() {
    const hand =
      document.querySelector(".left-click-hand") ||
      document.querySelector(".hold-mouse-hand");

    const middleFinger =
      hand?.querySelector(".mouse-demo-middle");

    const mouseBody =
      hand?.nextElementSibling;

    const rightButton =
      mouseBody?.querySelector(".mouse-demo-right");

    let warning =
      document.getElementById("wrongButtonWarning");

    if (!warning) {
      warning = document.createElement("div");
      warning.id = "wrongButtonWarning";

      warning.innerHTML = `
        <div class="wrong-button-warning-card">

          <div class="wrong-button-warning-visual">
            <div class="wrong-warning-hand-wrap">

              <div class="mouse-demo-hand wrong-warning-hand">
                <div class="mouse-demo-palm"></div>
                <div class="mouse-demo-finger mouse-demo-index"></div>
                <div class="mouse-demo-finger mouse-demo-middle wrong-warning-middle"></div>
                <div class="mouse-demo-finger mouse-demo-pinky"></div>
              </div>

              <div class="mouse-demo-body wrong-warning-mouse">
                <div class="mouse-demo-left"></div>
                <div class="mouse-demo-right wrong-warning-right-button"></div>
                <div class="mouse-demo-wheel"></div>
              </div>

            </div>
          </div>

          <div class="wrong-button-warning-message">
            <strong>Wrong Button!</strong>
            <span>Use your pointer finger on the LEFT button.</span>
          </div>

        </div>
      `;

      document.body.appendChild(warning);
    }

    hand?.classList.add("wrong-button-hand-pop");
    middleFinger?.classList.add("wrong-button-finger");
    rightButton?.classList.add("wrong-button-mouse-button");
    warning.classList.add("show");

    if (soundEnabled) {
      const mistakeSound =
        new Audio("/sounds/wrongclick.mp3");

      mistakeSound.volume = 0.6;
      mistakeSound.play().catch(() => {});
    }

    clearTimeout(wrongButtonWarningTimer);

    wrongButtonWarningTimer = setTimeout(() => {
      hand?.classList.remove("wrong-button-hand-pop");
      middleFinger?.classList.remove("wrong-button-finger");
      rightButton?.classList.remove("wrong-button-mouse-button");
      warning.classList.remove("show");
    }, 1100);
  }

  function startLeftClickBehavior() {
    const input = window.HandsOnMouseInput;
    const finger = document.getElementById("leftClickFinger");
    const button = document.getElementById("leftClickButtonVisual");
    const status = document.getElementById("leftClickStatus");

    if (!input || !finger || !button || !status) {
      return;
    }

    removeWrongButtonListener =
      input.subscribe("rightDown", () => {
        showWrongButtonWarning();
      });

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

    if (step.id === "left-click-practice") {
      startLeftClickPracticeBehavior();
    }

    if (step.id === "move-and-click") {
      startMoveAndClickBehavior();
    }

    if (step.id === "guided-practice") {
      startMouseChallengeBehavior();
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

      const requestedLessonId =
        state.activeLesson || "week1";

      const requestedLesson =
        window.HandsOnMouseLessons?.[requestedLessonId];

      if (
        requestedLesson &&
        Array.isArray(requestedLesson.steps)
      ) {
        lesson = requestedLesson;
      }

      const lessonChanged =
        requestedLessonId !== currentDisplayedLessonId;

      if (isTeacher) {
        const menu =
          document.getElementById("teacherLessonMenu");

        if (menu && !menu.hidden) {
          return;
        }
      }

      showLessonView();

      const sharedStep =
        state.currentLessonStep ?? 0;

      if (isTeacher) {
        if (
          currentMode !== "teacher-view" ||
          lessonChanged ||
          currentDisplayedStep !== sharedStep
        ) {
          currentMode = "teacher-view";
          currentDisplayedLessonId = requestedLessonId;
          renderStep(sharedStep, "teacher");
        }

      } else if (mode === "teacher") {

        /*
         * Week 1 has the special behavior where a student
         * who finishes Step 9 can independently remain on
         * Step 10 while the teacher stays on Step 9.
         *
         * Review lessons should not inherit that behavior.
         */
        if (requestedLessonId === "week1") {
          const week1Complete =
            sessionStorage.getItem(
              "handsOnMouseWeek1Complete"
            ) === "true";

          const challengeStep =
            lesson.steps.findIndex(
              step => step.id === "guided-practice"
            );

          const completeStep =
            lesson.steps.findIndex(
              step => step.id === "complete"
            );

          if (
            week1Complete &&
            sharedStep === challengeStep
          ) {
            if (
              currentMode !== "student-complete" ||
              lessonChanged ||
              currentDisplayedStep !== completeStep
            ) {
              currentMode = "student-complete";
              currentDisplayedLessonId =
                requestedLessonId;

              renderStep(
                completeStep,
                "teacher"
              );
            }
          } else {
            if (
              week1Complete &&
              sharedStep < challengeStep
            ) {
              sessionStorage.removeItem(
                "handsOnMouseWeek1Complete"
              );
            }

            if (
              currentMode !== "teacher" ||
              lessonChanged ||
              currentDisplayedStep !== sharedStep
            ) {
              currentMode = "teacher";
              currentDisplayedLessonId =
                requestedLessonId;

              renderStep(
                sharedStep,
                "teacher"
              );
            }
          }

        } else {
          /*
           * Review and future lessons simply follow the
           * teacher's currently selected lesson/step.
           */
          if (
            currentMode !== "teacher" ||
            lessonChanged ||
            currentDisplayedStep !== sharedStep
          ) {
            currentMode = "teacher";
            currentDisplayedLessonId =
              requestedLessonId;

            renderStep(
              sharedStep,
              "teacher"
            );
          }
        }

      } else {
        if (
          currentMode !== "student" ||
          lessonChanged
        ) {
          currentMode = "student";
          currentDisplayedLessonId =
            requestedLessonId;

          renderStep(
            getIndependentStep(),
            "student"
          );
        }
      }

      updateFingerHighlight(
        state.fingerHighlight
      );

    } catch (error) {
      console.error(
        "Student lesson controller:",
        error
      );
    }
  }

  async function loadSoundSetting() {
    try {
      const response = await fetch("/api/settings");

      if (!response.ok) {
        throw new Error("Unable to load sound setting.");
      }

      const settings = await response.json();
      soundEnabled = settings.soundEnabled !== false;
    } catch (error) {
      console.error("Could not load sound setting:", error);
      soundEnabled = true;
    }
  }

  window.addEventListener(
    "handsOnMouseLessonSelected",
    () => {
      currentDisplayedStep = -1;
      syncLessonState();
    }
  );

  loadSoundSetting();
  syncLessonState();
  setInterval(syncLessonState, 1000);
})();

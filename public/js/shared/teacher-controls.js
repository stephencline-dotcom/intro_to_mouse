(() => {
  const session = window.HandsOnMouseTeacherSession;

  if (!session || !session.isTeacherSession()) {
    return;
  }

  if (document.getElementById("globalFreezeButton")) {
    return;
  }

  const button = document.createElement("button");

  button.id = "globalFreezeButton";
  button.type = "button";
  button.textContent = "Freeze";
  button.dataset.armed = "false";

  document.body.appendChild(button);

  const pauseButton = document.createElement("button");
  pauseButton.id = "globalPauseButton";
  pauseButton.type = "button";
  pauseButton.textContent = "Pause";
  pauseButton.dataset.paused = "false";

  document.body.appendChild(pauseButton);

  const lessonControls = document.createElement("div");
  lessonControls.id = "globalLessonControls";

  const backButton = document.createElement("button");
  backButton.id = "globalLessonBackButton";
  backButton.type = "button";
  backButton.textContent = "Back";

  const lessonStepDisplay = document.createElement("span");
  lessonStepDisplay.id = "globalLessonStepDisplay";
  lessonStepDisplay.textContent = "Step 1";

  const nextButton = document.createElement("button");
  nextButton.id = "globalLessonNextButton";
  nextButton.type = "button";
  nextButton.textContent = "Next";

  const controlModeButton = document.createElement("button");
  controlModeButton.id = "globalLessonModeButton";
  controlModeButton.type = "button";
  controlModeButton.textContent = "Mode: Teacher Led";

  lessonControls.appendChild(backButton);
  lessonControls.appendChild(lessonStepDisplay);
  lessonControls.appendChild(nextButton);
  lessonControls.appendChild(controlModeButton);

  document.body.appendChild(lessonControls);
  const homeButton = document.createElement("button");
  homeButton.type = "button";
  homeButton.id = "teacherHomeButton";
  homeButton.textContent = "Home";

  homeButton.addEventListener("click", () => {
    fingerControls.hidden = true;

    const lessonMenu =
      window.HandsOnMouseLessonMenu;

    if (lessonMenu) {
      lessonMenu.show();
    }

    const lessonView =
      document.getElementById("studentLessonView");

    if (lessonView) {
      lessonView.hidden = true;
    }

    const homePage =
      document.querySelector(".home-page");

    if (homePage) {
      homePage.hidden = false;
    }
  });

  lessonControls.appendChild(homeButton);

  const fingerControls = document.createElement("div");
  fingerControls.id = "globalFingerControls";
  fingerControls.hidden = true;

  const fingerChoices = [
    ["thumb", "Thumb"],
    ["pointer", "Pointer"],
    ["middle", "Middle"],
    ["other", "Other Fingers"],
    [null, "Clear"]
  ];

  fingerChoices.forEach(([value, label]) => {
    const fingerButton = document.createElement("button");
    fingerButton.type = "button";
    fingerButton.textContent = label;

    fingerButton.addEventListener("click", async () => {
      await updateLessonState({
        fingerHighlight: value
      });
    });

    fingerControls.appendChild(fingerButton);
  });

  document.body.appendChild(fingerControls);

  const reviewStartButton =
    document.createElement("button");

  reviewStartButton.type = "button";
  reviewStartButton.id = "reviewStartMovementButton";
  reviewStartButton.textContent = "Start Movement";
  reviewStartButton.hidden = true;

  reviewStartButton.addEventListener("click", async () => {
    await updateLessonState({
      reviewMovementReleased: true
    });
  });

  document.body.appendChild(reviewStartButton);

  const reviewActivitiesButton =
    document.createElement("button");

  reviewActivitiesButton.type = "button";
  reviewActivitiesButton.id = "reviewActivitiesButton";
  reviewActivitiesButton.textContent =
    "Quick Activities";

  reviewActivitiesButton.hidden = true;

  reviewActivitiesButton.addEventListener(
    "click",
    async () => {
      await updateLessonState({
        reviewActivitiesReleased: true
      });
    }
  );

  document.body.appendChild(reviewActivitiesButton);
  if (window.location.pathname !== "/pages/admin.html") {
    const settingsButton = document.createElement("a");
    settingsButton.id = "globalTeacherSettingsButton";
    settingsButton.href = "/pages/admin.html";
    settingsButton.textContent = "Teacher Settings";

    document.body.appendChild(settingsButton);
  }


  function updateButton(isArmed) {
    button.dataset.armed = String(isArmed);
    button.textContent = isArmed ? "Frozen" : "Freeze";
  }

  function updatePauseButton(isPaused) {
    pauseButton.dataset.paused = String(isPaused);
    pauseButton.textContent = isPaused ? "Paused" : "Pause";
  }

  let activeLessonId = "week1";
  let lessonSteps =
    window.HandsOnMouseLessons?.week1?.steps || [];

  let currentStep = 0;
  let currentControlMode = "teacher";

  function updateLessonControls(state) {
    currentControlMode =
      state.lessonControlMode || "teacher";

    activeLessonId =
      state.activeLesson || "week1";

    lessonSteps =
      window.HandsOnMouseLessons?.[activeLessonId]?.steps || [];

    const maxStep =
      Math.max(lessonSteps.length - 1, 0);

    currentStep = Math.min(
      Math.max(state.currentLessonStep ?? 0, 0),
      maxStep
    );

    const step = lessonSteps[currentStep];

    if (step) {
      lessonStepDisplay.textContent =
        `Step ${currentStep + 1} of ${lessonSteps.length} — ${step.title}`;
    } else {
      lessonStepDisplay.textContent = "Lesson";
    }

    controlModeButton.textContent =
      currentControlMode === "teacher"
        ? "Mode: Teacher Led"
        : "Mode: Independent";

    backButton.disabled =
      currentStep <= 0;

    nextButton.disabled =
      lessonSteps.length === 0 ||
      currentStep >= lessonSteps.length - 1;

    const lessonMenu =
      document.getElementById("teacherLessonMenu");

    const teacherIsOnHome =
      lessonMenu && !lessonMenu.hidden;

    const showFingerControls =
      !teacherIsOnHome &&
      (
        step?.id === "hold-the-mouse" ||
        step?.id === "review-week1"
      );

    fingerControls.hidden =
      !showFingerControls;


    const showReviewStartButton =
      !teacherIsOnHome &&
      step?.id === "review-week1";

    reviewStartButton.hidden =
      !showReviewStartButton;

    if (showReviewStartButton) {
      const released =
        state.reviewMovementReleased === true;

      reviewStartButton.disabled = released;

      reviewStartButton.textContent =
        released
          ? "Movement Started"
          : "Start Movement";
    }


    const showActivitiesButton =
      !teacherIsOnHome &&
      step?.id === "review-week1";

    reviewActivitiesButton.hidden =
      !showActivitiesButton;

    if (showActivitiesButton) {
      const activitiesReleased =
        state.reviewActivitiesReleased === true;

      reviewActivitiesButton.disabled =
        activitiesReleased;

      reviewActivitiesButton.textContent =
        activitiesReleased
          ? "Activities Open"
          : "Quick Activities";
    }
      !showFingerControls;
  }

  async function updateLessonState(changes) {
    try {
      const response = await fetch("/api/classroom-state", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(changes)
      });

      if (!response.ok) {
        throw new Error("Unable to update lesson state.");
      }

      const state = await response.json();
      updateLessonControls(state);
    } catch (error) {
      console.error("Teacher Lesson controls:", error);
    }
  }

  backButton.addEventListener("click", () => {
    if (currentStep > 0) {
      updateLessonState({
        currentLessonStep: currentStep - 1,
        fingerHighlight: null
      });
    }
  });

  nextButton.addEventListener("click", () => {
    updateLessonState({
      currentLessonStep: currentStep + 1,
      fingerHighlight: null
    });
  });

  controlModeButton.addEventListener("click", () => {
    updateLessonState({
      lessonControlMode:
        currentControlMode === "teacher"
          ? "student"
          : "teacher"
    });
  });

  async function loadState() {
    try {
      const response = await fetch("/api/classroom-state");

      if (!response.ok) {
        throw new Error("Unable to load classroom state.");
      }

      const state = await response.json();
      updateButton(state.freezeScreenArmed);
      updatePauseButton(state.trainingPaused);
      updateLessonControls(state);
    } catch (error) {
      console.error("Teacher Freeze control:", error);
    }
  }

  button.addEventListener("click", async () => {
    const currentlyArmed = button.dataset.armed === "true";

    try {
      const response = await fetch("/api/classroom-state", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          freezeScreenArmed: !currentlyArmed
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update classroom state.");
      }

      const state = await response.json();
      updateButton(state.freezeScreenArmed);
    } catch (error) {
      console.error("Teacher Freeze control:", error);
    }
  });


  pauseButton.addEventListener("click", async () => {
    const currentlyPaused =
      pauseButton.dataset.paused === "true";

    try {
      const response = await fetch("/api/classroom-state", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          trainingPaused: !currentlyPaused
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update Training Pause.");
      }

      const state = await response.json();
      updatePauseButton(state.trainingPaused);
    } catch (error) {
      console.error("Teacher Pause control:", error);
    }
  });

  loadState();
  setInterval(loadState, 1000);
})();

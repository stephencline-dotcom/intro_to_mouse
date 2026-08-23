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

  const activeLesson = window.HandsOnMouseLessons?.week1;
  const lessonSteps = activeLesson?.steps || [];

  let currentStep = 0;
  let currentControlMode = "teacher";

  function updateLessonControls(state) {
    const maxStep = Math.max(lessonSteps.length - 1, 0);

    currentStep = Math.min(
      Math.max(state.currentLessonStep ?? 0, 0),
      maxStep
    );

    currentControlMode = state.lessonControlMode || "teacher";

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

    backButton.disabled = currentStep <= 0;
    nextButton.disabled =
      lessonSteps.length === 0 ||
      currentStep >= lessonSteps.length - 1;
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
        currentLessonStep: currentStep - 1
      });
    }
  });

  nextButton.addEventListener("click", () => {
    updateLessonState({
      currentLessonStep: currentStep + 1
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
})();

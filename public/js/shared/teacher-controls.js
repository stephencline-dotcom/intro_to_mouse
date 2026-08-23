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

  async function loadState() {
    try {
      const response = await fetch("/api/classroom-state");

      if (!response.ok) {
        throw new Error("Unable to load classroom state.");
      }

      const state = await response.json();
      updateButton(state.freezeScreenArmed);
      updatePauseButton(state.trainingPaused);
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

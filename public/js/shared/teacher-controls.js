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

  async function loadState() {
    try {
      const response = await fetch("/api/classroom-state");

      if (!response.ok) {
        throw new Error("Unable to load classroom state.");
      }

      const state = await response.json();
      updateButton(state.freezeScreenArmed);
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

  loadState();
})();

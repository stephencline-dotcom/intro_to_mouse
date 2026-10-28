const teacherSession = window.HandsOnMouseTeacherSession;

async function loadSettings() {
  const status = document.getElementById("settingsStatus");

  try {
    const response = await fetch("/api/settings");

    if (!response.ok) {
      throw new Error("Unable to load settings.");
    }

    const settings = await response.json();

    document.getElementById("soundEnabled").checked =
      settings.soundEnabled;

    document.getElementById("freezeScreenFeatureEnabled").checked =
      settings.freezeScreenFeatureEnabled;

    document.getElementById("trainingPauseEnabled").checked =
      settings.trainingPauseEnabled;

    document.getElementById("mousePracticeEnabled").checked =
      settings.mousePracticeEnabled;

    status.textContent = "Settings loaded.";
  } catch (error) {
    console.error(error);
    status.textContent = "Could not load settings.";
  }
}

async function saveSetting(settingName, value) {
  const status = document.getElementById("settingsStatus");

  status.textContent = "Saving...";

  try {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        [settingName]: value
      })
    });

    if (!response.ok) {
      throw new Error("Unable to save setting.");
    }

    status.textContent = "Settings saved.";
  } catch (error) {
    console.error(error);
    status.textContent = "Could not save setting.";

    await loadSettings();
  }
}

const settingIds = [
  "soundEnabled",
  "freezeScreenFeatureEnabled",
  "trainingPauseEnabled",
  "mousePracticeEnabled"
];

settingIds.forEach((settingId) => {
  const checkbox = document.getElementById(settingId);

  checkbox.addEventListener("change", () => {
    saveSetting(settingId, checkbox.checked);
  });
});

loadSettings();
const teacherLogoutButton = document.getElementById("teacherLogoutButton");

teacherLogoutButton.addEventListener("click", async () => {
  if (teacherLogoutButton.disabled) {
    return;
  }

  teacherLogoutButton.disabled = true;

  try {
    const response = await fetch("/api/classroom-state", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        freezeScreenArmed: false,
        unlockAllFrozenStudents: true,
        trainingPaused: false
      })
    });

    if (!response.ok) {
      throw new Error("Classroom release request failed.");
    }

    const state = await response.json();

    if (
      state.freezeScreenArmed !== false ||
      state.trainingPaused !== false
    ) {
      throw new Error("Classroom release was not confirmed.");
    }

    teacherSession.endTeacherSession();
    window.location.replace("/pages/login.html");
  } catch (error) {
    console.error("Could not safely log out:", error);

    window.alert(
      "Could not release the classroom. " +
      "You are still signed in. Please try again."
    );

    teacherLogoutButton.disabled = false;
  }
});

const studentLink = window.location.origin + "/?student-signin=1";

document.getElementById("openStudentLinkButton").addEventListener("click", () => {
  window.open(studentLink, "_blank", "noopener,noreferrer");
});
const teacherLoginLink = window.location.origin + "/pages/login.html";

document.getElementById("studentLink").textContent = studentLink;
document.getElementById("teacherLoginLink").textContent = teacherLoginLink;

async function copyClassroomLink(link, message) {
  const status = document.getElementById("copyLinkStatus");

  try {
    await navigator.clipboard.writeText(link);
    status.textContent = message;
  } catch (error) {
    console.error(error);
    status.textContent = "Could not copy link.";
  }
}

document
  .getElementById("copyStudentLinkButton")
  .addEventListener("click", () => {
    copyClassroomLink(studentLink, "Student Link copied!");
  });

document
  .getElementById("copyTeacherLinkButton")
  .addEventListener("click", () => {
    copyClassroomLink(teacherLoginLink, "Teacher Login Link copied!");
  });

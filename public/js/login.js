const teacherSession = window.HandsOnMouseTeacherSession;

const form = document.getElementById("teacherLoginForm");
const passwordInput = document.getElementById("teacherPassword");
const status = document.getElementById("loginStatus");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  status.textContent = "Checking password...";

  try {
    const response = await fetch("/api/teacher-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password: passwordInput.value
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      status.textContent = "Incorrect password.";
      passwordInput.select();
      return;
    }

    teacherSession.startTeacherSession();

    window.location.href = "/pages/admin.html";
  } catch (error) {
    console.error(error);
    status.textContent = "Could not log in.";
  }
});

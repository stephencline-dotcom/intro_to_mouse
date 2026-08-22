
function updateTeacherLoginVisibility() {
  const loginLink = document.querySelector(".teacher-login-link");
  const teacherSession = window.HandsOnMouseTeacherSession;

  if (!loginLink || !teacherSession) {
    return;
  }

  loginLink.hidden = teacherSession.isTeacherSession();
}

updateTeacherLoginVisibility();

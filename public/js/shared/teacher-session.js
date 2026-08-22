const TEACHER_SESSION_KEY = "handsOnMouseTeacherSession";

function isTeacherSession() {
  return sessionStorage.getItem(TEACHER_SESSION_KEY) === "true";
}

function startTeacherSession() {
  sessionStorage.setItem(TEACHER_SESSION_KEY, "true");
}

function endTeacherSession() {
  sessionStorage.removeItem(TEACHER_SESSION_KEY);
}

window.HandsOnMouseTeacherSession = {
  isTeacherSession,
  startTeacherSession,
  endTeacherSession
};
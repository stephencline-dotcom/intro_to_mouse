(() => {
  const teacherSession = window.HandsOnMouseTeacherSession;
  const isTeacher =
    teacherSession && teacherSession.isTeacherSession();

  function loadScript(src) {
    if ([...document.scripts].some(script => script.src.includes(src))) {
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    document.body.appendChild(script);
  }


  loadScript("/js/shared/mouse-input.js?v=2");

  loadScript("/js/shared/student-lesson-controller.js?v=71");

  if (isTeacher) {
    loadScript("/js/shared/lesson-menu.js?v=40");
    loadScript("/js/shared/teacher-controls.js?v=60");
  } else {
    loadScript("/js/shared/freeze-screen.js?v=3");
    loadScript("/js/shared/training-pause.js?v=1");
  }
})();

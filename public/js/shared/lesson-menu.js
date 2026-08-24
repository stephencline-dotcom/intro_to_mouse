(() => {
  const teacherSession =
    window.HandsOnMouseTeacherSession;

  const isTeacher =
    teacherSession &&
    teacherSession.isTeacherSession();

  if (!isTeacher) {
    return;
  }

  const menu =
    document.getElementById("teacherLessonMenu");

  const homePage =
    document.querySelector(".home-page");

  if (!menu) {
    return;
  }

  async function chooseLesson(lessonId) {
    try {
      const response = await fetch("/api/classroom-state", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          activeLesson: lessonId,
          currentLessonStep: 0,
          lessonControlMode: "teacher",
          fingerHighlight: null
        })
      });

      if (!response.ok) {
        throw new Error("Unable to select lesson.");
      }

      menu.hidden = true;

      if (homePage) {
        homePage.hidden = true;
      }

      window.dispatchEvent(
        new CustomEvent("handsOnMouseLessonSelected")
      );
    } catch (error) {
      console.error("Lesson menu:", error);
    }
  }

  menu
    .querySelectorAll("[data-lesson-id]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        chooseLesson(button.dataset.lessonId);
      });
    });

  window.HandsOnMouseLessonMenu = {
    show() {
      menu.hidden = false;

      if (homePage) {
        homePage.hidden = false;
      }

      const lessonView =
        document.getElementById("studentLessonView");

      if (lessonView) {
        lessonView.hidden = true;
      }
    },

    hide() {
      menu.hidden = true;
    }
  };

  menu.hidden = false;
})();

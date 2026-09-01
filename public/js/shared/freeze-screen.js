(() => {
  const teacherSession =
    window.HandsOnMouseTeacherSession;

  if (
    teacherSession &&
    teacherSession.isTeacherSession()
  ) {
    return;
  }

  let freezeArmed = false;
  let interactionTriggered = false;
  let freezeUnlockVersion = null;

  let overlay =
    document.getElementById(
      "studentFreezeOverlay"
    );

  if (!overlay) {
    overlay =
      document.createElement("div");

    overlay.id =
      "studentFreezeOverlay";

    overlay.innerHTML = `
      <div class="freeze-overlay-card">
        <h1>Eyes Up Front</h1>
        <p>Look at the teacher.</p>
      </div>
    `;

    document.body.appendChild(overlay);
  }


  function showOverlay() {
    overlay.dataset.active = "true";

    document.body.classList.add(
      "student-screen-frozen"
    );
  }


  function hideOverlay() {
    overlay.dataset.active = "false";

    document.body.classList.remove(
      "student-screen-frozen"
    );
  }


  /*
   * FREEZE
   *
   * While Freeze is armed, the first student
   * interaction catches this Chromebook.
   */
  function handleStudentInteraction() {
    if (
      !freezeArmed ||
      interactionTriggered
    ) {
      return;
    }

    interactionTriggered = true;

    showOverlay();
  }


  document.addEventListener(
    "pointermove",
    handleStudentInteraction
  );

  document.addEventListener(
    "pointerdown",
    handleStudentInteraction
  );

  document.addEventListener(
    "wheel",
    handleStudentInteraction,
    {
      passive: true
    }
  );


  async function checkClassroomState() {
    try {
      const response = await fetch(
        "/api/classroom-state",
        {
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load classroom state."
        );
      }

      const state =
        await response.json();

      const newFreezeArmed =
        state.freezeScreenArmed === true;

      const newUnlockVersion =
        Number(
          state.freezeUnlockVersion || 0
        );

      document.documentElement.dataset.freezeArmed =
        String(newFreezeArmed);


      /*
       * On first load, remember the current
       * Unlock All version.
       */
      if (freezeUnlockVersion === null) {
        freezeUnlockVersion =
          newUnlockVersion;
      }


      /*
       * UNLOCK ALL
       *
       * This is the ONLY teacher action that
       * removes an existing frozen overlay.
       */
      if (
        newUnlockVersion !==
        freezeUnlockVersion
      ) {
        freezeUnlockVersion =
          newUnlockVersion;

        interactionTriggered = false;

        hideOverlay();
      }


      /*
       * FREEZE
       *
       * Arm student interaction.
       *
       * RELEASE UNLOCKED
       *
       * Simply changes this to false.
       * Already-frozen students remain frozen
       * because we DO NOT call hideOverlay().
       */
      freezeArmed =
        newFreezeArmed;

    } catch (error) {
      console.error(
        "Student Freeze Screen:",
        error
      );
    }
  }


  checkClassroomState();

  setInterval(
    checkClassroomState,
    500
  );
})();

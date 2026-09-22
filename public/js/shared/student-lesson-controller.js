(() => {

  /*
   * ========================================================
   * GLOBAL LESSON SOUND MANAGER
   * ========================================================
   *
   * Every Audio object that starts playing while this
   * controller is active is automatically tracked.
   *
   * Changing lesson steps calls stopAllLessonSounds(),
   * which immediately pauses and resets every sound.
   *
   * This prevents sounds/loops from old slides continuing
   * after the teacher moves forward or backward.
   */

  const activeLessonSounds =
    new Set();

  const originalMediaPlay =
    HTMLMediaElement.prototype.play;

  const originalMediaPause =
    HTMLMediaElement.prototype.pause;

  HTMLMediaElement.prototype.play =
    function(...args) {
      activeLessonSounds.add(this);

      const result =
        originalMediaPlay.apply(
          this,
          args
        );

      const removeWhenFinished =
        () => {
          activeLessonSounds.delete(this);

          this.removeEventListener(
            "ended",
            removeWhenFinished
          );
        };

      this.addEventListener(
        "ended",
        removeWhenFinished
      );

      return result;
    };

  function stopAllLessonSounds() {
    activeLessonSounds.forEach(
      sound => {
        try {
          sound.loop = false;

          originalMediaPause.call(
            sound
          );

          sound.currentTime = 0;
        } catch (error) {
          // Ignore cleanup errors.
        }
      }
    );

    activeLessonSounds.clear();

    /*
     * Stop every media element currently attached
     * to the page as a second safety net.
     */
    document
      .querySelectorAll(
        "audio, video"
      )
      .forEach((media) => {
        try {
          media.loop = false;

          originalMediaPause.call(
            media
          );

          media.currentTime = 0;
        } catch (error) {
          // Ignore cleanup errors.
        }
      });
  }

  window.HandsOnMouseStopLessonSounds =
    stopAllLessonSounds;

  const teacherSession = window.HandsOnMouseTeacherSession;
  const isTeacher =
    teacherSession && teacherSession.isTeacherSession();

  let lesson = window.HandsOnMouseLessons?.week1;

  if (!lesson || !Array.isArray(lesson.steps)) {
    console.error("Student lesson controller: lesson definition missing.");
    return;
  }

  const INDEPENDENT_STEP_KEY = "handsOnMouseIndependentStep";

  let currentDisplayedStep = -1;
  let currentDisplayedLessonId = "week1";
  let currentMode = null;

  const REVIEW_ACTIVITY_KEY =
    "handsOnMouseReviewActivitiesComplete";

  const REVIEW_ACTIVITIES = [
    {
      id: "bullseye",
      title: "Bullseye Click",
      icon: "🎯",
      description: "Move to the target and click once."
    },
    {
      id: "wait-for-it",
      title: "Wait for It",
      icon: "⏳",
      description: "Wait until it is ready, then click."
    },
    {
      id: "corner-hunt",
      title: "Corner Hunt",
      icon: "🦌",
      description: "Find the deer hiding in the woods."
    },
    {
      id: "color-match",
      title: "Color Match",
      icon: "🎨",
      description: "Find and click the matching color."
    },
    {
      id: "mouse-sprint",
      title: "Mouse Sprint",
      icon: "🐭",
      description: "Catch the mouse before it escapes."
    },
    {
      id: "bubble-pop",
      title: "Bubble Pop",
      icon: "🫧",
      description: "Track the glowing bubble and pop it."
    }
  ];

  function getCompletedReviewActivities() {
    try {
      const saved =
        JSON.parse(
          sessionStorage.getItem(
            REVIEW_ACTIVITY_KEY
          ) || "[]"
        );

      return Array.isArray(saved)
        ? saved
        : [];
    } catch {
      return [];
    }
  }

  function saveCompletedReviewActivities(completed) {
    sessionStorage.setItem(
      REVIEW_ACTIVITY_KEY,
      JSON.stringify(completed)
    );
  }

  function getPointerTip(pointer) {
    if (!pointer) {
      return null;
    }

    const rect =
      pointer.getBoundingClientRect();

    /*
     * Hotspot is the visible point of the ➤ cursor.
     * All lessons and games should use this same point.
     */
    return {
      /*
       * The visible cursor is the ➤ glyph.
       * Its clickable hotspot should be the pointed tip:
       * near the far-right edge and vertically centered.
       */
      x: rect.left + rect.width * 0.90,
      y: rect.top + rect.height * 0.50
    };
  }

  function pointerTipHitsElement(pointer, element) {
    const tip =
      getPointerTip(pointer);

    if (!tip || !element) {
      return false;
    }

    const rect =
      element.getBoundingClientRect();

    return (
      tip.x >= rect.left &&
      tip.x <= rect.right &&
      tip.y >= rect.top &&
      tip.y <= rect.bottom
    );
  }

  let week3DemoSounds = [];

  function playWeek3DemoSound(src, volume = 0.5) {
    if (!soundEnabled) {
      return;
    }

    const sound = new Audio(src);
    sound.preload = "auto";
    sound.volume = volume;
    sound.currentTime = 0;

    week3DemoSounds.push(sound);

    sound.addEventListener(
      "ended",
      () => {
        week3DemoSounds =
          week3DemoSounds.filter(
            item => item !== sound
          );
      },
      { once: true }
    );

    sound.play().catch(() => {});
  }

  function stopWeek3DemoSounds() {
    week3DemoSounds.forEach((sound) => {
      try {
        sound.pause();
        sound.currentTime = 0;
      } catch {}
    });

    week3DemoSounds = [];
  }

  let dragReviewAnimationTimers = [];

  function stopDragQuickReviewAnimation() {
    dragReviewAnimationTimers.forEach((timer) => {
      clearTimeout(timer);
    });

    dragReviewAnimationTimers = [];
  }

  let week4QuickReviewTimers = [];

  function stopWeek4QuickReviewAnimation() {
    week4QuickReviewTimers.forEach((timer) => {
      clearTimeout(timer);
    });

    week4QuickReviewTimers = [];

    /*
     * Week 4 review uses the same shared demo-sound
     * player as Week 3, so stop any active swish/click
     * sounds immediately when leaving this step.
     */
    stopWeek3DemoSounds();
  }

  let meetDragAnimationTimers = [];

  function stopMeetDragAnimation() {
    meetDragAnimationTimers.forEach((timer) => {
      clearTimeout(timer);
    });

    meetDragAnimationTimers = [];
  }

  /*
   * Week 3 Step 2:
   * stop demo audio/animation the instant a navigation
   * button is clicked instead of waiting for classroom sync.
   */


  let removePressHoldMoveListener = null;
  let removePressHoldLeftDownListener = null;
  let removePressHoldLeftUpListener = null;
  let removePressHoldRightListener = null;
  let pressHoldNativeReleaseHandler = null;
  let pressHoldSuccessTimer = null;

  let removeDragChallengeMoveListener = null;
  let removeDragChallengeLeftDownListener = null;
  let removeDragChallengeRightListener = null;
  let dragChallengeNativeReleaseHandler = null;

  let removeDragDropMoveListener = null;
  let removeDragDropLeftDownListener = null;
  let removeDragDropRightListener = null;
  let dragDropNativeReleaseHandler = null;

  let removeWeek4MovingMoveListener = null;
  let removeWeek4MovingLeftDownListener = null;
  let removeWeek4MovingRightListener = null;
  let week4MovingNativeReleaseHandler = null;

  let removeWeek4PuzzleMoveListener = null;
  let removeWeek4PuzzleLeftDownListener = null;
  let removeWeek4PuzzleRightListener = null;
  let week4PuzzleNativeReleaseHandler = null;

  let removeWeek4CleanUpMoveListener = null;
  let removeWeek4CleanUpLeftDownListener = null;
  let removeWeek4CleanUpRightListener = null;
  let week4CleanUpNativeReleaseHandler = null;

  let removeWeek4SortMoveListener = null;
  let removeWeek4SortLeftDownListener = null;
  let removeWeek4SortRightListener = null;
  let week4SortNativeReleaseHandler = null;

  let removeWeek4WarmUpMoveListener = null;
  let removeWeek4WarmUpLeftDownListener = null;
  let removeWeek4WarmUpRightListener = null;
  let week4WarmUpNativeReleaseHandler = null;

  let removeDragPracticeMoveListener = null;
  let removeDragPracticeLeftDownListener = null;
  let removeDragPracticeRightListener = null;
  let dragPracticeNativeReleaseHandler = null;

  let removeLetGoMoveListener = null;
  let removeLetGoLeftDownListener = null;
  let removeLetGoLeftUpListener = null;
  let removeLetGoRightListener = null;
  let letGoNativeReleaseHandler = null;

  let removeHoldMoveMoveListener = null;
  let removeHoldMoveLeftDownListener = null;
  let removeHoldMoveLeftUpListener = null;
  let removeHoldMoveRightListener = null;

  function startDragCompleteBehavior() {
    if (!soundEnabled) {
      return;
    }

    const sound =
      new Audio("/sounds/correct.mp3");

    sound.preload = "auto";
    sound.volume = 0.65;
    sound.currentTime = 0;

    sound.play().catch(() => {});
  }

  function startDragChallengeBehavior() {
    const input = window.HandsOnMouseInput;

    const area =
      document.getElementById("dragChallengeArea");

    const target =
      document.getElementById("dragChallengeTarget");

    const destination =
      document.getElementById("dragChallengeDestination");

    const pointer =
      document.getElementById("dragChallengePointer");

    const status =
      document.getElementById("dragChallengeStatus");

    const progress =
      document.getElementById("dragChallengeProgress");

    if (
      !input ||
      !area ||
      !target ||
      !destination ||
      !pointer ||
      !status ||
      !progress
    ) {
      return;
    }

    const rounds = [
      {
        object: "⭐",
        scene: "night-sky",
        destination: "🌙",
        label: "NIGHT SKY",
        objectLeft: 18,
        objectTop: 30,
        destinationLeft: 80,
        destinationTop: 68
      },
      {
        object: "🍎",
        scene: "basket",
        destination: "🧺",
        label: "BASKET",
        objectLeft: 20,
        objectTop: 70,
        destinationLeft: 78,
        destinationTop: 28
      },
      {
        object: "🐟",
        scene: "fishbowl",
        destination: "",
        label: "FISHBOWL",
        objectLeft: 25,
        objectTop: 25,
        destinationLeft: 76,
        destinationTop: 72
      },
      {
        object: "🧸",
        scene: "toybox",
        destination: "",
        label: "TOY BOX",
        objectLeft: 18,
        objectTop: 72,
        destinationLeft: 82,
        destinationTop: 35
      }
    ];

    let roundIndex = 0;
    let dragging = false;
    let finished = false;

    function pointerOnTarget() {
      return pointerTipHitsElement(
        pointer,
        target
      );
    }

    function targetInsideDestination() {
      const targetRect =
        target.getBoundingClientRect();

      const destinationRect =
        destination.getBoundingClientRect();

      const centerX =
        targetRect.left +
        targetRect.width / 2;

      const centerY =
        targetRect.top +
        targetRect.height / 2;

      return (
        centerX >= destinationRect.left &&
        centerX <= destinationRect.right &&
        centerY >= destinationRect.top &&
        centerY <= destinationRect.bottom
      );
    }

    function clearReady() {
      target.classList.remove(
        "drag-challenge-target-ready"
      );

      destination.classList.remove(
        "drag-challenge-destination-ready"
      );
    }

    function loadRound() {
      const round = rounds[roundIndex];

      dragging = false;
      clearReady();

      target.className =
        "drag-challenge-target";

      destination.className =
        "drag-challenge-destination";

      target.textContent =
        round.object;

      destination.dataset.scene =
        round.scene;

      const destinationVisual =
        round.scene === "fishbowl"
          ? `
              <div class="challenge-fishbowl">
                <span class="challenge-fishbowl-water"></span>
                <span class="challenge-bubble challenge-bubble-one"></span>
                <span class="challenge-bubble challenge-bubble-two"></span>
              </div>
            `
          : round.scene === "toybox"
            ? `
                <div class="challenge-toybox">
                  <span class="challenge-toybox-lid"></span>
                  <span class="challenge-toybox-body">
                    <span>TOYS</span>
                  </span>
                </div>
              `
            : `
                <div class="drag-challenge-destination-icon">
                  ${round.destination}
                </div>
              `;

      destination.innerHTML = `
        ${destinationVisual}

        <strong>
          ${round.label}
        </strong>
      `;

      target.style.left =
        `${round.objectLeft}%`;

      target.style.top =
        `${round.objectTop}%`;

      destination.style.left =
        `${round.destinationLeft}%`;

      destination.style.top =
        `${round.destinationTop}%`;

      progress.textContent =
        `${roundIndex + 1} of ${rounds.length}`;

      status.textContent =
        "Drag it to the matching place!";
    }

    function finishRound() {
      dragging = false;

      clearReady();

      target.classList.remove(
        "drag-challenge-target-held"
      );

      target.classList.add(
        "drag-challenge-target-complete"
      );

      destination.classList.add(
        "drag-challenge-destination-complete"
      );

      status.textContent =
        "Great drag! ✓";

      if (soundEnabled) {
        const correctSound =
          new Audio(
            "/sounds/correct.mp3"
          );

        correctSound.volume = 0.6;
        correctSound.currentTime = 0;

        correctSound
          .play()
          .catch(() => {});
      }

      setTimeout(() => {
        roundIndex += 1;

        if (roundIndex >= rounds.length) {
          finished = true;

          progress.textContent =
            "4 of 4 ✓";

          status.textContent =
            "Challenge complete!";

          area.classList.add(
            "drag-challenge-finished"
          );

          /*
           * Remember that THIS student finished
           * the Week 3 challenge.
           *
           * This mirrors the proven Week 1
           * challenge-completion behavior.
           */
          if (!isTeacher) {
            /*
             * Do NOT render Step 9 directly here.
             *
             * Wait for the celebration, then set the
             * completion flag and let syncLessonState()
             * perform the one and only transition.
             */
            setTimeout(() => {
              sessionStorage.setItem(
                "handsOnMouseWeek3Complete",
                "true"
              );

              syncLessonState();
            }, 1500);
          }

          return;
        }

        loadRound();
      }, 750);
    }

    function finishRelease() {
      if (!dragging || finished) {
        return;
      }

      if (targetInsideDestination()) {
        finishRound();
        return;
      }

      dragging = false;

      target.classList.remove(
        "drag-challenge-target-held"
      );

      clearReady();

      const round = rounds[roundIndex];

      target.style.left =
        `${round.objectLeft}%`;

      target.style.top =
        `${round.objectTop}%`;

      status.textContent =
        "Almost! Try again.";
    }

    removeDragChallengeMoveListener =
      input.subscribe("move", event => {
        if (finished) {
          return;
        }

        const rect =
          area.getBoundingClientRect();

        const inside =
          event.x >= rect.left &&
          event.x <= rect.right &&
          event.y >= rect.top &&
          event.y <= rect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.90;

        const offsetY =
          pointer.offsetHeight * 0.50;

        pointer.style.left =
          `${event.x - rect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - rect.top - offsetY}px`;

        if (!dragging) {
          return;
        }

        target.style.left =
          `${event.x - rect.left}px`;

        target.style.top =
          `${event.y - rect.top}px`;

        if (targetInsideDestination()) {
          target.classList.add(
            "drag-challenge-target-ready"
          );

          destination.classList.add(
            "drag-challenge-destination-ready"
          );

          status.textContent =
            "LET GO!";
        } else {
          clearReady();

          status.textContent =
            "Keep holding...";
        }
      });

    removeDragChallengeLeftDownListener =
      input.subscribe("leftDown", () => {
        if (finished || dragging) {
          return;
        }

        if (!pointerOnTarget()) {
          status.textContent =
            "Click the object first.";

          return;
        }

        dragging = true;

        target.classList.add(
          "drag-challenge-target-held"
        );

        status.textContent =
          "Keep holding and move!";

        if (soundEnabled) {
          if (!leftClickSound) {
            leftClickSound =
              new Audio(
                "/sounds/mouseclick.mp3"
              );

            leftClickSound.volume = 0.5;
          }

          leftClickSound.pause();
          leftClickSound.currentTime = 0.12;

          leftClickSound
            .play()
            .catch(() => {});
        }
      });

    removeDragChallengeRightListener =
      input.subscribe("rightDown", () => {
        if (finished) {
          return;
        }

        dragging = false;

        clearReady();

        target.classList.remove(
          "drag-challenge-target-held"
        );

        const round = rounds[roundIndex];

        target.style.left =
          `${round.objectLeft}%`;

        target.style.top =
          `${round.objectTop}%`;

        showWrongButtonWarning();

        status.textContent =
          "Use the LEFT button.";
      });

    dragChallengeNativeReleaseHandler =
      event => {
        if (event.button !== 0) {
          return;
        }

        finishRelease();
      };

    window.addEventListener(
      "mouseup",
      dragChallengeNativeReleaseHandler,
      true
    );

    loadRound();
  }

  function startDragDropBehavior() {
    const input = window.HandsOnMouseInput;

    const area =
      document.getElementById("dragDropArea");

    const pointer =
      document.getElementById("dragDropPointer");

    const status =
      document.getElementById("dragDropStatus");

    const progress =
      document.getElementById("dragDropProgress");

    if (
      !input ||
      !area ||
      !pointer ||
      !status ||
      !progress
    ) {
      return;
    }

    const objects =
      Array.from(
        area.querySelectorAll(
          ".drag-drop-object"
        )
      );

    const destinations =
      Array.from(
        area.querySelectorAll(
          ".drag-drop-destination"
        )
      );

    let activeObject = null;
    let completedCount = 0;

    function pointerOnObject(object) {
      return pointerTipHitsElement(
        pointer,
        object
      );
    }

    function matchingDestination(object) {
      return destinations.find(
        destination =>
          destination.dataset.match ===
          object.dataset.match
      );
    }

    function objectInsideDestination(
      object,
      destination
    ) {
      if (!object || !destination) {
        return false;
      }

      const objectRect =
        object.getBoundingClientRect();

      const destinationRect =
        destination.getBoundingClientRect();

      const centerX =
        objectRect.left +
        objectRect.width / 2;

      const centerY =
        objectRect.top +
        objectRect.height / 2;

      return (
        centerX >= destinationRect.left &&
        centerX <= destinationRect.right &&
        centerY >= destinationRect.top &&
        centerY <= destinationRect.bottom
      );
    }

    function clearReadyStates() {
      objects.forEach(object => {
        object.classList.remove(
          "drag-drop-object-ready"
        );
      });

      destinations.forEach(destination => {
        destination.classList.remove(
          "drag-drop-destination-ready"
        );
      });
    }

    function returnObject(object) {
      if (!object) {
        return;
      }

      object.style.left =
        object.dataset.startLeft;

      object.style.top =
        object.dataset.startTop;

      object.classList.remove(
        "drag-drop-object-held",
        "drag-drop-object-ready"
      );
    }

    objects.forEach(object => {
      object.dataset.startLeft =
        object.style.left;

      object.dataset.startTop =
        object.style.top;
    });


    removeDragDropMoveListener =
      input.subscribe("move", event => {
        const rect =
          area.getBoundingClientRect();

        const inside =
          event.x >= rect.left &&
          event.x <= rect.right &&
          event.y >= rect.top &&
          event.y <= rect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.90;

        const offsetY =
          pointer.offsetHeight * 0.50;

        pointer.style.left =
          `${event.x - rect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - rect.top - offsetY}px`;

        if (!activeObject) {
          return;
        }

        activeObject.style.left =
          `${event.x - rect.left}px`;

        activeObject.style.top =
          `${event.y - rect.top}px`;

        clearReadyStates();

        const destination =
          matchingDestination(
            activeObject
          );

        if (
          objectInsideDestination(
            activeObject,
            destination
          )
        ) {
          activeObject.classList.add(
            "drag-drop-object-ready"
          );

          destination.classList.add(
            "drag-drop-destination-ready"
          );

          status.textContent =
            "That's the right place — LET GO!";
        } else {
          status.textContent =
            "Keep holding and move.";
        }
      });


    removeDragDropLeftDownListener =
      input.subscribe("leftDown", () => {
        if (activeObject) {
          return;
        }

        const object =
          objects.find(item => {
            return (
              !item.classList.contains(
                "drag-drop-object-complete"
              ) &&
              pointerOnObject(item)
            );
          });

        if (!object) {
          status.textContent =
            "Move onto an object first.";

          return;
        }

        activeObject = object;

        object.classList.add(
          "drag-drop-object-held"
        );

        status.textContent =
          "KEEP HOLDING — find its place.";

        if (soundEnabled) {
          if (!leftClickSound) {
            leftClickSound =
              new Audio(
                "/sounds/mouseclick.mp3"
              );

            leftClickSound.volume = 0.5;
          }

          leftClickSound.pause();
          leftClickSound.currentTime = 0.12;

          leftClickSound
            .play()
            .catch(() => {});
        }
      });


    removeDragDropRightListener =
      input.subscribe("rightDown", () => {
        if (activeObject) {
          returnObject(activeObject);
          activeObject = null;
        }

        clearReadyStates();

        showWrongButtonWarning();

        status.textContent =
          "Use the LEFT button.";
      });


    function finishDrop() {
      if (!activeObject) {
        return;
      }

      const object =
        activeObject;

      const destination =
        matchingDestination(object);

      activeObject = null;

      clearReadyStates();

      if (
        objectInsideDestination(
          object,
          destination
        )
      ) {
        object.classList.remove(
          "drag-drop-object-held"
        );

        object.classList.add(
          "drag-drop-object-complete"
        );

        destination.classList.add(
          "drag-drop-destination-complete"
        );

        /*
         * Snap object into center of destination.
         */
        const areaRect =
          area.getBoundingClientRect();

        const destinationRect =
          destination.getBoundingClientRect();

        /*
         * Park the completed object as a small badge
         * near the upper-right corner of its destination.
         * This keeps the destination picture visible
         * and prevents completed objects from covering
         * the next matching area.
         */
        object.style.left =
          `${
            destinationRect.right -
            areaRect.left -
            22
          }px`;

        object.style.top =
          `${
            destinationRect.top -
            areaRect.top +
            22
          }px`;

        completedCount += 1;

        progress.textContent =
          `${completedCount} of ${objects.length}`;

        if (soundEnabled) {
          const correctSound =
            new Audio(
              "/sounds/correct.mp3"
            );

          correctSound.volume = 0.6;
          correctSound.currentTime = 0;

          correctSound
            .play()
            .catch(() => {});
        }

        if (
          completedCount ===
          objects.length
        ) {
          status.textContent =
            "You matched them all! ✓";

          progress.textContent =
            `${objects.length} of ${objects.length} ✓`;
        } else {
          status.textContent =
            "Great drop! Choose another object.";
        }

        return;
      }

      returnObject(object);

      status.textContent =
        "Try the matching place.";
    }


    dragDropNativeReleaseHandler =
      event => {
        if (event.button !== 0) {
          return;
        }

        finishDrop();
      };

    window.addEventListener(
      "mouseup",
      dragDropNativeReleaseHandler,
      true
    );
  }

  let removeWeek4ChallengeBehavior = null;

  function startWeek4CompleteBehavior() {
    const screen =
      document.querySelector(
        ".lesson-screen-week4-complete"
      );

    if (!screen) {
      return;
    }

    if (soundEnabled) {
      const completeSound =
        new Audio(
          "/sounds/complete.mp3"
        );

      completeSound.volume = 0.7;
      completeSound.currentTime = 0;

      completeSound
        .play()
        .catch(() => {});
    }

    screen.classList.add(
      "week4-complete-celebrate"
    );
  }

  function startWeek4ChallengeBehavior() {
    const input = window.HandsOnMouseInput;

    const area =
      document.getElementById(
        "week4ChallengeArea"
      );

    const pointer =
      document.getElementById(
        "week4ChallengePointer"
      );

    const status =
      document.getElementById(
        "week4ChallengeStatus"
      );

    const progress =
      document.getElementById(
        "week4ChallengeProgress"
      );

    const roundLabel =
      document.getElementById(
        "week4ChallengeRoundLabel"
      );

    const stage =
      document.getElementById(
        "week4ChallengeStage"
      );

    if (
      !input ||
      !area ||
      !pointer ||
      !status ||
      !progress ||
      !roundLabel ||
      !stage
    ) {
      return;
    }

    let roundIndex = 0;
    let activeObject = null;
    let dragging = false;
    let finished = false;
    let failedByObstacle = false;
    let fireTruckSound = null;

    function stopFireTruckSound() {
      if (!fireTruckSound) {
        return;
      }

      fireTruckSound.pause();
      fireTruckSound.currentTime = 0;
      fireTruckSound = null;
    }

    function startFireTruckSound() {
      stopFireTruckSound();

      if (!soundEnabled) {
        return;
      }

      fireTruckSound =
        new Audio(
          "/sounds/fire.mp3"
        );

      fireTruckSound.volume = 0.5;
      fireTruckSound.loop = true;
      fireTruckSound.currentTime = 0;

      fireTruckSound
        .play()
        .catch(() => {});
    }

    const ROUND_COUNT = 5;

    function updatePointer(event) {
      const rect =
        area.getBoundingClientRect();

      const inside =
        event.x >= rect.left &&
        event.x <= rect.right &&
        event.y >= rect.top &&
        event.y <= rect.bottom;

      if (!inside) {
        return null;
      }

      const offsetX =
        pointer.offsetWidth * 0.90;

      const offsetY =
        pointer.offsetHeight * 0.50;

      pointer.style.left =
        `${event.x - rect.left - offsetX}px`;

      pointer.style.top =
        `${event.y - rect.top - offsetY}px`;

      return rect;
    }

    function pointerOnElement(element) {
      return pointerTipHitsElement(
        pointer,
        element
      );
    }

    function elementCenterInside(
      element,
      destination
    ) {
      if (!element || !destination) {
        return false;
      }

      const elementRect =
        element.getBoundingClientRect();

      const destinationRect =
        destination.getBoundingClientRect();

      const centerX =
        elementRect.left +
        elementRect.width / 2;

      const centerY =
        elementRect.top +
        elementRect.height / 2;

      return (
        centerX >= destinationRect.left &&
        centerX <= destinationRect.right &&
        centerY >= destinationRect.top &&
        centerY <= destinationRect.bottom
      );
    }

    function objectTouchesObstacle(
      object,
      obstacle
    ) {
      const a =
        object.getBoundingClientRect();

      const b =
        obstacle.getBoundingClientRect();

      return !(
        a.right < b.left ||
        a.left > b.right ||
        a.bottom < b.top ||
        a.top > b.bottom
      );
    }

    function firetruckOnRoad(object) {
      if (
        roundIndex !== 3 ||
        !object
      ) {
        return true;
      }

      const objectRect =
        object.getBoundingClientRect();

      const centerX =
        objectRect.left +
        objectRect.width / 2;

      const centerY =
        objectRect.top +
        objectRect.height / 2;

      const roadSegments =
        Array.from(
          stage.querySelectorAll(
            ".week4-fire-road-segment"
          )
        );

      return roadSegments.some(
        (segment) => {
          const rect =
            segment.getBoundingClientRect();

          return (
            centerX >= rect.left &&
            centerX <= rect.right &&
            centerY >= rect.top &&
            centerY <= rect.bottom
          );
        }
      );
    }

    function clearHighlights() {
      stage
        .querySelectorAll(
          ".week4-master-ready"
        )
        .forEach((element) => {
          element.classList.remove(
            "week4-master-ready"
          );
        });
    }

    function stopDragging() {
      stopFireTruckSound();

      dragging = false;

      if (activeObject) {
        activeObject.classList.remove(
          "week4-master-object-held"
        );
      }

      activeObject = null;

      clearHighlights();
    }

    function playCorrect() {
      if (!soundEnabled) {
        return;
      }

      const sound =
        new Audio(
          "/sounds/correct.mp3"
        );

      sound.volume = 0.6;
      sound.currentTime = 0;

      sound.play().catch(() => {});
    }

    function advanceRound() {
      stopDragging();

      playCorrect();

      status.textContent =
        "Great job! ✓";

      setTimeout(() => {
        roundIndex += 1;

        if (
          roundIndex >=
          ROUND_COUNT
        ) {
          finishChallenge();
          return;
        }

        loadRound();
      }, 650);
    }

    function finishChallenge() {
      finished = true;

      stage.innerHTML = `
        <div class="week4-master-finish">
          <div class="week4-master-trophy">
            🏆
          </div>

          <strong>
            DRAG MASTER!
          </strong>

          <span>
            ★ ★ ★
          </span>
        </div>
      `;

      roundLabel.textContent =
        "Challenge Complete";

      progress.textContent =
        "5 of 5 ✓";

      status.textContent =
        "You did it!";

      area.classList.add(
        "week4-challenge-complete"
      );

      if (soundEnabled) {
        const completeSound =
          new Audio(
            "/sounds/complete.mp3"
          );

        completeSound.volume = 0.65;
        completeSound.currentTime = 0;

        completeSound
          .play()
          .catch(() => {});
      }
    }

    function loadRound() {
      stopDragging();

      failedByObstacle = false;

      progress.textContent =
        `${roundIndex + 1} of ${ROUND_COUNT}`;

      roundLabel.textContent =
        `Round ${roundIndex + 1}`;

      area.classList.remove(
        "week4-master-final-active"
      );

      /*
       * ROUND 1
       * One object, two possible destinations.
       */
      if (roundIndex === 0) {
        status.textContent =
          "Put the fish where it belongs.";

        stage.innerHTML = `
          <div
            class="week4-master-object"
            data-master-object="fish"
            style="left: 17%; top: 50%;"
          >
            🐟
          </div>

          <div
            class="week4-master-target week4-master-target-choice"
            data-master-target="water"
            style="left: 72%; top: 28%;"
          >
            🌊
          </div>

          <div
            class="week4-master-target week4-master-target-choice"
            data-master-target="tree"
            style="left: 72%; top: 72%;"
          >
            🌳
          </div>
        `;

        return;
      }

      /*
       * ROUND 2
       * Three objects. Only one belongs in the nest.
       */
      if (roundIndex === 1) {
        status.textContent =
          "Choose what belongs in the nest.";

        stage.innerHTML = `
          <div
            class="week4-master-object"
            data-master-object="bird"
            style="left: 15%; top: 24%;"
          >
            🐦
          </div>

          <div
            class="week4-master-object"
            data-master-object="car"
            style="left: 27%; top: 50%;"
          >
            🚗
          </div>

          <div
            class="week4-master-object"
            data-master-object="apple"
            style="left: 15%; top: 76%;"
          >
            🍎
          </div>

          <div
            class="week4-master-target week4-master-nest"
            data-master-target="nest"
            style="left: 76%; top: 50%;"
          >
            🪹
          </div>
        `;

        return;
      }

      /*
       * ROUND 3
       * Obstacle course.
       */
      if (roundIndex === 2) {
        status.textContent =
          "Carry the star through the path.";

        stage.innerHTML = `
          <div
            class="week4-master-object"
            data-master-object="star"
            style="left: 11%; top: 50%;"
          >
            ★
          </div>

          <div
            class="week4-master-obstacle obstacle-a"
          ></div>

          <div
            class="week4-master-obstacle obstacle-b"
          ></div>

          <div
            class="week4-master-obstacle obstacle-c"
          ></div>

          <div
            class="week4-master-target week4-master-finish-target"
            data-master-target="finish"
            style="left: 89%; top: 50%;"
          >
            🏁
          </div>
        `;

        return;
      }

      /*
       * ROUND 4
       * Drive the firetruck down a winding road.
       * Leaving the road resets the round.
       */
      if (roundIndex === 3) {
        status.textContent =
          "Drive the firetruck to the fire!";

        stage.innerHTML = `
          <div class="week4-fire-road">

            <div
              class="week4-fire-road-segment road-one"
            ></div>

            <div
              class="week4-fire-road-segment road-two"
            ></div>

            <div
              class="week4-fire-road-segment road-three"
            ></div>

            <div
              class="week4-fire-road-segment road-four"
            ></div>

            <div
              class="week4-fire-road-segment road-five"
            ></div>

          </div>

          <div
            class="week4-master-object week4-firetruck"
            data-master-object="firetruck"
            style="left: 10%; top: 72%;"
          >
            🚒
          </div>

          <div
            class="week4-master-target week4-burning-house"
            data-master-target="fire"
            style="left: 88%; top: 25%;"
          >
            <span>🏠</span>
            <b>🔥</b>
          </div>
        `;

        return;
      }

      /*
       * ROUND 5
       * Moving target. It becomes faster once grabbed.
       */
      status.textContent =
        "Catch it!";

      area.classList.add(
        "week4-master-final-active"
      );

      stage.innerHTML = `
        <div
          class="week4-master-object"
          data-master-object="lightning"
          style="left: 15%; top: 50%;"
        >
          ⚡
        </div>

        <div
          class="week4-master-target week4-master-moving-target"
          data-master-target="moving"
        >
          ★
        </div>
      `;
    }

    function getObjectUnderPointer() {
      return Array.from(
        stage.querySelectorAll(
          ".week4-master-object"
        )
      ).find((object) => {
        return pointerOnElement(object);
      }) || null;
    }

    function getTargetUnderObject(object) {
      return Array.from(
        stage.querySelectorAll(
          ".week4-master-target"
        )
      ).find((target) => {
        return elementCenterInside(
          object,
          target
        );
      }) || null;
    }

    function resetRoundObject() {
      loadRound();

      status.textContent =
        "Try again.";
    }

    function checkObstacleCollision() {
      if (
        roundIndex !== 2 ||
        !activeObject ||
        failedByObstacle
      ) {
        return false;
      }

      const obstacle =
        Array.from(
          stage.querySelectorAll(
            ".week4-master-obstacle"
          )
        ).find((item) => {
          return objectTouchesObstacle(
            activeObject,
            item
          );
        });

      if (!obstacle) {
        return false;
      }

      failedByObstacle = true;

      obstacle.classList.add(
        "week4-master-obstacle-hit"
      );

      if (soundEnabled) {
        const hitSound =
          new Audio(
            "/sounds/hit.mp3"
          );

        hitSound.volume = 0.6;
        hitSound.currentTime = 0;

        hitSound
          .play()
          .catch(() => {});
      }

      status.textContent =
        "Oops! Stay in the path.";

      setTimeout(() => {
        resetRoundObject();
      }, 350);

      return true;
    }

    function finishDrop() {
      if (
        !dragging ||
        !activeObject ||
        finished
      ) {
        return;
      }

      const object =
        activeObject;

      const target =
        getTargetUnderObject(object);

      /*
       * ROUND 1:
       * Fish must go into water.
       */
      if (roundIndex === 0) {
        if (
          target?.dataset.masterTarget ===
          "water"
        ) {
          advanceRound();
        } else {
          resetRoundObject();
        }

        return;
      }

      /*
       * ROUND 2:
       * Only the bird belongs in the nest.
       */
      if (roundIndex === 1) {
        if (
          object.dataset.masterObject ===
            "bird" &&
          target?.dataset.masterTarget ===
            "nest"
        ) {
          advanceRound();
        } else {
          resetRoundObject();
        }

        return;
      }

      /*
       * ROUND 3:
       * Star must survive the obstacles and
       * be released inside the finish.
       */
      if (roundIndex === 2) {
        if (
          !failedByObstacle &&
          target?.dataset.masterTarget ===
            "finish"
        ) {
          advanceRound();
        } else {
          resetRoundObject();
        }

        return;
      }

      /*
       * ROUND 4:
       * Firetruck must stay on the road and
       * be released at the burning house.
       */
      if (roundIndex === 3) {
        if (
          firetruckOnRoad(object) &&
          target?.dataset.masterTarget ===
            "fire"
        ) {
          advanceRound();
        } else {
          resetRoundObject();

          status.textContent =
            "Drive all the way to the fire.";
        }

        return;
      }

      /*
       * ROUND 5:
       * Must release inside moving target.
       */
      if (
        target?.dataset.masterTarget ===
        "moving"
      ) {
        advanceRound();
      } else {
        resetRoundObject();
      }
    }

    const removeMove =
      input.subscribe(
        "move",
        (event) => {
          if (finished) {
            return;
          }

          const rect =
            updatePointer(event);

          if (!rect || !dragging || !activeObject) {
            return;
          }

          activeObject.style.left =
            `${event.x - rect.left}px`;

          activeObject.style.top =
            `${event.y - rect.top}px`;

          if (checkObstacleCollision()) {
            return;
          }

          /*
           * Round 4 firetruck must remain on
           * the winding road while being dragged.
           */
          if (
            roundIndex === 3 &&
            !firetruckOnRoad(activeObject)
          ) {
            status.textContent =
              "Stay on the road!";

            stopDragging();

            setTimeout(() => {
              loadRound();

              status.textContent =
                "Try the road again.";
            }, 300);

            return;
          }

          clearHighlights();

          const target =
            getTargetUnderObject(
              activeObject
            );

          if (target) {
            target.classList.add(
              "week4-master-ready"
            );
          }
        }
      );

    const removeLeftDown =
      input.subscribe(
        "leftDown",
        () => {
          if (
            finished ||
            dragging
          ) {
            return;
          }

          const object =
            getObjectUnderPointer();

          if (!object) {
            status.textContent =
              "Choose carefully.";

            return;
          }

          activeObject = object;
          dragging = true;

          object.classList.add(
            "week4-master-object-held"
          );

          /*
           * Round 4 firetruck sound plays only
           * while the truck is being dragged.
           */
          if (
            roundIndex === 3 &&
            object.dataset.masterObject ===
              "firetruck"
          ) {
            startFireTruckSound();
          }

          /*
           * Round 5 becomes faster only after
           * the student grabs the object.
           */
          if (roundIndex === 4) {
            area.classList.add(
              "week4-master-final-fast"
            );
          }

          if (soundEnabled) {
            if (!leftClickSound) {
              leftClickSound =
                new Audio(
                  "/sounds/mouseclick.mp3"
                );

              leftClickSound.volume =
                0.5;
            }

            leftClickSound.pause();
            leftClickSound.currentTime =
              0.12;

            leftClickSound
              .play()
              .catch(() => {});
          }
        }
      );

    const removeRightDown =
      input.subscribe(
        "rightDown",
        () => {
          if (finished) {
            return;
          }

          showWrongButtonWarning();

          resetRoundObject();

          status.textContent =
            "Use the LEFT button.";
        }
      );

    const nativeReleaseHandler =
      (event) => {
        if (event.button !== 0) {
          return;
        }

        finishDrop();
      };

    window.addEventListener(
      "mouseup",
      nativeReleaseHandler,
      true
    );

    removeWeek4ChallengeBehavior = () => {
      stopFireTruckSound();

      removeMove?.();
      removeLeftDown?.();
      removeRightDown?.();

      window.removeEventListener(
        "mouseup",
        nativeReleaseHandler,
        true
      );
    };

    loadRound();
  }

  function startWeek4ActivitiesBehavior() {
    const screen =
      document.querySelector(
        ".lesson-screen-week4-activities"
      );

    if (!screen) {
      return;
    }

    const hub =
      document.getElementById(
        "week4ActivitiesHub"
      );

    const activityView =
      document.getElementById(
        "week4ActivityView"
      );

    if (!hub || !activityView) {
      return;
    }

    let activityCleanup = null;

    function stopCurrentActivity() {
      if (activityCleanup) {
        activityCleanup();
        activityCleanup = null;
      }
    }

    function showActivityComplete({
      title,
      message,
      retry
    }) {
      /*
       * Play the completion sound when the
       * Step 7 celebration box appears.
       */
      if (soundEnabled) {
        const completeSound =
          new Audio(
            "/sounds/complete.mp3"
          );

        completeSound.volume = 0.65;
        completeSound.currentTime = 0;

        completeSound
          .play()
          .catch(() => {});
      }

      const existing =
        document.getElementById(
          "week4ActivityCompleteOverlay"
        );

      existing?.remove();

      const overlay =
        document.createElement("div");

      overlay.id =
        "week4ActivityCompleteOverlay";

      overlay.className =
        "week4-activity-complete-overlay";

      overlay.innerHTML = `
        <div class="week4-activity-complete-card">

          <div class="week4-activity-complete-confetti">
            ✦ 🎉 ✦
          </div>

          <h2>${title}</h2>

          <p>${message}</p>

          <div class="week4-activity-complete-buttons">

            <button
              id="week4ActivityRetryButton"
              type="button"
              class="week4-activity-retry-button"
            >
              ↻ Try Again
            </button>

            <button
              id="week4ActivityBackButton"
              type="button"
              class="week4-activity-return-button"
            >
              ← Activities
            </button>

          </div>

        </div>
      `;

      const shell =
        activityView.querySelector(
          ".week4-mini-activity-shell"
        );

      if (!shell) {
        return;
      }

      shell.appendChild(overlay);

      overlay
        .querySelector(
          "#week4ActivityRetryButton"
        )
        ?.addEventListener(
          "click",
          () => {
            overlay.remove();

            if (
              typeof retry ===
              "function"
            ) {
              retry();
            }
          }
        );

      overlay
        .querySelector(
          "#week4ActivityBackButton"
        )
        ?.addEventListener(
          "click",
          () => {
            overlay.remove();
            showHub();
          }
        );
    }


    function showHub() {
      document
        .getElementById(
          "week4ActivityCompleteOverlay"
        )
        ?.remove();

      stopCurrentActivity();
      activityView.hidden = true;
      activityView.innerHTML = "";

      hub.hidden = false;
    }

    function startFeedAnimalsActivity() {
      const input = window.HandsOnMouseInput;

      const area =
        document.getElementById(
          "week4FeedAnimalsArea"
        );

      const pointer =
        document.getElementById(
          "week4FeedAnimalsPointer"
        );

      const status =
        document.getElementById(
          "week4FeedAnimalsStatus"
        );

      const progress =
        document.getElementById(
          "week4FeedAnimalsProgress"
        );

      if (
        !input ||
        !area ||
        !pointer ||
        !status ||
        !progress
      ) {
        return;
      }

      const foods =
        Array.from(
          area.querySelectorAll(
            ".week4-feed-food"
          )
        );

      const animals =
        Array.from(
          area.querySelectorAll(
            ".week4-feed-animal"
          )
        );

      let activeFood = null;
      let completedCount = 0;
      let finished = false;

      foods.forEach((food) => {
        food.dataset.startLeft =
          food.style.left;

        food.dataset.startTop =
          food.style.top;
      });

      function pointerOnFood(food) {
        return pointerTipHitsElement(
          pointer,
          food
        );
      }

      function animalUnderFood(food) {
        if (!food) {
          return null;
        }

        const foodRect =
          food.getBoundingClientRect();

        const centerX =
          foodRect.left +
          foodRect.width / 2;

        const centerY =
          foodRect.top +
          foodRect.height / 2;

        return animals.find((animal) => {
          const rect =
            animal.getBoundingClientRect();

          return (
            centerX >= rect.left &&
            centerX <= rect.right &&
            centerY >= rect.top &&
            centerY <= rect.bottom
          );
        }) || null;
      }

      function correctAnimal(food) {
        return animals.find(
          animal =>
            animal.dataset.animal ===
            food.dataset.forAnimal
        );
      }

      function clearReady() {
        foods.forEach((food) => {
          food.classList.remove(
            "week4-feed-food-ready"
          );
        });

        animals.forEach((animal) => {
          animal.classList.remove(
            "week4-feed-animal-ready",
            "week4-feed-animal-wrong"
          );
        });
      }

      function returnFood(food) {
        if (!food) {
          return;
        }

        food.style.left =
          food.dataset.startLeft;

        food.style.top =
          food.dataset.startTop;

        food.classList.remove(
          "week4-feed-food-held",
          "week4-feed-food-ready"
        );
      }

      function updateProgress() {
        progress.textContent =
          `${completedCount} of ${foods.length}`;
      }

      function completeFood(
        food,
        animal
      ) {
        food.classList.remove(
          "week4-feed-food-held",
          "week4-feed-food-ready"
        );

        food.classList.add(
          "week4-feed-food-complete"
        );

        animal.classList.add(
          "week4-feed-animal-fed"
        );

        const happy =
          animal.querySelector(
            ".week4-feed-happy"
          );

        if (happy) {
          happy.textContent = "♥";
        }

        completedCount += 1;
        updateProgress();

        status.textContent =
          "Yum! Great match! ✓";

        if (soundEnabled) {
          const sound =
            new Audio(
              "/sounds/correct.mp3"
            );

          sound.volume = 0.6;
          sound.currentTime = 0;

          sound
            .play()
            .catch(() => {});
        }

        setTimeout(() => {
          if (
            completedCount >=
            foods.length
          ) {
            finished = true;

            progress.textContent =
              "5 of 5 ✓";

            status.textContent =
              "All the animals are fed!";

            area.classList.add(
              "week4-feed-complete"
            );

            setTimeout(() => {
              showActivityComplete({
                title: "Great Job!",
                message:
                  "You fed all the animals!",
                retry: () => {
                  showActivity(
                    "feed-animals"
                  );
                }
              });
            }, 450);

            return;
          }

          status.textContent =
            "Choose another food.";
        }, 450);
      }

      function finishDrop() {
        if (
          !activeFood ||
          finished
        ) {
          return;
        }

        const food =
          activeFood;

        activeFood = null;

        const droppedAnimal =
          animalUnderFood(food);

        const match =
          correctAnimal(food);

        clearReady();

        /*
         * SUCCESS ONLY HAPPENS HERE,
         * ON THE PHYSICAL LEFT-BUTTON RELEASE.
         */
        if (
          droppedAnimal &&
          droppedAnimal === match
        ) {
          completeFood(
            food,
            match
          );

          return;
        }

        if (droppedAnimal) {
          droppedAnimal.classList.add(
            "week4-feed-animal-wrong"
          );

          status.textContent =
            "That's not this animal's food.";

          setTimeout(() => {
            droppedAnimal.classList.remove(
              "week4-feed-animal-wrong"
            );
          }, 450);
        } else {
          status.textContent =
            "Let go over an animal.";
        }

        returnFood(food);
      }


      const removeMove =
        input.subscribe(
          "move",
          (event) => {
            if (finished) {
              return;
            }

            const rect =
              area.getBoundingClientRect();

            const inside =
              event.x >= rect.left &&
              event.x <= rect.right &&
              event.y >= rect.top &&
              event.y <= rect.bottom;

            if (!inside) {
              return;
            }

            const offsetX =
              pointer.offsetWidth * 0.90;

            const offsetY =
              pointer.offsetHeight * 0.50;

            pointer.style.left =
              `${
                event.x -
                rect.left -
                offsetX
              }px`;

            pointer.style.top =
              `${
                event.y -
                rect.top -
                offsetY
              }px`;

            if (!activeFood) {
              return;
            }

            activeFood.style.left =
              `${event.x - rect.left}px`;

            activeFood.style.top =
              `${event.y - rect.top}px`;

            clearReady();

            const animal =
              animalUnderFood(
                activeFood
              );

            if (!animal) {
              status.textContent =
                "Keep holding — find the hungry animal.";

              return;
            }

            activeFood.classList.add(
              "week4-feed-food-ready"
            );

            animal.classList.add(
              "week4-feed-animal-ready"
            );

            if (
              animal ===
              correctAnimal(activeFood)
            ) {
              status.textContent =
                "That's right — LET GO!";
            } else {
              status.textContent =
                "Hmm... does that animal eat this?";
            }
          }
        );


      const removeLeftDown =
        input.subscribe(
          "leftDown",
          () => {
            if (
              finished ||
              activeFood
            ) {
              return;
            }

            const food =
              foods.find((item) => {
                return (
                  !item.classList.contains(
                    "week4-feed-food-complete"
                  ) &&
                  pointerOnFood(item)
                );
              });

            if (!food) {
              status.textContent =
                "Move onto a food first.";

              return;
            }

            activeFood = food;

            food.classList.add(
              "week4-feed-food-held"
            );

            status.textContent =
              "KEEP HOLDING — feed an animal.";

            if (soundEnabled) {
              if (!leftClickSound) {
                leftClickSound =
                  new Audio(
                    "/sounds/mouseclick.mp3"
                  );

                leftClickSound.volume =
                  0.5;
              }

              leftClickSound.pause();
              leftClickSound.currentTime =
                0.12;

              leftClickSound
                .play()
                .catch(() => {});
            }
          }
        );


      const removeRightDown =
        input.subscribe(
          "rightDown",
          () => {
            if (finished) {
              return;
            }

            if (activeFood) {
              returnFood(activeFood);
              activeFood = null;
            }

            clearReady();

            showWrongButtonWarning();

            status.textContent =
              "Use the LEFT button.";
          }
        );


      const nativeReleaseHandler =
        (event) => {
          if (event.button !== 0) {
            return;
          }

          finishDrop();
        };

      window.addEventListener(
        "mouseup",
        nativeReleaseHandler,
        true
      );


      activityCleanup = () => {
        removeMove?.();
        removeLeftDown?.();
        removeRightDown?.();

        window.removeEventListener(
          "mouseup",
          nativeReleaseHandler,
          true
        );

      };

      updateProgress();
    }


    function startBuildRobotActivity() {
      const input = window.HandsOnMouseInput;

      const area =
        document.getElementById(
          "week4RobotArea"
        );

      const pointer =
        document.getElementById(
          "week4RobotPointer"
        );

      const status =
        document.getElementById(
          "week4RobotStatus"
        );

      const progress =
        document.getElementById(
          "week4RobotProgress"
        );

      if (
        !input ||
        !area ||
        !pointer ||
        !status ||
        !progress
      ) {
        return;
      }

      const parts =
        Array.from(
          area.querySelectorAll(
            ".week4-robot-part"
          )
        );

      const slots =
        Array.from(
          area.querySelectorAll(
            ".week4-robot-slot"
          )
        );

      let activePart = null;
      let completedCount = 0;
      let finished = false;

      parts.forEach((part) => {
        part.dataset.startLeft =
          part.style.left;

        part.dataset.startTop =
          part.style.top;
      });

      function pointerOnPart(part) {
        return pointerTipHitsElement(
          pointer,
          part
        );
      }

      function matchingSlot(part) {
        return slots.find(
          slot =>
            slot.dataset.match ===
            part.dataset.match
        );
      }

      function slotUnderPart(part) {
        if (!part) {
          return null;
        }

        const partRect =
          part.getBoundingClientRect();

        const centerX =
          partRect.left +
          partRect.width / 2;

        const centerY =
          partRect.top +
          partRect.height / 2;

        return slots.find((slot) => {
          const rect =
            slot.getBoundingClientRect();

          return (
            centerX >= rect.left &&
            centerX <= rect.right &&
            centerY >= rect.top &&
            centerY <= rect.bottom
          );
        }) || null;
      }

      function clearReady() {
        parts.forEach((part) => {
          part.classList.remove(
            "week4-robot-part-ready"
          );
        });

        slots.forEach((slot) => {
          slot.classList.remove(
            "week4-robot-slot-ready",
            "week4-robot-slot-wrong"
          );
        });
      }

      function returnPart(part) {
        if (!part) {
          return;
        }

        part.style.left =
          part.dataset.startLeft;

        part.style.top =
          part.dataset.startTop;

        part.classList.remove(
          "week4-robot-part-held",
          "week4-robot-part-ready"
        );
      }

      function updateProgress() {
        progress.textContent =
          `${completedCount} of ${parts.length}`;
      }

      function snapPart(
        part,
        slot
      ) {
        const areaRect =
          area.getBoundingClientRect();

        const slotRect =
          slot.getBoundingClientRect();

        part.style.left =
          `${
            slotRect.left -
            areaRect.left +
            slotRect.width / 2
          }px`;

        part.style.top =
          `${
            slotRect.top -
            areaRect.top +
            slotRect.height / 2
          }px`;

        part.classList.remove(
          "week4-robot-part-held",
          "week4-robot-part-ready"
        );

        part.classList.add(
          "week4-robot-part-complete"
        );

        slot.classList.add(
          "week4-robot-slot-complete"
        );

        completedCount += 1;
        updateProgress();

        status.textContent =
          "Robot part connected! ✓";

        if (soundEnabled) {
          const sound =
            new Audio(
              "/sounds/correct.mp3"
            );

          sound.volume = 0.6;
          sound.currentTime = 0;

          sound
            .play()
            .catch(() => {});
        }

        setTimeout(() => {
          if (
            completedCount >=
            parts.length
          ) {
            finished = true;

            progress.textContent =
              "5 of 5 ✓";

            status.textContent =
              "Robot complete!";

            area.classList.add(
              "week4-robot-complete"
            );

            /*
             * Give the student a moment to see the
             * finished robot, then make the whole
             * assembled robot walk off the screen.
             */
            let robotStepSound = null;

            setTimeout(() => {
              area.classList.add(
                "week4-robot-walking"
              );

              status.textContent =
                "Bye, robot! 👋";

              if (soundEnabled) {
                robotStepSound =
                  new Audio(
                    "/sounds/robotstep.mp3"
                  );

                robotStepSound.volume = 0.55;
                robotStepSound.loop = true;
                robotStepSound.currentTime = 0;

                robotStepSound
                  .play()
                  .catch(() => {});
              }
            }, 650);

            /*
             * Stop the walking sound when the
             * robot reaches the edge of the screen.
             */
            setTimeout(() => {
              if (robotStepSound) {
                robotStepSound.pause();
                robotStepSound.currentTime = 0;
                robotStepSound = null;
              }
            }, 2950);

            /*
             * Show the celebration after the robot
             * finishes walking away.
             */
            setTimeout(() => {
              showActivityComplete({
                title: "Robot Complete!",
                message:
                  "You built the whole robot!",
                retry: () => {
                  showActivity(
                    "build-robot"
                  );
                }
              });
            }, 3100);

            return;
          }

          status.textContent =
            "Choose another robot part.";
        }, 400);
      }

      function finishDrop() {
        if (
          !activePart ||
          finished
        ) {
          return;
        }

        const part = activePart;
        activePart = null;

        const droppedSlot =
          slotUnderPart(part);

        const correctSlot =
          matchingSlot(part);

        clearReady();

        /*
         * Success happens only on physical release.
         */
        if (
          droppedSlot &&
          droppedSlot === correctSlot
        ) {
          snapPart(
            part,
            correctSlot
          );

          return;
        }

        if (droppedSlot) {
          droppedSlot.classList.add(
            "week4-robot-slot-wrong"
          );

          status.textContent =
            "Try a different robot spot.";

          setTimeout(() => {
            droppedSlot.classList.remove(
              "week4-robot-slot-wrong"
            );
          }, 400);
        } else {
          status.textContent =
            "Let go inside a robot spot.";
        }

        returnPart(part);
      }


      const removeMove =
        input.subscribe(
          "move",
          (event) => {
            if (finished) {
              return;
            }

            const rect =
              area.getBoundingClientRect();

            const inside =
              event.x >= rect.left &&
              event.x <= rect.right &&
              event.y >= rect.top &&
              event.y <= rect.bottom;

            if (!inside) {
              return;
            }

            const offsetX =
              pointer.offsetWidth * 0.90;

            const offsetY =
              pointer.offsetHeight * 0.50;

            pointer.style.left =
              `${
                event.x -
                rect.left -
                offsetX
              }px`;

            pointer.style.top =
              `${
                event.y -
                rect.top -
                offsetY
              }px`;

            if (!activePart) {
              return;
            }

            activePart.style.left =
              `${event.x - rect.left}px`;

            activePart.style.top =
              `${event.y - rect.top}px`;

            clearReady();

            const slot =
              slotUnderPart(
                activePart
              );

            if (!slot) {
              status.textContent =
                "Keep holding — find its spot.";

              return;
            }

            activePart.classList.add(
              "week4-robot-part-ready"
            );

            slot.classList.add(
              "week4-robot-slot-ready"
            );

            if (
              slot ===
              matchingSlot(activePart)
            ) {
              status.textContent =
                "That's the spot — LET GO!";
            } else {
              status.textContent =
                "Does that part fit there?";
            }
          }
        );


      const removeLeftDown =
        input.subscribe(
          "leftDown",
          () => {
            if (
              finished ||
              activePart
            ) {
              return;
            }

            const part =
              parts.find((item) => {
                return (
                  !item.classList.contains(
                    "week4-robot-part-complete"
                  ) &&
                  pointerOnPart(item)
                );
              });

            if (!part) {
              status.textContent =
                "Move onto a robot part first.";

              return;
            }

            activePart = part;

            part.classList.add(
              "week4-robot-part-held"
            );

            status.textContent =
              "KEEP HOLDING — find its spot.";

            if (soundEnabled) {
              if (!leftClickSound) {
                leftClickSound =
                  new Audio(
                    "/sounds/mouseclick.mp3"
                  );

                leftClickSound.volume =
                  0.5;
              }

              leftClickSound.pause();
              leftClickSound.currentTime =
                0.12;

              leftClickSound
                .play()
                .catch(() => {});
            }
          }
        );


      const removeRightDown =
        input.subscribe(
          "rightDown",
          () => {
            if (finished) {
              return;
            }

            if (activePart) {
              returnPart(activePart);
              activePart = null;
            }

            clearReady();

            showWrongButtonWarning();

            status.textContent =
              "Use the LEFT button.";
          }
        );


      const nativeReleaseHandler =
        (event) => {
          if (event.button !== 0) {
            return;
          }

          finishDrop();
        };

      window.addEventListener(
        "mouseup",
        nativeReleaseHandler,
        true
      );


      activityCleanup = () => {
        removeMove?.();
        removeLeftDown?.();
        removeRightDown?.();

        window.removeEventListener(
          "mouseup",
          nativeReleaseHandler,
          true
        );
      };

      updateProgress();
    }


    function startMakePizzaActivity() {
      const input = window.HandsOnMouseInput;

      const area =
        document.getElementById(
          "week4PizzaArea"
        );

      const pizza =
        document.getElementById(
          "week4Pizza"
        );

      const pointer =
        document.getElementById(
          "week4PizzaPointer"
        );

      const status =
        document.getElementById(
          "week4PizzaStatus"
        );

      const progress =
        document.getElementById(
          "week4PizzaProgress"
        );

      if (
        !input ||
        !area ||
        !pizza ||
        !pointer ||
        !status ||
        !progress
      ) {
        return;
      }

      const toppingChoices =
        Array.from(
          area.querySelectorAll(
            ".week4-pizza-topping-choice"
          )
        );

      const preventNativeDrag =
        (event) => {
          event.preventDefault();
        };

      area.addEventListener(
        "dragstart",
        preventNativeDrag
      );

      area.addEventListener(
        "selectstart",
        preventNativeDrag
      );

      let activeTopping = null;
      let toppingCount = 0;
      let finished = false;

      function pointerOnChoice(choice) {
        return pointerTipHitsElement(
          pointer,
          choice
        );
      }

      function toppingInsidePizza(topping) {
        if (!topping) {
          return false;
        }

        const toppingRect =
          topping.getBoundingClientRect();

        const pizzaRect =
          pizza.getBoundingClientRect();

        const centerX =
          toppingRect.left +
          toppingRect.width / 2;

        const centerY =
          toppingRect.top +
          toppingRect.height / 2;

        const pizzaCenterX =
          pizzaRect.left +
          pizzaRect.width / 2;

        const pizzaCenterY =
          pizzaRect.top +
          pizzaRect.height / 2;

        const dx =
          centerX - pizzaCenterX;

        const dy =
          centerY - pizzaCenterY;

        const distance =
          Math.sqrt(
            dx * dx +
            dy * dy
          );

        return (
          distance <=
          pizzaRect.width * 0.39
        );
      }

      function clearReady() {
        pizza.classList.remove(
          "week4-pizza-ready"
        );
      }

      function removeActiveTopping() {
        if (!activeTopping) {
          return;
        }

        activeTopping.remove();
        activeTopping = null;

        clearReady();
      }

      function updateProgress() {
        progress.textContent =
          `${toppingCount} of 10`;
      }

      function createToppingFromChoice(choice) {
        const topping =
          document.createElement("div");

        topping.className =
          `week4-pizza-placed-topping ${choice.dataset.topping}`;

        topping.innerHTML =
          '<span class="pizza-topping-visual"></span>';

        area.appendChild(topping);

        return topping;
      }

      function finishPlacement(topping) {
        topping.classList.remove(
          "week4-pizza-active-topping"
        );

        topping.classList.add(
          "week4-pizza-topping-finished"
        );

        pizza.classList.add(
          "week4-pizza-success"
        );

        toppingCount += 1;
        updateProgress();

        status.textContent =
          "Topping added! ✓";

        if (soundEnabled) {
          const sound =
            new Audio(
              "/sounds/correct.mp3"
            );

          sound.volume = 0.55;
          sound.currentTime = 0;

          sound
            .play()
            .catch(() => {});
        }

        setTimeout(() => {
          pizza.classList.remove(
            "week4-pizza-success"
          );

          if (toppingCount >= 10) {
            finished = true;

            progress.textContent =
              "10 of 10 ✓";

            status.textContent =
              "Pizza ready! 🍕";

            pizza.classList.add(
              "week4-pizza-complete"
            );

            area.classList.add(
              "week4-pizza-area-complete"
            );

            /*
             * Take five visible cartoon bites from
             * the pizza edge, one at a time.
             */
            const bitePositions = [
              "bite-one",
              "bite-two",
              "bite-three",
              "bite-four",
              "bite-five",
              "bite-six",
              "bite-seven",
              "bite-eight"
            ];

            bitePositions.forEach(
              (biteName, biteIndex) => {
                setTimeout(() => {
                  const bite =
                    document.createElement("span");

                  bite.className =
                    `week4-pizza-bite ${biteName}`;

                  pizza.appendChild(bite);

                  status.textContent =
                    "Yum!";

                  if (soundEnabled) {
                    const biteSound =
                      new Audio(
                        "/sounds/crunching.mp3"
                      );

                    biteSound.volume = 0.25;
                    biteSound.currentTime = 0;

                    biteSound
                      .play()
                      .catch(() => {});
                  }
                }, 500 + biteIndex * 340);
              }
            );

            setTimeout(() => {
              pizza.classList.add(
                "week4-pizza-eaten"
              );

              area
                .querySelectorAll(
                  ".week4-pizza-topping-finished"
                )
                .forEach((topping) => {
                  topping.classList.add(
                    "week4-pizza-topping-eaten"
                  );
                });

              status.textContent =
                "All gone! 😋";
            }, 3400);

            setTimeout(() => {
              showActivityComplete({
                title: "Pizza Ready!",
                message:
                  "You made a delicious pizza!",
                retry: () => {
                  showActivity(
                    "make-pizza"
                  );
                }
              });
            }, 3900);

            return;
          }

          status.textContent =
            "Choose another topping.";
        }, 300);
      }

      function finishDrop() {
        if (
          !activeTopping ||
          finished
        ) {
          return;
        }

        const topping =
          activeTopping;

        activeTopping = null;

        clearReady();

        /*
         * Counts only when physically released
         * over the pizza.
         */
        if (
          toppingInsidePizza(topping)
        ) {
          finishPlacement(topping);
          return;
        }

        topping.remove();

        status.textContent =
          "Let go on the pizza.";
      }


      const removeMove =
        input.subscribe(
          "move",
          (event) => {
            if (finished) {
              return;
            }

            const rect =
              area.getBoundingClientRect();

            const inside =
              event.x >= rect.left &&
              event.x <= rect.right &&
              event.y >= rect.top &&
              event.y <= rect.bottom;

            if (!inside) {
              return;
            }

            const offsetX =
              pointer.offsetWidth * 0.90;

            const offsetY =
              pointer.offsetHeight * 0.50;

            pointer.style.left =
              `${
                event.x -
                rect.left -
                offsetX
              }px`;

            pointer.style.top =
              `${
                event.y -
                rect.top -
                offsetY
              }px`;

            if (!activeTopping) {
              return;
            }

            activeTopping.style.left =
              `${event.x - rect.left}px`;

            activeTopping.style.top =
              `${event.y - rect.top}px`;

            clearReady();

            if (
              toppingInsidePizza(
                activeTopping
              )
            ) {
              pizza.classList.add(
                "week4-pizza-ready"
              );

              status.textContent =
                "Looks tasty — LET GO!";
            } else {
              status.textContent =
                "KEEP HOLDING — move onto the pizza.";
            }
          }
        );


      const removeLeftDown =
        input.subscribe(
          "leftDown",
          () => {
            if (
              finished ||
              activeTopping
            ) {
              return;
            }

            const choice =
              toppingChoices.find(
                item =>
                  pointerOnChoice(item)
              );

            if (!choice) {
              status.textContent =
                "Choose a topping.";

              return;
            }

            activeTopping =
              createToppingFromChoice(
                choice
              );

            const areaRect =
              area.getBoundingClientRect();

            const choiceRect =
              choice.getBoundingClientRect();

            activeTopping.style.left =
              `${
                choiceRect.left -
                areaRect.left +
                choiceRect.width / 2
              }px`;

            activeTopping.style.top =
              `${
                choiceRect.top -
                areaRect.top +
                choiceRect.height / 2
              }px`;

            activeTopping.classList.add(
              "week4-pizza-active-topping"
            );

            status.textContent =
              "KEEP HOLDING — put it on your pizza.";

            if (soundEnabled) {
              if (!leftClickSound) {
                leftClickSound =
                  new Audio(
                    "/sounds/mouseclick.mp3"
                  );

                leftClickSound.volume =
                  0.5;
              }

              leftClickSound.pause();
              leftClickSound.currentTime =
                0.12;

              leftClickSound
                .play()
                .catch(() => {});
            }
          }
        );


      const removeRightDown =
        input.subscribe(
          "rightDown",
          () => {
            if (finished) {
              return;
            }

            removeActiveTopping();

            showWrongButtonWarning();

            status.textContent =
              "Use the LEFT button.";
          }
        );


      const nativeReleaseHandler =
        (event) => {
          if (event.button !== 0) {
            return;
          }

          finishDrop();
        };

      window.addEventListener(
        "mouseup",
        nativeReleaseHandler,
        true
      );


      activityCleanup = () => {
        removeMove?.();
        removeLeftDown?.();
        removeRightDown?.();

        window.removeEventListener(
          "mouseup",
          nativeReleaseHandler,
          true
        );

        area.removeEventListener(
          "dragstart",
          preventNativeDrag
        );

        area.removeEventListener(
          "selectstart",
          preventNativeDrag
        );
      };

      updateProgress();
    }



    function showActivity(activityId) {
      stopCurrentActivity();

      hub.hidden = true;
      activityView.hidden = false;

      if (activityId === "feed-animals") {
        activityView.innerHTML = `
          <div class="week4-mini-activity-shell week4-feed-shell">

            <button
              class="week4-activity-back"
              type="button"
            >
              ← Activities
            </button>

            <div class="week4-mini-activity-heading">
              <div class="week4-mini-icon">🐶</div>

              <h2>Feed the Animals</h2>

              <p>
                Drag each food to the animal that eats it.
              </p>
            </div>

            <div class="week4-feed-progress">
              Fed:
              <strong id="week4FeedAnimalsProgress">
                0 of 5
              </strong>
            </div>

            <div
              id="week4FeedAnimalsArea"
              class="week4-feed-area"
            >

              <!-- FOODS -->

              <div
                class="week4-feed-food"
                data-for-animal="rabbit"
                style="left: 13%; top: 25%;"
              >
                🥕
                <span>CARROT</span>
              </div>

              <div
                class="week4-feed-food"
                data-for-animal="cat"
                style="left: 27%; top: 52%;"
              >
                🐟
                <span>FISH</span>
              </div>

              <div
                class="week4-feed-food"
                data-for-animal="dog"
                style="left: 13%; top: 79%;"
              >
                🦴
                <span>BONE</span>
              </div>

              <div
                class="week4-feed-food"
                data-for-animal="chicken"
                style="left: 29%; top: 27%;"
              >
                🌽
                <span>CORN</span>
              </div>

              <div
                class="week4-feed-food"
                data-for-animal="monkey"
                style="left: 29%; top: 77%;"
              >
                🍌
                <span>BANANA</span>
              </div>


              <!-- ANIMALS -->

              <div
                class="week4-feed-animal"
                data-animal="dog"
                style="left: 66%; top: 26%;"
              >
                <span class="week4-feed-animal-icon">
                  🐶
                </span>

                <strong>DOG</strong>

                <span class="week4-feed-happy"></span>
              </div>

              <div
                class="week4-feed-animal"
                data-animal="rabbit"
                style="left: 84%; top: 52%;"
              >
                <span class="week4-feed-animal-icon">
                  🐰
                </span>

                <strong>BUNNY</strong>

                <span class="week4-feed-happy"></span>
              </div>

              <div
                class="week4-feed-animal"
                data-animal="cat"
                style="left: 66%; top: 78%;"
              >
                <span class="week4-feed-animal-icon">
                  🐱
                </span>

                <strong>CAT</strong>

                <span class="week4-feed-happy"></span>
              </div>

              <div
                class="week4-feed-animal"
                data-animal="chicken"
                style="left: 82%; top: 28%;"
              >
                <span class="week4-feed-animal-icon">
                  🐔
                </span>

                <strong>CHICKEN</strong>

                <span class="week4-feed-happy"></span>
              </div>

              <div
                class="week4-feed-animal"
                data-animal="monkey"
                style="left: 82%; top: 76%;"
              >
                <span class="week4-feed-animal-icon">
                  🐵
                </span>

                <strong>MONKEY</strong>

                <span class="week4-feed-happy"></span>
              </div>


              <div
                id="week4FeedAnimalsPointer"
                class="week4-feed-pointer"
              >
                ➤
              </div>

              <div
                id="week4FeedAnimalsStatus"
                class="week4-feed-status"
              >
                Choose a food.
              </div>

            </div>

          </div>
        `;

      }

      if (activityId === "build-robot") {
        activityView.innerHTML = `
          <div class="week4-mini-activity-shell week4-robot-shell">

            <button
              class="week4-activity-back"
              type="button"
            >
              ← Activities
            </button>

            <div class="week4-mini-activity-heading">
              <div class="week4-mini-icon">
                🤖
              </div>

              <h2>Build a Robot</h2>

              <p>
                Drag each robot part into its matching spot.
              </p>
            </div>

            <div class="week4-robot-progress">
              Built:
              <strong id="week4RobotProgress">
                0 of 5
              </strong>
            </div>

            <div
              id="week4RobotArea"
              class="week4-robot-area"
            >

              <!-- MIXED ROBOT PARTS -->

              <div
                class="week4-robot-part week4-robot-head"
                data-match="head"
                style="left: 13%; top: 24%;"
              >
                <span>🤖</span>
              </div>

              <div
                class="week4-robot-part week4-robot-left-leg"
                data-match="left-leg"
                style="left: 30%; top: 25%;"
              >
                <span>🦿</span>
              </div>

              <div
                class="week4-robot-part week4-robot-right-arm"
                data-match="right-arm"
                style="left: 14%; top: 52%;"
              >
                <span>🦾</span>
              </div>

              <div
                class="week4-robot-part week4-robot-left-arm"
                data-match="left-arm"
                style="left: 30%; top: 72%;"
              >
                <span>🦾</span>
              </div>

              <div
                class="week4-robot-part week4-robot-right-leg"
                data-match="right-leg"
                style="left: 14%; top: 78%;"
              >
                <span>🦿</span>
              </div>


              <!-- ROBOT BUILD AREA -->

              <div class="week4-robot-build">

                <div
                  class="week4-robot-slot robot-slot-head"
                  data-match="head"
                >
                  HEAD
                </div>

                <div class="week4-robot-body">
                  ROBOT
                </div>

                <div
                  class="week4-robot-slot robot-slot-left-arm"
                  data-match="left-arm"
                >
                  ARM
                </div>

                <div
                  class="week4-robot-slot robot-slot-right-arm"
                  data-match="right-arm"
                >
                  ARM
                </div>

                <div
                  class="week4-robot-slot robot-slot-left-leg"
                  data-match="left-leg"
                >
                  LEG
                </div>

                <div
                  class="week4-robot-slot robot-slot-right-leg"
                  data-match="right-leg"
                >
                  LEG
                </div>

              </div>


              <div
                id="week4RobotPointer"
                class="week4-robot-pointer"
              >
                ➤
              </div>

              <div
                id="week4RobotStatus"
                class="week4-robot-status"
              >
                Choose a robot part.
              </div>

            </div>

          </div>
        `;
      }

      if (activityId === "make-pizza") {
        activityView.innerHTML = `
          <div class="week4-mini-activity-shell week4-pizza-shell">

            <button
              class="week4-activity-back"
              type="button"
            >
              ← Activities
            </button>

            <div class="week4-mini-activity-heading">
              <div class="week4-mini-icon">
                🍕
              </div>

              <h2>Make a Pizza</h2>

              <p>
                Drag each topping anywhere onto your pizza.
              </p>
            </div>

            <div class="week4-pizza-progress">
              Toppings:
              <strong id="week4PizzaProgress">
                0 of 10
              </strong>
            </div>

            <div
              id="week4PizzaArea"
              class="week4-pizza-area"
            >

              <!-- TOPPINGS -->

              <div
                class="week4-pizza-topping-choice pizza-pepperoni"
                data-topping="pizza-pepperoni"
                style="left: 12%; top: 22%;"
              >
                <span class="pizza-topping-visual"></span>
                <strong>PEPPERONI</strong>
              </div>

              <div
                class="week4-pizza-topping-choice pizza-mushroom"
                data-topping="pizza-mushroom"
                style="left: 29%; top: 26%;"
              >
                <span class="pizza-topping-visual"></span>
                <strong>MUSHROOM</strong>
              </div>

              <div
                class="week4-pizza-topping-choice pizza-pepper"
                data-topping="pizza-pepper"
                style="left: 20%; top: 50%;"
              >
                <span class="pizza-topping-visual"></span>
                <strong>PEPPER</strong>
              </div>

              <div
                class="week4-pizza-topping-choice pizza-olive"
                data-topping="pizza-olive"
                style="left: 12%; top: 76%;"
              >
                <span class="pizza-topping-visual"></span>
                <strong>OLIVE</strong>
              </div>



              <!-- PIZZA -->

              <div
                id="week4Pizza"
                class="week4-pizza"
              >
                <div class="week4-pizza-crust"></div>
                <div class="week4-pizza-sauce"></div>
                <div class="week4-pizza-cheese-base"></div>
              </div>


              <div
                id="week4PizzaPointer"
                class="week4-pizza-pointer"
              >
                ➤
              </div>

              <div
                id="week4PizzaStatus"
                class="week4-pizza-status"
              >
                Choose a topping.
              </div>

            </div>

          </div>
        `;
      }

      activityView
        .querySelector(
          ".week4-activity-back"
        )
        ?.addEventListener(
          "click",
          showHub
        );

      /*
       * Start the mini-game only after its HTML
       * and navigation controls are fully rendered.
       */
      if (activityId === "feed-animals") {
        requestAnimationFrame(() => {
          startFeedAnimalsActivity();
        });
      }

      if (activityId === "build-robot") {
        requestAnimationFrame(() => {
          startBuildRobotActivity();
        });
      }

      if (activityId === "make-pizza") {
        requestAnimationFrame(() => {
          startMakePizzaActivity();
        });
      }
    }

    screen
      .querySelectorAll(
        "[data-week4-activity]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            showActivity(
              button.dataset.week4Activity
            );
          }
        );
      });
  }

  function startWeek4MovingTargetsBehavior() {
    const input = window.HandsOnMouseInput;

    const area =
      document.getElementById("week4MovingArea");

    const object =
      document.getElementById("week4MovingObject");

    const destination =
      document.getElementById("week4MovingDestination");

    const pointer =
      document.getElementById("week4MovingPointer");

    const status =
      document.getElementById("week4MovingStatus");

    const progress =
      document.getElementById("week4MovingProgress");

    if (
      !input ||
      !area ||
      !object ||
      !destination ||
      !pointer ||
      !status ||
      !progress
    ) {
      return;
    }

    const rounds = [
      {
        object: "★",
        label: "STAR",
        size: "large",
        drift: "a"
      },
      {
        object: "🔵",
        label: "BALL",
        size: "medium",
        drift: "b"
      },
      {
        object: "💎",
        label: "GEM",
        size: "small",
        drift: "c"
      },
      {
        object: "🍎",
        label: "APPLE",
        size: "small",
        drift: "d"
      },
      {
        object: "⚡",
        label: "LIGHTNING",
        size: "small",
        drift: "e"
      }
    ];

    let roundIndex = 0;
    let dragging = false;
    let finished = false;

    object.dataset.startLeft = "18%";
    object.dataset.startTop = "50%";

    function pointerOnObject() {
      return pointerTipHitsElement(
        pointer,
        object
      );
    }

    function objectInsideDestination() {
      const objectRect =
        object.getBoundingClientRect();

      const destinationRect =
        destination.getBoundingClientRect();

      const centerX =
        objectRect.left +
        objectRect.width / 2;

      const centerY =
        objectRect.top +
        objectRect.height / 2;

      return (
        centerX >= destinationRect.left &&
        centerX <= destinationRect.right &&
        centerY >= destinationRect.top &&
        centerY <= destinationRect.bottom
      );
    }

    function clearReady() {
      object.classList.remove(
        "week4-moving-object-ready"
      );

      destination.classList.remove(
        "week4-moving-destination-ready"
      );
    }

    function resetObject() {
      dragging = false;

      object.style.left =
        object.dataset.startLeft;

      object.style.top =
        object.dataset.startTop;

      object.classList.remove(
        "week4-moving-object-held",
        "week4-moving-object-ready",
        "week4-moving-object-success"
      );

      clearReady();
    }

    function loadRound() {
      const round =
        rounds[roundIndex];

      resetObject();

      object.textContent =
        round.object;

      object.dataset.label =
        round.label;

      destination.className =
        "week4-moving-destination";

      destination.classList.add(
        `week4-moving-size-${round.size}`,
        `week4-moving-drift-${round.drift}`
      );

      progress.textContent =
        `${roundIndex + 1} of ${rounds.length}`;

      status.textContent =
        "Drag the object into the moving target.";
    }

    function finishRound() {
      dragging = false;

      object.classList.remove(
        "week4-moving-object-held",
        "week4-moving-object-ready"
      );

      destination.classList.remove(
        "week4-moving-destination-ready"
      );

      object.classList.add(
        "week4-moving-object-success"
      );

      destination.classList.add(
        "week4-moving-destination-success"
      );

      status.textContent =
        "Great drop! ✓";

      if (soundEnabled) {
        const sound =
          new Audio("/sounds/correct.mp3");

        sound.volume = 0.6;
        sound.currentTime = 0;

        sound.play().catch(() => {});
      }

      setTimeout(() => {
        destination.classList.remove(
          "week4-moving-destination-success"
        );

        object.classList.remove(
          "week4-moving-object-success"
        );

        roundIndex += 1;

        if (
          roundIndex >=
          rounds.length
        ) {
          finished = true;

          destination.style.animation =
            "none";

          progress.textContent =
            "5 of 5 ✓";

          status.textContent =
            "Moving Targets complete! Great job!";

          area.classList.add(
            "week4-moving-complete"
          );

          return;
        }

        loadRound();
      }, 650);
    }

    function finishDrop() {
      if (
        !dragging ||
        finished
      ) {
        return;
      }

      /*
       * Success is checked ONLY when the student
       * physically releases the left mouse button.
       */
      const releasedInside =
        objectInsideDestination();

      if (releasedInside) {
        finishRound();
        return;
      }

      resetObject();

      status.textContent =
        "Almost! Try to let go inside the moving target.";
    }

    removeWeek4MovingMoveListener =
      input.subscribe("move", event => {
        if (finished) {
          return;
        }

        const rect =
          area.getBoundingClientRect();

        const inside =
          event.x >= rect.left &&
          event.x <= rect.right &&
          event.y >= rect.top &&
          event.y <= rect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.90;

        const offsetY =
          pointer.offsetHeight * 0.50;

        pointer.style.left =
          `${event.x - rect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - rect.top - offsetY}px`;

        if (!dragging) {
          return;
        }

        object.style.left =
          `${event.x - rect.left}px`;

        object.style.top =
          `${event.y - rect.top}px`;

        clearReady();

        if (
          objectInsideDestination()
        ) {
          object.classList.add(
            "week4-moving-object-ready"
          );

          destination.classList.add(
            "week4-moving-destination-ready"
          );

          status.textContent =
            "You're inside — LET GO!";
        } else {
          status.textContent =
            "Keep holding and follow the target.";
        }
      });

    removeWeek4MovingLeftDownListener =
      input.subscribe("leftDown", () => {
        if (
          finished ||
          dragging
        ) {
          return;
        }

        if (!pointerOnObject()) {
          status.textContent =
            "Move onto the object first.";
          return;
        }

        dragging = true;

        object.classList.add(
          "week4-moving-object-held"
        );

        status.textContent =
          "KEEP HOLDING — catch the target!";

        if (soundEnabled) {
          if (!leftClickSound) {
            leftClickSound =
              new Audio(
                "/sounds/mouseclick.mp3"
              );

            leftClickSound.volume =
              0.5;
          }

          leftClickSound.pause();
          leftClickSound.currentTime =
            0.12;

          leftClickSound
            .play()
            .catch(() => {});
        }
      });

    removeWeek4MovingRightListener =
      input.subscribe("rightDown", () => {
        if (finished) {
          return;
        }

        resetObject();

        showWrongButtonWarning();

        status.textContent =
          "Use the LEFT button.";
      });

    week4MovingNativeReleaseHandler =
      event => {
        if (event.button !== 0) {
          return;
        }

        finishDrop();
      };

    window.addEventListener(
      "mouseup",
      week4MovingNativeReleaseHandler,
      true
    );

    loadRound();
  }

  function startWeek4PuzzleBehavior() {
    const input = window.HandsOnMouseInput;

    const area =
      document.getElementById("week4PuzzleArea");

    const pointer =
      document.getElementById("week4PuzzlePointer");

    const status =
      document.getElementById("week4PuzzleStatus");

    const progress =
      document.getElementById("week4PuzzleProgress");

    if (
      !input ||
      !area ||
      !pointer ||
      !status ||
      !progress
    ) {
      return;
    }

    const pieces =
      Array.from(
        area.querySelectorAll(
          ".week4-puzzle-piece"
        )
      );

    const slots =
      Array.from(
        area.querySelectorAll(
          ".week4-puzzle-slot"
        )
      );

    let activePiece = null;
    let completedCount = 0;
    let finished = false;

    pieces.forEach((piece) => {
      piece.dataset.startLeft =
        piece.style.left;

      piece.dataset.startTop =
        piece.style.top;
    });

    function pointerOnPiece(piece) {
      return pointerTipHitsElement(
        pointer,
        piece
      );
    }

    function matchingSlot(piece) {
      return slots.find(
        slot =>
          slot.dataset.match ===
          piece.dataset.match
      );
    }

    function slotUnderPiece(piece) {
      if (!piece) {
        return null;
      }

      const pieceRect =
        piece.getBoundingClientRect();

      const centerX =
        pieceRect.left +
        pieceRect.width / 2;

      const centerY =
        pieceRect.top +
        pieceRect.height / 2;

      return slots.find((slot) => {
        const rect =
          slot.getBoundingClientRect();

        return (
          centerX >= rect.left &&
          centerX <= rect.right &&
          centerY >= rect.top &&
          centerY <= rect.bottom
        );
      }) || null;
    }

    function clearReady() {
      pieces.forEach((piece) => {
        piece.classList.remove(
          "week4-puzzle-piece-ready"
        );
      });

      slots.forEach((slot) => {
        slot.classList.remove(
          "week4-puzzle-slot-ready",
          "week4-puzzle-slot-wrong"
        );
      });
    }

    function returnPiece(piece) {
      if (!piece) {
        return;
      }

      piece.style.left =
        piece.dataset.startLeft;

      piece.style.top =
        piece.dataset.startTop;

      piece.classList.remove(
        "week4-puzzle-piece-held",
        "week4-puzzle-piece-ready"
      );
    }

    function updateProgress() {
      progress.textContent =
        `${completedCount} of ${pieces.length}`;
    }

    function snapPiece(
      piece,
      slot
    ) {
      const areaRect =
        area.getBoundingClientRect();

      const slotRect =
        slot.getBoundingClientRect();

      piece.style.left =
        `${
          slotRect.left -
          areaRect.left +
          slotRect.width / 2
        }px`;

      piece.style.top =
        `${
          slotRect.top -
          areaRect.top +
          slotRect.height / 2
        }px`;

      piece.classList.remove(
        "week4-puzzle-piece-held",
        "week4-puzzle-piece-ready"
      );

      piece.classList.add(
        "week4-puzzle-piece-complete"
      );

      slot.classList.add(
        "week4-puzzle-slot-complete"
      );

      completedCount += 1;
      updateProgress();

      status.textContent =
        "Perfect fit! ✓";

      if (soundEnabled) {
        const correctSound =
          new Audio("/sounds/correct.mp3");

        correctSound.volume = 0.6;
        correctSound.currentTime = 0;

        correctSound
          .play()
          .catch(() => {});
      }

      setTimeout(() => {
        if (
          completedCount >=
          pieces.length
        ) {
          finished = true;

          progress.textContent =
            "4 of 4 ✓";

          status.textContent =
            "Puzzle complete! Great job!";

          area.classList.add(
            "week4-puzzle-complete"
          );

          return;
        }

        status.textContent =
          "Choose another puzzle piece.";
      }, 450);
    }

    function finishDrop() {
      if (
        !activePiece ||
        finished
      ) {
        return;
      }

      const piece =
        activePiece;

      activePiece = null;

      const droppedSlot =
        slotUnderPiece(piece);

      const correctSlot =
        matchingSlot(piece);

      clearReady();

      if (
        droppedSlot &&
        droppedSlot === correctSlot
      ) {
        snapPiece(
          piece,
          correctSlot
        );

        return;
      }

      if (droppedSlot) {
        droppedSlot.classList.add(
          "week4-puzzle-slot-wrong"
        );

        status.textContent =
          "Try a different puzzle spot.";

        setTimeout(() => {
          droppedSlot.classList.remove(
            "week4-puzzle-slot-wrong"
          );
        }, 450);
      } else {
        status.textContent =
          "Let go inside a matching puzzle spot.";
      }

      returnPiece(piece);
    }

    removeWeek4PuzzleMoveListener =
      input.subscribe("move", (event) => {
        if (finished) {
          return;
        }

        const rect =
          area.getBoundingClientRect();

        const inside =
          event.x >= rect.left &&
          event.x <= rect.right &&
          event.y >= rect.top &&
          event.y <= rect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.90;

        const offsetY =
          pointer.offsetHeight * 0.50;

        pointer.style.left =
          `${event.x - rect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - rect.top - offsetY}px`;

        if (!activePiece) {
          return;
        }

        activePiece.style.left =
          `${event.x - rect.left}px`;

        activePiece.style.top =
          `${event.y - rect.top}px`;

        clearReady();

        const slot =
          slotUnderPiece(activePiece);

        if (!slot) {
          status.textContent =
            "Keep holding and find its match.";

          return;
        }

        activePiece.classList.add(
          "week4-puzzle-piece-ready"
        );

        slot.classList.add(
          "week4-puzzle-slot-ready"
        );

        if (
          slot ===
          matchingSlot(activePiece)
        ) {
          status.textContent =
            "It fits — LET GO!";
        } else {
          status.textContent =
            "Does that piece fit there?";
        }
      });

    removeWeek4PuzzleLeftDownListener =
      input.subscribe("leftDown", () => {
        if (
          finished ||
          activePiece
        ) {
          return;
        }

        const piece =
          pieces.find((item) => {
            return (
              !item.classList.contains(
                "week4-puzzle-piece-complete"
              ) &&
              pointerOnPiece(item)
            );
          });

        if (!piece) {
          status.textContent =
            "Move onto a puzzle piece first.";

          return;
        }

        activePiece =
          piece;

        piece.classList.add(
          "week4-puzzle-piece-held"
        );

        status.textContent =
          "KEEP HOLDING — find its matching spot.";

        if (soundEnabled) {
          if (!leftClickSound) {
            leftClickSound =
              new Audio(
                "/sounds/mouseclick.mp3"
              );

            leftClickSound.volume =
              0.5;
          }

          leftClickSound.pause();
          leftClickSound.currentTime =
            0.12;

          leftClickSound
            .play()
            .catch(() => {});
        }
      });

    removeWeek4PuzzleRightListener =
      input.subscribe("rightDown", () => {
        if (finished) {
          return;
        }

        if (activePiece) {
          returnPiece(
            activePiece
          );

          activePiece =
            null;
        }

        clearReady();

        showWrongButtonWarning();

        status.textContent =
          "Use the LEFT button.";
      });

    week4PuzzleNativeReleaseHandler =
      (event) => {
        if (event.button !== 0) {
          return;
        }

        finishDrop();
      };

    window.addEventListener(
      "mouseup",
      week4PuzzleNativeReleaseHandler,
      true
    );

    updateProgress();
  }

  function startWeek4CleanUpBehavior() {
    const input = window.HandsOnMouseInput;

    const area =
      document.getElementById("week4CleanUpArea");

    const pointer =
      document.getElementById("week4CleanUpPointer");

    const status =
      document.getElementById("week4CleanUpStatus");

    const progress =
      document.getElementById("week4CleanUpProgress");

    if (
      !input ||
      !area ||
      !pointer ||
      !status ||
      !progress
    ) {
      return;
    }

    const objects =
      Array.from(
        area.querySelectorAll(
          ".week4-clean-object"
        )
      );

    const destinations =
      Array.from(
        area.querySelectorAll(
          ".week4-clean-destination"
        )
      );

    let activeObject = null;
    let completedCount = 0;
    let finished = false;

    objects.forEach((object) => {
      object.dataset.startLeft =
        object.style.left;

      object.dataset.startTop =
        object.style.top;
    });

    function pointerOnObject(object) {
      return pointerTipHitsElement(
        pointer,
        object
      );
    }

    function matchingDestination(object) {
      return destinations.find(
        destination =>
          destination.dataset.match ===
          object.dataset.match
      );
    }

    function destinationUnderObject(object) {
      if (!object) {
        return null;
      }

      const objectRect =
        object.getBoundingClientRect();

      const centerX =
        objectRect.left +
        objectRect.width / 2;

      const centerY =
        objectRect.top +
        objectRect.height / 2;

      return destinations.find(
        destination => {
          const rect =
            destination.getBoundingClientRect();

          return (
            centerX >= rect.left &&
            centerX <= rect.right &&
            centerY >= rect.top &&
            centerY <= rect.bottom
          );
        }
      ) || null;
    }

    function clearReady() {
      objects.forEach((object) => {
        object.classList.remove(
          "week4-clean-object-ready"
        );
      });

      destinations.forEach(
        destination => {
          destination.classList.remove(
            "week4-clean-destination-ready",
            "week4-clean-destination-wrong"
          );
        }
      );
    }

    function returnObject(object) {
      if (!object) {
        return;
      }

      object.style.left =
        object.dataset.startLeft;

      object.style.top =
        object.dataset.startTop;

      object.classList.remove(
        "week4-clean-object-held",
        "week4-clean-object-ready"
      );
    }

    function updateProgress() {
      progress.textContent =
        `${completedCount} of ${objects.length}`;
    }

    function completeObject(
      object,
      destination
    ) {
      object.classList.remove(
        "week4-clean-object-held",
        "week4-clean-object-ready"
      );

      object.classList.add(
        "week4-clean-object-complete"
      );

      destination.classList.add(
        "week4-clean-destination-complete"
      );

      completedCount += 1;
      updateProgress();

      status.textContent =
        "Nice cleanup! ✓";

      if (soundEnabled) {
        const correctSound =
          new Audio("/sounds/correct.mp3");

        correctSound.volume = 0.6;
        correctSound.currentTime = 0;

        correctSound
          .play()
          .catch(() => {});
      }

      setTimeout(() => {
        if (
          completedCount >=
          objects.length
        ) {
          finished = true;

          progress.textContent =
            "4 of 4 ✓";

          status.textContent =
            "Classroom clean! Great job!";

          area.classList.add(
            "week4-clean-area-complete"
          );

          return;
        }

        status.textContent =
          "Choose another item to clean up.";
      }, 450);
    }

    function finishDrop() {
      if (
        !activeObject ||
        finished
      ) {
        return;
      }

      const object =
        activeObject;

      activeObject = null;

      const droppedDestination =
        destinationUnderObject(object);

      const correctDestination =
        matchingDestination(object);

      clearReady();

      if (
        droppedDestination &&
        droppedDestination ===
          correctDestination
      ) {
        completeObject(
          object,
          correctDestination
        );

        return;
      }

      if (droppedDestination) {
        droppedDestination.classList.add(
          "week4-clean-destination-wrong"
        );

        status.textContent =
          "That item belongs somewhere else.";

        setTimeout(() => {
          droppedDestination.classList.remove(
            "week4-clean-destination-wrong"
          );
        }, 450);
      } else {
        status.textContent =
          "Let go inside the correct spot.";
      }

      returnObject(object);
    }

    removeWeek4CleanUpMoveListener =
      input.subscribe("move", event => {
        if (finished) {
          return;
        }

        const rect =
          area.getBoundingClientRect();

        const inside =
          event.x >= rect.left &&
          event.x <= rect.right &&
          event.y >= rect.top &&
          event.y <= rect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.90;

        const offsetY =
          pointer.offsetHeight * 0.50;

        pointer.style.left =
          `${event.x - rect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - rect.top - offsetY}px`;

        if (!activeObject) {
          return;
        }

        activeObject.style.left =
          `${event.x - rect.left}px`;

        activeObject.style.top =
          `${event.y - rect.top}px`;

        clearReady();

        const destination =
          destinationUnderObject(
            activeObject
          );

        if (!destination) {
          status.textContent =
            "Keep holding and move.";
          return;
        }

        activeObject.classList.add(
          "week4-clean-object-ready"
        );

        destination.classList.add(
          "week4-clean-destination-ready"
        );

        if (
          destination ===
          matchingDestination(activeObject)
        ) {
          status.textContent =
            "That's the right spot — LET GO!";
        } else {
          status.textContent =
            "Is that where it belongs?";
        }
      });

    removeWeek4CleanUpLeftDownListener =
      input.subscribe("leftDown", () => {
        if (
          finished ||
          activeObject
        ) {
          return;
        }

        const object =
          objects.find(item => {
            return (
              !item.classList.contains(
                "week4-clean-object-complete"
              ) &&
              pointerOnObject(item)
            );
          });

        if (!object) {
          status.textContent =
            "Move onto an item first.";
          return;
        }

        activeObject = object;

        object.classList.add(
          "week4-clean-object-held"
        );

        status.textContent =
          "KEEP HOLDING — find where it belongs.";

        if (soundEnabled) {
          if (!leftClickSound) {
            leftClickSound =
              new Audio(
                "/sounds/mouseclick.mp3"
              );

            leftClickSound.volume =
              0.5;
          }

          leftClickSound.pause();
          leftClickSound.currentTime =
            0.12;

          leftClickSound
            .play()
            .catch(() => {});
        }
      });

    removeWeek4CleanUpRightListener =
      input.subscribe("rightDown", () => {
        if (finished) {
          return;
        }

        if (activeObject) {
          returnObject(
            activeObject
          );

          activeObject = null;
        }

        clearReady();

        showWrongButtonWarning();

        status.textContent =
          "Use the LEFT button.";
      });

    week4CleanUpNativeReleaseHandler =
      event => {
        if (event.button !== 0) {
          return;
        }

        finishDrop();
      };

    window.addEventListener(
      "mouseup",
      week4CleanUpNativeReleaseHandler,
      true
    );

    updateProgress();
  }

  function startWeek4SortBehavior() {
    const input = window.HandsOnMouseInput;

    const area =
      document.getElementById("week4SortArea");

    const pointer =
      document.getElementById("week4SortPointer");

    const status =
      document.getElementById("week4SortStatus");

    const progress =
      document.getElementById("week4SortProgress");

    if (
      !input ||
      !area ||
      !pointer ||
      !status ||
      !progress
    ) {
      return;
    }

    const objects =
      Array.from(
        area.querySelectorAll(
          ".week4-sort-object"
        )
      );

    const bins =
      Array.from(
        area.querySelectorAll(
          ".week4-sort-bin"
        )
      );

    let activeObject = null;
    let completedCount = 0;
    let finished = false;

    objects.forEach((object) => {
      object.dataset.startLeft =
        object.style.left;

      object.dataset.startTop =
        object.style.top;
    });

    function pointerOnObject(object) {
      return pointerTipHitsElement(
        pointer,
        object
      );
    }

    function matchingBin(object) {
      return bins.find(
        bin =>
          bin.dataset.category ===
          object.dataset.category
      );
    }

    function binUnderObject(object) {
      if (!object) {
        return null;
      }

      const objectRect =
        object.getBoundingClientRect();

      const centerX =
        objectRect.left +
        objectRect.width / 2;

      const centerY =
        objectRect.top +
        objectRect.height / 2;

      return bins.find((bin) => {
        const rect =
          bin.getBoundingClientRect();

        return (
          centerX >= rect.left &&
          centerX <= rect.right &&
          centerY >= rect.top &&
          centerY <= rect.bottom
        );
      }) || null;
    }

    function clearReady() {
      objects.forEach((object) => {
        object.classList.remove(
          "week4-sort-object-ready"
        );
      });

      bins.forEach((bin) => {
        bin.classList.remove(
          "week4-sort-bin-ready",
          "week4-sort-bin-wrong"
        );
      });
    }

    function returnObject(object) {
      if (!object) {
        return;
      }

      object.style.left =
        object.dataset.startLeft;

      object.style.top =
        object.dataset.startTop;

      object.classList.remove(
        "week4-sort-object-held",
        "week4-sort-object-ready"
      );
    }

    function updateProgress() {
      progress.textContent =
        `${completedCount} of ${objects.length}`;
    }

    function completeObject(
      object,
      bin
    ) {
      object.classList.remove(
        "week4-sort-object-held",
        "week4-sort-object-ready"
      );

      object.classList.add(
        "week4-sort-object-complete"
      );

      bin.classList.add(
        "week4-sort-bin-success"
      );

      completedCount += 1;
      updateProgress();

      status.textContent =
        "Great sort! ✓";

      if (soundEnabled) {
        const correctSound =
          new Audio("/sounds/correct.mp3");

        correctSound.volume = 0.6;
        correctSound.currentTime = 0;

        correctSound
          .play()
          .catch(() => {});
      }

      setTimeout(() => {
        bin.classList.remove(
          "week4-sort-bin-success"
        );

        if (
          completedCount >=
          objects.length
        ) {
          finished = true;

          progress.textContent =
            "6 of 6 ✓";

          status.textContent =
            "You sorted everything! Great job!";

          area.classList.add(
            "week4-sort-complete"
          );

          return;
        }

        status.textContent =
          "Choose another item.";
      }, 450);
    }

    function finishDrop() {
      if (
        !activeObject ||
        finished
      ) {
        return;
      }

      const object =
        activeObject;

      activeObject = null;

      const droppedBin =
        binUnderObject(object);

      const correctBin =
        matchingBin(object);

      clearReady();

      if (
        droppedBin &&
        droppedBin === correctBin
      ) {
        completeObject(
          object,
          correctBin
        );

        return;
      }

      if (droppedBin) {
        droppedBin.classList.add(
          "week4-sort-bin-wrong"
        );

        status.textContent =
          "That belongs in the other group.";

        setTimeout(() => {
          droppedBin.classList.remove(
            "week4-sort-bin-wrong"
          );
        }, 450);
      } else {
        status.textContent =
          "Let go inside one of the bins.";
      }

      returnObject(object);
    }

    removeWeek4SortMoveListener =
      input.subscribe("move", (event) => {
        if (finished) {
          return;
        }

        const rect =
          area.getBoundingClientRect();

        const inside =
          event.x >= rect.left &&
          event.x <= rect.right &&
          event.y >= rect.top &&
          event.y <= rect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.90;

        const offsetY =
          pointer.offsetHeight * 0.50;

        pointer.style.left =
          `${event.x - rect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - rect.top - offsetY}px`;

        if (!activeObject) {
          return;
        }

        activeObject.style.left =
          `${event.x - rect.left}px`;

        activeObject.style.top =
          `${event.y - rect.top}px`;

        clearReady();

        const bin =
          binUnderObject(activeObject);

        if (!bin) {
          status.textContent =
            "Keep holding and move to a group.";

          return;
        }

        activeObject.classList.add(
          "week4-sort-object-ready"
        );

        bin.classList.add(
          "week4-sort-bin-ready"
        );

        if (
          bin ===
          matchingBin(activeObject)
        ) {
          status.textContent =
            "That looks right — LET GO!";
        } else {
          status.textContent =
            "Hmm... is that the right group?";
        }
      });

    removeWeek4SortLeftDownListener =
      input.subscribe("leftDown", () => {
        if (
          finished ||
          activeObject
        ) {
          return;
        }

        const object =
          objects.find((item) => {
            return (
              !item.classList.contains(
                "week4-sort-object-complete"
              ) &&
              pointerOnObject(item)
            );
          });

        if (!object) {
          status.textContent =
            "Move onto an item first.";

          return;
        }

        activeObject =
          object;

        object.classList.add(
          "week4-sort-object-held"
        );

        status.textContent =
          "KEEP HOLDING — choose its group.";

        if (soundEnabled) {
          if (!leftClickSound) {
            leftClickSound =
              new Audio(
                "/sounds/mouseclick.mp3"
              );

            leftClickSound.volume =
              0.5;
          }

          leftClickSound.pause();
          leftClickSound.currentTime =
            0.12;

          leftClickSound
            .play()
            .catch(() => {});
        }
      });

    removeWeek4SortRightListener =
      input.subscribe("rightDown", () => {
        if (finished) {
          return;
        }

        if (activeObject) {
          returnObject(
            activeObject
          );

          activeObject =
            null;
        }

        clearReady();

        showWrongButtonWarning();

        status.textContent =
          "Use the LEFT button.";
      });

    week4SortNativeReleaseHandler =
      (event) => {
        if (event.button !== 0) {
          return;
        }

        finishDrop();
      };

    window.addEventListener(
      "mouseup",
      week4SortNativeReleaseHandler,
      true
    );

    updateProgress();
  }

  function startWeek4WarmUpBehavior() {
    const input = window.HandsOnMouseInput;

    const area =
      document.getElementById("week4BackpackArea");

    const backpack =
      document.getElementById("week4Backpack");

    const pointer =
      document.getElementById("week4BackpackPointer");

    const status =
      document.getElementById("week4BackpackStatus");

    const progress =
      document.getElementById("week4BackpackProgress");

    const packedItems =
      document.getElementById("week4BackpackPackedItems");

    if (
      !input ||
      !area ||
      !backpack ||
      !pointer ||
      !status ||
      !progress ||
      !packedItems
    ) {
      return;
    }

    const objects =
      Array.from(
        area.querySelectorAll(
          ".week4-backpack-object"
        )
      );

    let activeObject = null;
    let packedCount = 0;
    let finished = false;

    objects.forEach((object) => {
      object.dataset.startLeft =
        object.style.left;

      object.dataset.startTop =
        object.style.top;
    });

    function pointerOnObject(object) {
      return pointerTipHitsElement(
        pointer,
        object
      );
    }

    function objectInsideBackpack(object) {
      if (!object) {
        return false;
      }

      const objectRect =
        object.getBoundingClientRect();

      const backpackRect =
        backpack.getBoundingClientRect();

      const centerX =
        objectRect.left +
        objectRect.width / 2;

      const centerY =
        objectRect.top +
        objectRect.height / 2;

      return (
        centerX >= backpackRect.left &&
        centerX <= backpackRect.right &&
        centerY >= backpackRect.top &&
        centerY <= backpackRect.bottom
      );
    }

    function clearReady() {
      backpack.classList.remove(
        "week4-backpack-ready"
      );

      objects.forEach((object) => {
        object.classList.remove(
          "week4-backpack-object-ready"
        );
      });
    }

    function returnObject(object) {
      if (!object) {
        return;
      }

      object.style.left =
        object.dataset.startLeft;

      object.style.top =
        object.dataset.startTop;

      object.classList.remove(
        "week4-backpack-object-held",
        "week4-backpack-object-ready"
      );
    }

    function updateProgress() {
      progress.textContent =
        `${packedCount} of ${objects.length}`;

      backpack.dataset.packed =
        String(packedCount);

      if (packedCount === 0) {
        packedItems.textContent = "";
      } else if (packedCount === 1) {
        packedItems.textContent = "✓";
      } else if (packedCount === 2) {
        packedItems.textContent = "✓ ✓";
      } else {
        packedItems.textContent = "✓ ✓ ✓";
      }
    }

    function finishDrop() {
      if (!activeObject || finished) {
        return;
      }

      const object = activeObject;
      activeObject = null;

      clearReady();

      if (!objectInsideBackpack(object)) {
        returnObject(object);

        status.textContent =
          "Keep holding until the item is over the backpack.";

        return;
      }

      object.classList.remove(
        "week4-backpack-object-held"
      );

      object.classList.add(
        "week4-backpack-object-packed"
      );

      packedCount += 1;
      updateProgress();

      backpack.classList.add(
        "week4-backpack-success"
      );

      status.textContent =
        "Packed! ✓";

      if (soundEnabled) {
        const correctSound =
          new Audio("/sounds/correct.mp3");

        correctSound.volume = 0.6;
        correctSound.currentTime = 0;

        correctSound
          .play()
          .catch(() => {});
      }

      setTimeout(() => {
        backpack.classList.remove(
          "week4-backpack-success"
        );

        if (packedCount >= objects.length) {
          finished = true;

          progress.textContent =
            "3 of 3 ✓";

          status.textContent =
            "Backpack packed! Great job!";

          backpack.classList.add(
            "week4-backpack-complete"
          );

          return;
        }

        status.textContent =
          "Choose another school item.";
      }, 500);
    }

    removeWeek4WarmUpMoveListener =
      input.subscribe("move", (event) => {
        if (finished) {
          return;
        }

        const rect =
          area.getBoundingClientRect();

        const inside =
          event.x >= rect.left &&
          event.x <= rect.right &&
          event.y >= rect.top &&
          event.y <= rect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.90;

        const offsetY =
          pointer.offsetHeight * 0.50;

        pointer.style.left =
          `${event.x - rect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - rect.top - offsetY}px`;

        if (!activeObject) {
          return;
        }

        activeObject.style.left =
          `${event.x - rect.left}px`;

        activeObject.style.top =
          `${event.y - rect.top}px`;

        clearReady();

        if (objectInsideBackpack(activeObject)) {
          activeObject.classList.add(
            "week4-backpack-object-ready"
          );

          backpack.classList.add(
            "week4-backpack-ready"
          );

          status.textContent =
            "You're there — LET GO!";
        } else {
          status.textContent =
            "Keep holding and move to the backpack.";
        }
      });

    removeWeek4WarmUpLeftDownListener =
      input.subscribe("leftDown", () => {
        if (finished || activeObject) {
          return;
        }

        const object =
          objects.find((item) => {
            return (
              !item.classList.contains(
                "week4-backpack-object-packed"
              ) &&
              pointerOnObject(item)
            );
          });

        if (!object) {
          status.textContent =
            "Move onto a school item first.";

          return;
        }

        activeObject = object;

        object.classList.add(
          "week4-backpack-object-held"
        );

        status.textContent =
          "KEEP HOLDING — move it to the backpack.";

        if (soundEnabled) {
          if (!leftClickSound) {
            leftClickSound =
              new Audio("/sounds/mouseclick.mp3");

            leftClickSound.volume = 0.5;
          }

          leftClickSound.pause();
          leftClickSound.currentTime = 0.12;

          leftClickSound
            .play()
            .catch(() => {});
        }
      });

    removeWeek4WarmUpRightListener =
      input.subscribe("rightDown", () => {
        if (finished) {
          return;
        }

        if (activeObject) {
          returnObject(activeObject);
          activeObject = null;
        }

        clearReady();

        showWrongButtonWarning();

        status.textContent =
          "Use the LEFT button.";
      });

    week4WarmUpNativeReleaseHandler =
      (event) => {
        if (event.button !== 0) {
          return;
        }

        finishDrop();
      };

    window.addEventListener(
      "mouseup",
      week4WarmUpNativeReleaseHandler,
      true
    );

    updateProgress();
  }

  function startDragPracticeBehavior() {
    const input = window.HandsOnMouseInput;

    const area =
      document.getElementById("dragPracticeArea");

    const target =
      document.getElementById("dragPracticeTarget");

    const destination =
      document.getElementById("dragPracticeDestination");

    const destinationIcon =
      document.getElementById("dragPracticeDestinationIcon");

    const destinationLabel =
      document.getElementById("dragPracticeDestinationLabel");

    const pointer =
      document.getElementById("dragPracticePointer");

    const finger =
      document.getElementById("dragPracticeFinger");

    const leftButton =
      document.getElementById("dragPracticeLeftButton");

    const status =
      document.getElementById("dragPracticeStatus");

    const progress =
      document.getElementById("dragPracticeProgress");

    const handMessage =
      document.getElementById("dragPracticeHandMessage");

    if (
      !input ||
      !area ||
      !target ||
      !destination ||
      !destinationIcon ||
      !destinationLabel ||
      !pointer ||
      !finger ||
      !leftButton ||
      !status ||
      !progress ||
      !handMessage
    ) {
      return;
    }

    const rounds = [
      {
        object: "★",
        scene: "sky",
        destinationLabel: "SKY"
      },
      {
        object: "🍎",
        scene: "basket",
        destinationLabel: "BASKET"
      },
      {
        object: "🐟",
        scene: "fishbowl",
        destinationLabel: "FISHBOWL"
      }
    ];

    let roundIndex = 0;
    let dragging = false;
    let finished = false;

    function pointerOnTarget() {
      return pointerTipHitsElement(
        pointer,
        target
      );
    }

    function targetInsideDestination() {
      const targetRect =
        target.getBoundingClientRect();

      const destinationRect =
        destination.getBoundingClientRect();

      const centerX =
        targetRect.left +
        targetRect.width / 2;

      const centerY =
        targetRect.top +
        targetRect.height / 2;

      return (
        centerX >= destinationRect.left &&
        centerX <= destinationRect.right &&
        centerY >= destinationRect.top &&
        centerY <= destinationRect.bottom
      );
    }

    function pressHand() {
      finger.classList.add(
        "drag-practice-finger-down"
      );

      leftButton.classList.add(
        "drag-practice-button-down"
      );
    }

    function releaseHand() {
      finger.classList.remove(
        "drag-practice-finger-down"
      );

      leftButton.classList.remove(
        "drag-practice-button-down"
      );
    }

    function resetTargetPosition() {
      target.style.left = "18%";
      target.style.top = "50%";

      target.classList.remove(
        "drag-practice-target-held",
        "drag-practice-target-ready"
      );

      destination.classList.remove(
        "drag-practice-destination-ready"
      );
    }

    function loadRound() {
      const round = rounds[roundIndex];

      dragging = false;
      releaseHand();
      resetTargetPosition();

      target.textContent =
        round.object;

      destination.dataset.scene =
        round.scene;

      destinationIcon.innerHTML =
        round.scene === "sky"
          ? `
              <span class="drag-sky-sun">☀</span>
              <span class="drag-sky-cloud drag-cloud-one">☁</span>
              <span class="drag-sky-cloud drag-cloud-two">☁</span>
            `
          : round.scene === "basket"
            ? `
                <span class="drag-basket-handle"></span>
                <span class="drag-basket-body"></span>
              `
            : `
                <span class="drag-fishbowl-water"></span>
                <span class="drag-fishbowl-bubble bubble-one"></span>
                <span class="drag-fishbowl-bubble bubble-two"></span>
                <span class="drag-fishbowl-plant">♒</span>
              `;

      destinationLabel.textContent =
        round.destinationLabel;

      progress.textContent =
        `${roundIndex + 1} of ${rounds.length}`;

      status.textContent =
        "Move to the object.";

      handMessage.textContent =
        "Press, hold, move, then let go.";
    }

    function completeRound() {
      dragging = false;
      releaseHand();

      target.classList.remove(
        "drag-practice-target-held",
        "drag-practice-target-ready"
      );

      target.classList.add(
        "drag-practice-target-complete"
      );

      destination.classList.remove(
        "drag-practice-destination-ready"
      );

      destination.classList.add(
        "drag-practice-destination-complete"
      );

      status.textContent =
        "Great drag! ✓";

      if (soundEnabled) {
        const correctSound =
          new Audio("/sounds/correct.mp3");

        correctSound.volume = 0.6;
        correctSound.currentTime = 0;

        correctSound
          .play()
          .catch(() => {});
      }

      setTimeout(() => {
        target.classList.remove(
          "drag-practice-target-complete"
        );

        destination.classList.remove(
          "drag-practice-destination-complete"
        );

        roundIndex += 1;

        if (roundIndex >= rounds.length) {
          finished = true;

          progress.textContent =
            "3 of 3 ✓";

          status.textContent =
            "Drag Practice complete!";

          handMessage.textContent =
            "You used the whole drag skill!";

          return;
        }

        loadRound();
      }, 750);
    }

    function finishRelease() {
      if (!dragging || finished) {
        return;
      }

      /*
       * Success is checked ONLY on actual
       * physical left-button release.
       */
      if (targetInsideDestination()) {
        completeRound();
        return;
      }

      dragging = false;
      releaseHand();

      status.textContent =
        "Let go inside the destination.";

      handMessage.textContent =
        "Keep holding all the way there.";

      resetTargetPosition();
    }

    removeDragPracticeMoveListener =
      input.subscribe("move", (event) => {
        if (finished) {
          return;
        }

        const rect =
          area.getBoundingClientRect();

        const inside =
          event.x >= rect.left &&
          event.x <= rect.right &&
          event.y >= rect.top &&
          event.y <= rect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.90;

        const offsetY =
          pointer.offsetHeight * 0.50;

        pointer.style.left =
          `${event.x - rect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - rect.top - offsetY}px`;

        if (!dragging) {
          return;
        }

        target.style.left =
          `${event.x - rect.left}px`;

        target.style.top =
          `${event.y - rect.top}px`;

        if (targetInsideDestination()) {
          target.classList.add(
            "drag-practice-target-ready"
          );

          destination.classList.add(
            "drag-practice-destination-ready"
          );

          status.textContent =
            "You're there — LET GO!";

          handMessage.textContent =
            "Lift your pointer finger now.";
        } else {
          target.classList.remove(
            "drag-practice-target-ready"
          );

          destination.classList.remove(
            "drag-practice-destination-ready"
          );

          status.textContent =
            "Keep holding and move.";

          handMessage.textContent =
            "Keep your pointer finger DOWN.";
        }
      });

    removeDragPracticeRightListener =
      input.subscribe("rightDown", () => {
        if (finished) {
          return;
        }

        dragging = false;
        releaseHand();
        resetTargetPosition();

        showWrongButtonWarning();

        status.textContent =
          "Use the LEFT button.";
      });

    removeDragPracticeLeftDownListener =
      input.subscribe("leftDown", () => {
        if (finished) {
          return;
        }

        if (dragging) {
          dragging = false;
          releaseHand();
          resetTargetPosition();

          showClickWarning();

          status.textContent =
            "Click once and keep holding.";

          return;
        }

        if (!pointerOnTarget()) {
          status.textContent =
            "Move onto the object first.";

          return;
        }

        dragging = true;
        pressHand();

        target.classList.add(
          "drag-practice-target-held"
        );

        status.textContent =
          "KEEP HOLDING — move!";

        handMessage.textContent =
          "Keep your pointer finger DOWN.";

        if (soundEnabled) {
          if (!leftClickSound) {
            leftClickSound =
              new Audio("/sounds/mouseclick.mp3");

            leftClickSound.volume = 0.5;
          }

          leftClickSound.pause();
          leftClickSound.currentTime = 0.12;

          leftClickSound
            .play()
            .catch(() => {});
        }
      });

    /*
     * Native physical mouseup is the ONLY
     * drag-success trigger.
     */
    dragPracticeNativeReleaseHandler =
      (event) => {
        if (event.button !== 0) {
          return;
        }

        finishRelease();
      };

    window.addEventListener(
      "mouseup",
      dragPracticeNativeReleaseHandler,
      true
    );

    loadRound();
  }

  function startLetGoBehavior() {
    const input = window.HandsOnMouseInput;

    const area = document.getElementById("letGoArea");
    const target = document.getElementById("letGoTarget");
    const destination = document.getElementById("letGoDestination");
    const pointer = document.getElementById("letGoPointer");
    const finger = document.getElementById("letGoFinger");
    const leftButton = document.getElementById("letGoLeftButton");
    const status = document.getElementById("letGoStatus");
    const handMessage = document.getElementById("letGoHandMessage");

    if (
      !input ||
      !area ||
      !target ||
      !destination ||
      !pointer ||
      !finger ||
      !leftButton ||
      !status ||
      !handMessage
    ) {
      return;
    }

    let dragging = false;
    let completed = false;

    function pointerOnTarget() {
      return pointerTipHitsElement(
        pointer,
        target
      );
    }

    function targetInsideDestination() {
      const targetRect =
        target.getBoundingClientRect();

      const destinationRect =
        destination.getBoundingClientRect();

      const centerX =
        targetRect.left +
        targetRect.width / 2;

      const centerY =
        targetRect.top +
        targetRect.height / 2;

      return (
        centerX >= destinationRect.left &&
        centerX <= destinationRect.right &&
        centerY >= destinationRect.top &&
        centerY <= destinationRect.bottom
      );
    }

    function pressHand() {
      finger.classList.add(
        "let-go-finger-down"
      );

      leftButton.classList.add(
        "let-go-button-down"
      );
    }

    function releaseHand() {
      finger.classList.remove(
        "let-go-finger-down"
      );

      leftButton.classList.remove(
        "let-go-button-down"
      );
    }

    function resetStar() {
      target.style.left = "18%";
      target.style.top = "50%";

      target.classList.remove(
        "let-go-target-held",
        "let-go-target-ready"
      );

      destination.classList.remove(
        "let-go-destination-ready"
      );
    }

    function finishRelease() {
      if (!dragging || completed) {
        return;
      }

      dragging = false;
      releaseHand();

      target.classList.remove(
        "let-go-target-held"
      );

      if (targetInsideDestination()) {
        completed = true;

        target.classList.add(
          "let-go-complete"
        );

        destination.classList.add(
          "let-go-destination-complete"
        );

        status.textContent =
          "Perfect! You let go in the box! ✓";

        handMessage.textContent =
          "Great! Your pointer finger came UP.";

        /*
         * Success sound happens ONLY after the
         * physical left mouse button is released
         * inside the destination.
         */
        if (soundEnabled) {
          const correctSound =
            new Audio("/sounds/correct.mp3");

          correctSound.preload = "auto";
          correctSound.volume = 0.6;
          correctSound.currentTime = 0;

          correctSound
            .play()
            .catch(() => {});
        }

        return;
      }

      status.textContent =
        "Let go inside the green box.";

      handMessage.textContent =
        "Hold all the way to the box.";

      resetStar();
    }

    removeLetGoMoveListener =
      input.subscribe("move", (event) => {
        if (completed) {
          return;
        }

        const rect =
          area.getBoundingClientRect();

        const inside =
          event.x >= rect.left &&
          event.x <= rect.right &&
          event.y >= rect.top &&
          event.y <= rect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.90;

        const offsetY =
          pointer.offsetHeight * 0.50;

        pointer.style.left =
          `${event.x - rect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - rect.top - offsetY}px`;

        if (!dragging) {
          return;
        }

        target.style.left =
          `${event.x - rect.left}px`;

        target.style.top =
          `${event.y - rect.top}px`;

        if (targetInsideDestination()) {
          target.classList.add(
            "let-go-target-ready"
          );

          destination.classList.add(
            "let-go-destination-ready"
          );

          status.textContent =
            "You're there — LET GO!";

          handMessage.textContent =
            "Now lift your pointer finger!";
        } else {
          target.classList.remove(
            "let-go-target-ready"
          );

          destination.classList.remove(
            "let-go-destination-ready"
          );

          status.textContent =
            "Keep holding and move to the box.";

          handMessage.textContent =
            "Keep your pointer finger DOWN.";
        }
      });

    removeLetGoRightListener =
      input.subscribe("rightDown", () => {
        if (completed) {
          return;
        }

        dragging = false;
        releaseHand();
        resetStar();

        showWrongButtonWarning();

        status.textContent =
          "Use the LEFT button.";
      });

    removeLetGoLeftDownListener =
      input.subscribe("leftDown", () => {
        if (completed) {
          return;
        }

        if (!pointerOnTarget()) {
          status.textContent =
            "Move onto the star first.";
          return;
        }

        dragging = true;
        pressHand();

        target.classList.add(
          "let-go-target-held"
        );

        status.textContent =
          "KEEP HOLDING — move to the box.";

        handMessage.textContent =
          "Keep your pointer finger DOWN.";

        if (soundEnabled) {
          if (!leftClickSound) {
            leftClickSound =
              new Audio("/sounds/mouseclick.mp3");

            leftClickSound.volume = 0.5;
          }

          leftClickSound.pause();
          leftClickSound.currentTime = 0.12;
          leftClickSound.play().catch(() => {});
        }
      });

    letGoNativeReleaseHandler =
      (event) => {
        /*
         * Step 5 completes ONLY when the student
         * physically releases the real LEFT button.
         */
        if (event.button !== 0) {
          return;
        }

        if (!dragging || completed) {
          return;
        }

        finishRelease();
      };

    window.addEventListener(
      "mouseup",
      letGoNativeReleaseHandler,
      true
    );
  }

  function startHoldMoveBehavior() {
    const input = window.HandsOnMouseInput;

    const area =
      document.getElementById("holdMoveArea");

    const target =
      document.getElementById("holdMoveTarget");

    const destination =
      document.getElementById("holdMoveDestination");

    const pointer =
      document.getElementById("holdMovePointer");

    const hand =
      document.getElementById("holdMoveHand");

    const finger =
      document.getElementById("holdMoveFinger");

    const leftButton =
      document.getElementById("holdMoveLeftButton");

    const status =
      document.getElementById("holdMoveStatus");

    if (
      !input ||
      !area ||
      !target ||
      !destination ||
      !pointer ||
      !hand ||
      !finger ||
      !leftButton ||
      !status
    ) {
      return;
    }

    let dragging = false;
    let completed = false;

    function pointerOnTarget() {
      return pointerTipHitsElement(
        pointer,
        target
      );
    }

    function targetReachedDestination() {
      const targetRect =
        target.getBoundingClientRect();

      const destinationRect =
        destination.getBoundingClientRect();

      const centerX =
        targetRect.left +
        targetRect.width / 2;

      const centerY =
        targetRect.top +
        targetRect.height / 2;

      return (
        centerX >= destinationRect.left &&
        centerX <= destinationRect.right &&
        centerY >= destinationRect.top &&
        centerY <= destinationRect.bottom
      );
    }

    function showHeldHand() {
      finger.classList.add(
        "hold-move-finger-down"
      );

      leftButton.classList.add(
        "hold-move-button-down"
      );

      hand.classList.add(
        "hold-move-hand-down"
      );
    }

    function releaseHeldHand() {
      finger.classList.remove(
        "hold-move-finger-down"
      );

      leftButton.classList.remove(
        "hold-move-button-down"
      );

      hand.classList.remove(
        "hold-move-hand-down"
      );
    }

    removeHoldMoveMoveListener =
      input.subscribe("move", (event) => {
        if (completed) {
          return;
        }

        const rect =
          area.getBoundingClientRect();

        const inside =
          event.x >= rect.left &&
          event.x <= rect.right &&
          event.y >= rect.top &&
          event.y <= rect.bottom;

        if (!inside) {
          return;
        }

        /*
         * Position the visual pointer so its TIP
         * corresponds to the real mouse position.
         */
        const offsetX =
          pointer.offsetWidth * 0.90;

        const offsetY =
          pointer.offsetHeight * 0.50;

        const pointerLeft =
          event.x - rect.left - offsetX;

        const pointerTop =
          event.y - rect.top - offsetY;

        pointer.style.left =
          `${pointerLeft}px`;

        pointer.style.top =
          `${pointerTop}px`;

        /*
         * While the real left button remains held,
         * the star follows the cursor tip.
         */
        if (dragging) {
          target.style.left =
            `${event.x - rect.left}px`;

          target.style.top =
            `${event.y - rect.top}px`;

          status.textContent =
            "KEEP HOLDING and MOVE!";

          if (targetReachedDestination()) {
            completed = true;

            target.classList.add(
              "hold-move-complete"
            );

            destination.classList.add(
              "hold-move-destination-complete"
            );

            status.textContent =
              "Great! You moved it while holding! ✓";

            if (soundEnabled) {
              const correctSound =
                new Audio(
                  "/sounds/correct.mp3"
                );

              correctSound.preload = "auto";
              correctSound.volume = 0.6;
              correctSound.play().catch(() => {});
            }
          }
        }
      });


    removeHoldMoveRightListener =
      input.subscribe("rightDown", () => {
        if (completed) {
          return;
        }

        dragging = false;
        releaseHeldHand();

        showWrongButtonWarning();

        status.textContent =
          "Use the LEFT button.";
      });


    removeHoldMoveLeftDownListener =
      input.subscribe("leftDown", () => {
        if (completed) {
          return;
        }

        if (!pointerOnTarget()) {
          status.textContent =
            "Move onto the star first.";

          return;
        }

        dragging = true;

        showHeldHand();

        target.classList.add(
          "hold-move-target-held"
        );

        status.textContent =
          "KEEP HOLDING — now MOVE!";

        /*
         * Physical click sound immediately when
         * the finger presses the button.
         */
        if (soundEnabled) {
          if (!leftClickSound) {
            leftClickSound =
              new Audio(
                "/sounds/mouseclick.mp3"
              );

            leftClickSound.volume = 0.5;
          }

          leftClickSound.pause();

          /*
           * Skip the tiny silence at the start of
           * the MP3, matching Step 3.
           */
          leftClickSound.currentTime = 0.12;

          leftClickSound
            .play()
            .catch(() => {});
        }
      });


    removeHoldMoveLeftUpListener =
      input.subscribe("leftUp", () => {
        if (!dragging) {
          return;
        }

        dragging = false;

        releaseHeldHand();

        target.classList.remove(
          "hold-move-target-held"
        );

        if (completed) {
          status.textContent =
            "Great! You moved it while holding! ✓";

          return;
        }

        /*
         * Step 4 teaches HOLD + MOVE.
         * Releasing before reaching the destination
         * means they need to try again.
         */
        status.textContent =
          "Oops! Keep holding while you move.";

        target.style.left = "18%";
        target.style.top = "50%";
      });
  }

  function startPressHoldBehavior() {
    const input = window.HandsOnMouseInput;

    const area =
      document.getElementById("pressHoldArea");

    const target =
      document.getElementById("pressHoldTarget");

    const pointer =
      document.getElementById("pressHoldPointer");

    const hand =
      document.getElementById("pressHoldHand");

    const finger =
      document.getElementById("pressHoldFinger");

    const leftButton =
      document.getElementById("pressHoldLeftButton");

    const status =
      document.getElementById("pressHoldStatus");

    const handMessage =
      document.getElementById("pressHoldHandMessage");

    const meterFill =
      document.getElementById("pressHoldMeterFill");

    if (
      !input ||
      !area ||
      !target ||
      !pointer ||
      !hand ||
      !finger ||
      !leftButton ||
      !status ||
      !handMessage ||
      !meterFill
    ) {
      return;
    }

    let holding = false;
    let completed = false;

    const HOLD_TIME = 1100;

    function pointerOnTarget() {
      return pointerTipHitsElement(
        pointer,
        target
      );
    }

    function clearHoldVisuals() {
      holding = false;

      hand.classList.remove(
        "press-hold-hand-down"
      );

      finger.classList.remove(
        "press-hold-finger-down"
      );

      leftButton.classList.remove(
        "press-hold-button-down"
      );

      target.classList.remove(
        "press-hold-target-held"
      );

      meterFill.classList.remove(
        "press-hold-meter-running"
      );

      meterFill.style.width = "0%";
    }

    function cancelPendingSuccess() {
      if (pressHoldSuccessTimer) {
        clearTimeout(
          pressHoldSuccessTimer
        );

        pressHoldSuccessTimer = null;
      }
    }

    function handlePressHoldRelease() {
      if (completed) {
        clearHoldVisuals();

        target.classList.add(
          "press-hold-target-complete"
        );

        return;
      }

      if (!holding) {
        return;
      }

      /*
       * The student physically let go before
       * the full hold time finished.
       * Cancel success immediately.
       */
      cancelPendingSuccess();
      clearHoldVisuals();

      status.textContent =
        "Keep holding a little longer.";

      handMessage.textContent =
        "Don't let go yet!";
    }

    /*
     * Listen directly for the real mouse release too.
     * This prevents a quick click from accidentally
     * continuing the hold timer.
     */
    pressHoldNativeReleaseHandler =
      (event) => {
        if (
          event.type === "mouseup" &&
          event.button !== 0
        ) {
          return;
        }

        handlePressHoldRelease();
      };

    window.addEventListener(
      "mouseup",
      pressHoldNativeReleaseHandler,
      true
    );

    removePressHoldMoveListener =
      input.subscribe("move", (event) => {
        if (completed) {
          return;
        }

        const rect =
          area.getBoundingClientRect();

        const inside =
          event.x >= rect.left &&
          event.x <= rect.right &&
          event.y >= rect.top &&
          event.y <= rect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.90;

        const offsetY =
          pointer.offsetHeight * 0.50;

        pointer.style.left =
          `${event.x - rect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - rect.top - offsetY}px`;

        // No movement sound here.
      });

    removePressHoldRightListener =
      input.subscribe("rightDown", () => {
        if (completed) {
          return;
        }

        cancelPendingSuccess();
        clearHoldVisuals();

        showWrongButtonWarning();

        status.textContent =
          "Use the LEFT button.";
      });

    removePressHoldLeftDownListener =
      input.subscribe("leftDown", () => {
        if (completed) {
          return;
        }

        if (!pointerOnTarget()) {
          status.textContent =
            "Move the pointer onto the star first.";

          return;
        }

        cancelPendingSuccess();

        holding = true;

        hand.classList.add(
          "press-hold-hand-down"
        );

        finger.classList.add(
          "press-hold-finger-down"
        );

        leftButton.classList.add(
          "press-hold-button-down"
        );

        /*
         * Physical click sound happens immediately
         * when the student presses the button.
         * Holding long enough is still required
         * before success is awarded.
         */
        if (soundEnabled) {
          if (!leftClickSound) {
            leftClickSound =
              new Audio("/sounds/mouseclick.mp3");

            leftClickSound.volume = 0.5;
          }

          leftClickSound.pause();
          leftClickSound.currentTime = 0.12;
          leftClickSound.play().catch(() => {});
        }

        target.classList.add(
          "press-hold-target-held"
        );

        meterFill.style.width = "0%";

        void meterFill.offsetWidth;

        meterFill.classList.add(
          "press-hold-meter-running"
        );

        status.textContent =
          "KEEP HOLDING!";

        handMessage.textContent =
          "Keep your pointer finger DOWN.";

        pressHoldSuccessTimer =
          setTimeout(() => {
            pressHoldSuccessTimer = null;

            if (!holding) {
              return;
            }

            completed = true;

            meterFill.classList.remove(
              "press-hold-meter-running"
            );

            meterFill.style.width = "100%";

            target.classList.add(
              "press-hold-target-complete"
            );

            status.textContent =
              "Great holding! ✓";

            handMessage.textContent =
              "Perfect! You kept the button down.";

            if (soundEnabled) {
              const happySound =
                new Audio("/sounds/correct.mp3");

              happySound.preload = "auto";
              happySound.volume = 0.6;
              happySound.currentTime = 0;
              happySound.play().catch(() => {});
            }

          }, HOLD_TIME);
      });

    removePressHoldLeftUpListener =
      input.subscribe("leftUp", () => {
        handlePressHoldRelease();
      });
  }



  let week5ReviewTimers = [];
  let week5ReviewActiveSounds = [];

  function stopWeek5QuickReviewAnimation() {
    week5ReviewTimers.forEach(
      timer => clearTimeout(timer)
    );

    week5ReviewTimers = [];

    week5ReviewActiveSounds.forEach(
      sound => {
        sound.pause();
        sound.currentTime = 0;
      }
    );

    week5ReviewActiveSounds = [];

    if (
      typeof window.week5StopReviewSounds ===
      "function"
    ) {
      window.week5StopReviewSounds();
      window.week5StopReviewSounds = null;
    }
  }

  let week5MeetWheelTimers = [];
  let week5MeetWheelSound = null;

  function stopWeek5MeetWheelAnimation() {
    week5MeetWheelTimers.forEach(
      timer => clearTimeout(timer)
    );

    week5MeetWheelTimers = [];

    if (week5MeetWheelSound) {
      week5MeetWheelSound.pause();
      week5MeetWheelSound.currentTime = 0;
      week5MeetWheelSound = null;
    }
  }

  let removeWeek5ScrollDownWheelListener = null;
  let week5ScrollDownSound = null;
  let week5ScrollDownSoundTimer = null;
  let week5ScrollDownActiveSounds = [];

  function stopAllWeek5ScrollDownSounds() {
    week5ScrollDownActiveSounds.forEach(
      sound => {
        sound.pause();
        sound.currentTime = 0;
      }
    );

    week5ScrollDownActiveSounds = [];

    if (week5ScrollDownSound) {
      week5ScrollDownSound.pause();
      week5ScrollDownSound.currentTime = 0;
      week5ScrollDownSound = null;
    }
  }

  function stopWeek5ScrollDownBehavior() {
    removeWeek5ScrollDownWheelListener?.();
    removeWeek5ScrollDownWheelListener = null;

    if (week5ScrollDownSoundTimer) {
      clearTimeout(
        week5ScrollDownSoundTimer
      );

      week5ScrollDownSoundTimer = null;
    }

    stopAllWeek5ScrollDownSounds();
  }

  let removeWeek5ScrollUpWheelListener = null;
  let week5ScrollUpSound = null;
  let week5ScrollUpSoundTimer = null;
  let week5ScrollUpActiveSounds = [];

  function stopAllWeek5ScrollUpSounds() {
    week5ScrollUpActiveSounds.forEach(
      sound => {
        sound.pause();
        sound.currentTime = 0;
        sound.loop = false;
      }
    );

    week5ScrollUpActiveSounds = [];

    if (week5ScrollUpSound) {
      week5ScrollUpSound.pause();
      week5ScrollUpSound.currentTime = 0;
      week5ScrollUpSound.loop = false;
      week5ScrollUpSound = null;
    }
  }

  function stopWeek5ScrollUpBehavior() {
    removeWeek5ScrollUpWheelListener?.();
    removeWeek5ScrollUpWheelListener = null;

    if (week5ScrollUpSoundTimer) {
      clearTimeout(
        week5ScrollUpSoundTimer
      );

      week5ScrollUpSoundTimer = null;
    }

    stopAllWeek5ScrollUpSounds();
  }

  let removeWeek5ScrollPracticeWheelListener = null;
  let week5ScrollPracticeSound = null;
  let week5ScrollPracticeSoundTimer = null;
  let week5ScrollPracticeRoundTimer = null;
  let week5ScrollPracticeTargetStopTimer = null;

  function stopWeek5ScrollPracticeBehavior() {
    removeWeek5ScrollPracticeWheelListener?.();
    removeWeek5ScrollPracticeWheelListener = null;

    if (week5ScrollPracticeSoundTimer) {
      clearTimeout(
        week5ScrollPracticeSoundTimer
      );

      week5ScrollPracticeSoundTimer = null;
    }

    if (week5ScrollPracticeRoundTimer) {
      clearTimeout(
        week5ScrollPracticeRoundTimer
      );

      week5ScrollPracticeRoundTimer = null;
    }

    if (week5ScrollPracticeTargetStopTimer) {
      clearTimeout(
        week5ScrollPracticeTargetStopTimer
      );

      week5ScrollPracticeTargetStopTimer = null;
    }

    if (week5ScrollPracticeSound) {
      week5ScrollPracticeSound.pause();
      week5ScrollPracticeSound.currentTime = 0;
      week5ScrollPracticeSound.loop = false;
      week5ScrollPracticeSound = null;
    }
  }

  let removeWeek5StopTargetWheelListener = null;
  let week5StopTargetSound = null;
  let week5StopTargetSoundTimer = null;
  let week5StopTargetCheckTimer = null;
  let week5StopTargetRoundTimer = null;

  function stopWeek5StopTargetBehavior() {
    removeWeek5StopTargetWheelListener?.();
    removeWeek5StopTargetWheelListener = null;

    [
      "week5StopTargetSoundTimer",
      "week5StopTargetCheckTimer",
      "week5StopTargetRoundTimer"
    ].forEach(() => {});

    if (week5StopTargetSoundTimer) {
      clearTimeout(
        week5StopTargetSoundTimer
      );
      week5StopTargetSoundTimer = null;
    }

    if (week5StopTargetCheckTimer) {
      clearTimeout(
        week5StopTargetCheckTimer
      );
      week5StopTargetCheckTimer = null;
    }

    if (week5StopTargetRoundTimer) {
      clearTimeout(
        week5StopTargetRoundTimer
      );
      week5StopTargetRoundTimer = null;
    }

    if (week5StopTargetSound) {
      week5StopTargetSound.pause();
      week5StopTargetSound.currentTime = 0;
      week5StopTargetSound.loop = false;
      week5StopTargetSound = null;
    }
  }

  let removeWeek5ScrollClickWheelListener = null;
  let removeWeek5ScrollClickClickListener = null;
  let week5ScrollClickSound = null;
  let week5ScrollClickSoundTimer = null;
  let week5ScrollClickRoundTimer = null;
  let week5ScrollClickActiveSounds = [];

  function stopWeek5ScrollClickBehavior() {
    removeWeek5ScrollClickWheelListener?.();
    removeWeek5ScrollClickWheelListener = null;

    removeWeek5ScrollClickClickListener?.();
    removeWeek5ScrollClickClickListener = null;

    if (week5ScrollClickSoundTimer) {
      clearTimeout(
        week5ScrollClickSoundTimer
      );

      week5ScrollClickSoundTimer = null;
    }

    if (week5ScrollClickRoundTimer) {
      clearTimeout(
        week5ScrollClickRoundTimer
      );

      week5ScrollClickRoundTimer = null;
    }

    week5ScrollClickActiveSounds.forEach(
      sound => {
        sound.pause();
        sound.currentTime = 0;
        sound.loop = false;
      }
    );

    week5ScrollClickActiveSounds = [];

    if (week5ScrollClickSound) {
      week5ScrollClickSound.pause();
      week5ScrollClickSound.currentTime = 0;
      week5ScrollClickSound.loop = false;
      week5ScrollClickSound = null;
    }
  }

  let removeWeek5ScrollDragWheelListener = null;
  let removeWeek5ScrollDragDownListener = null;
  let removeWeek5ScrollDragMoveListener = null;
  let removeWeek5ScrollDragUpListener = null;

  let week5ScrollDragSound = null;
  let week5ScrollDragSoundTimer = null;
  let week5ScrollDragRoundTimer = null;
  let week5ScrollDragActiveSounds = [];

  function stopWeek5ScrollDragBehavior() {
    removeWeek5ScrollDragWheelListener?.();
    removeWeek5ScrollDragWheelListener = null;

    removeWeek5ScrollDragDownListener?.();
    removeWeek5ScrollDragDownListener = null;

    removeWeek5ScrollDragMoveListener?.();
    removeWeek5ScrollDragMoveListener = null;

    removeWeek5ScrollDragUpListener?.();
    removeWeek5ScrollDragUpListener = null;

    if (week5ScrollDragSoundTimer) {
      clearTimeout(
        week5ScrollDragSoundTimer
      );

      week5ScrollDragSoundTimer = null;
    }

    if (week5ScrollDragRoundTimer) {
      clearTimeout(
        week5ScrollDragRoundTimer
      );

      week5ScrollDragRoundTimer = null;
    }

    week5ScrollDragActiveSounds.forEach(
      sound => {
        sound.pause();
        sound.currentTime = 0;
        sound.loop = false;
      }
    );

    week5ScrollDragActiveSounds = [];

    if (week5ScrollDragSound) {
      week5ScrollDragSound.pause();
      week5ScrollDragSound.currentTime = 0;
      week5ScrollDragSound.loop = false;
      week5ScrollDragSound = null;
    }
  }

  let week5CompleteSound = null;
  let week5CompleteTimer = null;

  function stopWeek5CompleteBehavior() {
    if (week5CompleteTimer) {
      clearTimeout(
        week5CompleteTimer
      );

      week5CompleteTimer = null;
    }

    if (week5CompleteSound) {
      week5CompleteSound.pause();
      week5CompleteSound.currentTime = 0;
      week5CompleteSound = null;
    }
  }

  function startWeek5CompleteBehavior() {
    stopWeek5CompleteBehavior();

    const screen =
      document.querySelector(
        ".lesson-screen-week5-complete"
      );

    if (!screen) {
      return;
    }

    /*
     * Tiny delay lets the completion screen
     * appear before the celebration fires.
     */
    week5CompleteTimer =
      setTimeout(() => {
        if (!screen.isConnected) {
          return;
        }

        screen.classList.add(
          "week5-complete-show"
        );

        if (soundEnabled) {
          week5CompleteSound =
            new Audio(
              "/sounds/complete.mp3"
            );

          week5CompleteSound.volume =
            0.6;

          week5CompleteSound.currentTime =
            0;

          week5CompleteSound
            .play()
            .catch(() => {});
        }
      }, 180);
  }

  function startWeek5ScrollDragBehavior() {
    stopWeek5ScrollDragBehavior();

    const viewport =
      document.getElementById(
        "week5ScrollDragViewport"
      );

    const scene =
      document.getElementById(
        "week5ScrollDragScene"
      );

    const destination =
      document.getElementById(
        "week5ScrollDragDestination"
      );

    const targetDisplay =
      document.getElementById(
        "week5ScrollDragTarget"
      );

    const status =
      document.getElementById(
        "week5ScrollDragStatus"
      );

    const progress =
      document.getElementById(
        "week5ScrollDragProgress"
      );

    if (
      !viewport ||
      !scene ||
      !destination ||
      !targetDisplay ||
      !status ||
      !progress
    ) {
      return;
    }

    const objects =
      Array.from(
        scene.querySelectorAll(
          "[data-scroll-drag-object]"
        )
      );

    const rounds = [
      {
        id: "present",
        emoji: "🎁",
        name: "PRESENT",
        destination: "🎂"
      },
      {
        id: "book",
        emoji: "📘",
        name: "BOOK",
        destination: "📚"
      },
      {
        id: "ball",
        emoji: "⚽",
        name: "BALL",
        destination: "🥅"
      },
      {
        id: "flower",
        emoji: "🌼",
        name: "FLOWER",
        destination: "🏺"
      }
    ];

    const MAX_SCROLL = 900;
    /*
     * Guarantee that every object used by the hunt
     * actually exists in the scrolling scene.
     */
    const requiredTargets = [
      {
        id: "key",
        emoji: "🔑",
        top: 160,
        left: 24
      },
      {
        id: "map",
        emoji: "🗺️",
        top: 500,
        left: 34
      },
      {
        id: "chest",
        emoji: "🧰",
        top: 860,
        left: 25
      },
      {
        id: "gem",
        emoji: "💎",
        top: 1220,
        left: 32
      },
      {
        id: "crown",
        emoji: "👑",
        top: 1540,
        left: 28
      }
    ];

    requiredTargets.forEach(
      targetInfo => {
        let item =
          scene.querySelector(
            `[data-week6-treasure="${targetInfo.id}"]`
          );

        if (!item) {
          item =
            document.createElement(
              "button"
            );

          item.type =
            "button";

          item.className =
            "week6-treasure-item";

          item.dataset.week6Treasure =
            targetInfo.id;

          item.textContent =
            targetInfo.emoji;

          scene.appendChild(
            item
          );
        }

        /*
         * Also force every required target to a
         * known reachable location.
         */
        item.style.top =
          `${targetInfo.top}px`;

        item.style.left =
          `${targetInfo.left}%`;
      }
    );


    let scrollPosition = 350;
    let roundIndex = 0;
    let locked = false;
    let finished = false;

    let activeObject = null;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    let dragOriginalParent = null;
    let dragOriginalNextSibling = null;

    function stopScrollSound() {
      if (week5ScrollDragSoundTimer) {
        clearTimeout(
          week5ScrollDragSoundTimer
        );

        week5ScrollDragSoundTimer = null;
      }

      if (week5ScrollDragSound) {
        week5ScrollDragSound.pause();
        week5ScrollDragSound.currentTime = 0;
        week5ScrollDragSound.loop = false;
        week5ScrollDragSound = null;
      }
    }

    function playSound(
      src,
      volume = 0.5
    ) {
      if (!soundEnabled) {
        return;
      }

      const sound =
        new Audio(src);

      sound.volume = volume;
      sound.currentTime = 0;

      week5ScrollDragActiveSounds.push(
        sound
      );

      sound
        .play()
        .catch(() => {});

      sound.addEventListener(
        "ended",
        () => {
          week5ScrollDragActiveSounds =
            week5ScrollDragActiveSounds.filter(
              item => item !== sound
            );
        },
        { once: true }
      );
    }

    function playScrollSound() {
      if (!soundEnabled) {
        return;
      }

      if (!week5ScrollDragSound) {
        week5ScrollDragSound =
          new Audio(
            "/sounds/scroll.mp3"
          );

        week5ScrollDragSound.volume = 0.42;
        week5ScrollDragSound.loop = true;

        week5ScrollDragActiveSounds.push(
          week5ScrollDragSound
        );

        week5ScrollDragSound
          .play()
          .catch(() => {});
      }

      if (week5ScrollDragSoundTimer) {
        clearTimeout(
          week5ScrollDragSoundTimer
        );
      }

      week5ScrollDragSoundTimer =
        setTimeout(
          stopScrollSound,
          180
        );
    }

    function updateScene() {
      scene.style.transform =
        `translateY(-${scrollPosition}px)`;
    }

    function clearObjectStates() {
      objects.forEach((object) => {
        object.classList.remove(
          "week5-scroll-drag-held",
          "week5-scroll-drag-correct",
          "week5-scroll-drag-wrong"
        );
      });
    }

    function loadRound() {
      if (finished) {
        return;
      }

      locked = false;
      dragging = false;
      activeObject = null;

      clearObjectStates();

      const round =
        rounds[roundIndex];

      targetDisplay.innerHTML = `
        <span>${round.emoji}</span>
        <strong>${round.name}</strong>
      `;

      destination.innerHTML = `
        <span class="week5-scroll-drag-destination-item">
          ${round.emoji}
        </span>

        <strong>
          PUT ${round.name} HERE
        </strong>
      `;

      progress.textContent =
        `${roundIndex + 1} of ${rounds.length}`;

      status.textContent =
        `Find the ${round.name}, then drag it to the box.`;
    }

    function finishActivity() {
      finished = true;
      locked = true;
      dragging = false;

      stopScrollSound();

      status.textContent =
        "Great job!";

      const celebration =
        document.createElement("div");

      celebration.className =
        "week5-scroll-drag-celebration";

      celebration.innerHTML = `
        <div class="week5-scroll-drag-celebration-card">
          <div>⭐</div>
          <strong>GREAT JOB!</strong>
          <span>You scrolled, found, and dragged!</span>
        </div>
      `;

      viewport.appendChild(
        celebration
      );

      requestAnimationFrame(() => {
        celebration.classList.add(
          "week5-scroll-drag-celebration-show"
        );
      });

      playSound(
        "/sounds/correct.mp3",
        0.6
      );
    }

    function completeRound(object) {
      if (
        locked ||
        finished
      ) {
        return;
      }

      locked = true;
      dragging = false;

      object.classList.remove(
        "week5-scroll-drag-held"
      );

      object.classList.add(
        "week5-scroll-drag-correct"
      );

      destination.classList.add(
        "week5-scroll-drag-destination-correct"
      );

      status.textContent =
        "Great drop!";

      playSound(
        "/sounds/correct.mp3",
        0.55
      );

      week5ScrollDragRoundTimer =
        setTimeout(() => {
          if (!viewport.isConnected) {
            return;
          }

          destination.classList.remove(
            "week5-scroll-drag-destination-correct"
          );

          roundIndex += 1;

          if (
            roundIndex >=
            rounds.length
          ) {
            finishActivity();
            return;
          }

          loadRound();
        }, 900);
    }

    function pointInsideDestination(
      x,
      y
    ) {
      const rect =
        destination.getBoundingClientRect();

      return (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      );
    }

    const wheelHandler =
      event => {
        if (
          locked ||
          finished ||
          dragging
        ) {
          event.preventDefault();
          return;
        }

        const rect =
          viewport.getBoundingClientRect();

        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          return;
        }

        event.preventDefault();

        playScrollSound();

        const amount =
          Math.min(
            Math.max(
              Math.abs(event.deltaY),
              22
            ),
            65
          );

        if (event.deltaY > 0) {
          scrollPosition =
            Math.min(
              scrollPosition + amount,
              MAX_SCROLL
            );
        } else {
          scrollPosition =
            Math.max(
              scrollPosition - amount,
              0
            );
        }

        status.textContent =
          "Scroll until you find it.";

        updateScene();
      };

    const downHandler =
      event => {
        if (
          locked ||
          finished ||
          event.button !== 0
        ) {
          return;
        }

        const object =
          event.target.closest(
            "[data-scroll-drag-object]"
          );

        if (!object) {
          return;
        }

        const round =
          rounds[roundIndex];

        if (
          object.dataset.scrollDragObject !==
          round.id
        ) {
          object.classList.add(
            "week5-scroll-drag-wrong"
          );

          status.textContent =
            `Find the ${round.name}.`;

          setTimeout(() => {
            if (object.isConnected) {
              object.classList.remove(
                "week5-scroll-drag-wrong"
              );
            }
          }, 300);

          return;
        }

        event.preventDefault();

        activeObject = object;
        dragging = true;

        const rect =
          object.getBoundingClientRect();

        offsetX =
          event.clientX - rect.left;

        offsetY =
          event.clientY - rect.top;

        /*
         * IMPORTANT:
         * The scrolling scene uses transform: translateY().
         * Fixed-position children of transformed elements
         * use that transformed element as their coordinate
         * system, which causes the jump.
         *
         * Temporarily move the actual object to document.body
         * so fixed positioning uses true screen coordinates.
         */
        dragOriginalParent =
          object.parentNode;

        dragOriginalNextSibling =
          object.nextSibling;

        object.style.width =
          `${rect.width}px`;

        object.style.height =
          `${rect.height}px`;

        object.style.position =
          "fixed";

        object.style.left =
          `${rect.left}px`;

        object.style.top =
          `${rect.top}px`;

        object.style.margin =
          "0";

        object.style.transform =
          "none";

        object.style.zIndex =
          "9999";

        object.classList.add(
          "week5-scroll-drag-held",
          "week5-scroll-drag-floating"
        );

        document.body.appendChild(
          object
        );

        playSound(
          "/sounds/mouseclick.mp3",
          0.45
        );

        status.textContent =
          "Keep holding and drag it!";
      };

    const moveHandler =
      event => {
        if (
          !dragging ||
          !activeObject
        ) {
          return;
        }

        event.preventDefault();

        activeObject.style.left =
          `${event.clientX - offsetX}px`;

        activeObject.style.top =
          `${event.clientY - offsetY}px`;
      };

    const upHandler =
      event => {
        if (
          !dragging ||
          !activeObject ||
          event.button !== 0
        ) {
          return;
        }

        const object =
          activeObject;

        dragging = false;
        activeObject = null;

        object.classList.remove(
          "week5-scroll-drag-held"
        );

        if (
          pointInsideDestination(
            event.clientX,
            event.clientY
          )
        ) {
          object.classList.remove(
            "week5-scroll-drag-floating"
          );

          /*
           * This target is finished for good,
           * so remove the floating copy entirely.
           */
          object.remove();

          dragOriginalParent = null;
          dragOriginalNextSibling = null;

          completeRound(object);
          return;
        }

        object.classList.add(
          "week5-scroll-drag-wrong"
        );

        object.classList.remove(
          "week5-scroll-drag-floating"
        );

        /*
         * Put the object back into its original place
         * in the scrolling scene.
         */
        if (dragOriginalParent) {
          if (
            dragOriginalNextSibling &&
            dragOriginalNextSibling.parentNode ===
              dragOriginalParent
          ) {
            dragOriginalParent.insertBefore(
              object,
              dragOriginalNextSibling
            );
          } else {
            dragOriginalParent.appendChild(
              object
            );
          }
        }

        object.style.position = "";
        object.style.left = "";
        object.style.top = "";
        object.style.width = "";
        object.style.height = "";
        object.style.margin = "";
        object.style.transform = "";
        object.style.zIndex = "";

        dragOriginalParent = null;
        dragOriginalNextSibling = null;

        status.textContent =
          "Try the drop again.";

        setTimeout(() => {
          if (object.isConnected) {
            object.classList.remove(
              "week5-scroll-drag-wrong"
            );
          }
        }, 350);
      };

    viewport.addEventListener(
      "wheel",
      wheelHandler,
      {
        passive: false
      }
    );

    viewport.addEventListener(
      "mousedown",
      downHandler
    );

    window.addEventListener(
      "mousemove",
      moveHandler,
      true
    );

    window.addEventListener(
      "mouseup",
      upHandler,
      true
    );

    removeWeek5ScrollDragWheelListener =
      () => {
        viewport.removeEventListener(
          "wheel",
          wheelHandler
        );
      };

    removeWeek5ScrollDragDownListener =
      () => {
        viewport.removeEventListener(
          "mousedown",
          downHandler
        );
      };

    removeWeek5ScrollDragMoveListener =
      () => {
        window.removeEventListener(
          "mousemove",
          moveHandler,
          true
        );
      };

    removeWeek5ScrollDragUpListener =
      () => {
        window.removeEventListener(
          "mouseup",
          upHandler,
          true
        );
      };

    updateScene();
    loadRound();
  }

  function startWeek5ScrollClickBehavior() {
    stopWeek5ScrollClickBehavior();

    const viewport =
      document.getElementById(
        "week5ScrollClickViewport"
      );

    const scene =
      document.getElementById(
        "week5ScrollClickScene"
      );

    const targetDisplay =
      document.getElementById(
        "week5ScrollClickTarget"
      );

    const progress =
      document.getElementById(
        "week5ScrollClickProgress"
      );

    const status =
      document.getElementById(
        "week5ScrollClickStatus"
      );

    if (
      !viewport ||
      !scene ||
      !targetDisplay ||
      !progress ||
      !status
    ) {
      return;
    }

    const objects =
      Array.from(
        scene.querySelectorAll(
          "[data-scroll-click-object]"
        )
      );

    const rounds = [
      {
        id: "balloon",
        emoji: "🎈",
        name: "RED BALLOON"
      },
      {
        id: "star",
        emoji: "⭐",
        name: "STAR"
      },
      {
        id: "apple",
        emoji: "🍎",
        name: "APPLE"
      },
      {
        id: "rocket",
        emoji: "🚀",
        name: "ROCKET"
      }
    ];

    const MAX_SCROLL = 900;
    /*
     * Guarantee that every object used by the hunt
     * actually exists in the scrolling scene.
     */
    const requiredTargets = [
      {
        id: "key",
        emoji: "🔑",
        top: 160,
        left: 24
      },
      {
        id: "map",
        emoji: "🗺️",
        top: 500,
        left: 34
      },
      {
        id: "chest",
        emoji: "🧰",
        top: 860,
        left: 25
      },
      {
        id: "gem",
        emoji: "💎",
        top: 1220,
        left: 32
      },
      {
        id: "crown",
        emoji: "👑",
        top: 1540,
        left: 28
      }
    ];

    requiredTargets.forEach(
      targetInfo => {
        let item =
          scene.querySelector(
            `[data-week6-treasure="${targetInfo.id}"]`
          );

        if (!item) {
          item =
            document.createElement(
              "button"
            );

          item.type =
            "button";

          item.className =
            "week6-treasure-item";

          item.dataset.week6Treasure =
            targetInfo.id;

          item.textContent =
            targetInfo.emoji;

          scene.appendChild(
            item
          );
        }

        /*
         * Also force every required target to a
         * known reachable location.
         */
        item.style.top =
          `${targetInfo.top}px`;

        item.style.left =
          `${targetInfo.left}%`;
      }
    );


    let scrollPosition = 360;
    let roundIndex = 0;
    let locked = false;
    let finished = false;

    function stopScrollSound() {
      if (week5ScrollClickSoundTimer) {
        clearTimeout(
          week5ScrollClickSoundTimer
        );

        week5ScrollClickSoundTimer = null;
      }

      if (week5ScrollClickSound) {
        week5ScrollClickSound.pause();
        week5ScrollClickSound.currentTime = 0;
        week5ScrollClickSound.loop = false;
        week5ScrollClickSound = null;
      }
    }

    function playSound(
      src,
      volume = 0.5
    ) {
      if (!soundEnabled) {
        return;
      }

      const sound =
        new Audio(src);

      sound.volume = volume;
      sound.currentTime = 0;

      week5ScrollClickActiveSounds.push(
        sound
      );

      sound
        .play()
        .catch(() => {});

      sound.addEventListener(
        "ended",
        () => {
          week5ScrollClickActiveSounds =
            week5ScrollClickActiveSounds.filter(
              item => item !== sound
            );
        },
        { once: true }
      );
    }

    function playScrollSound() {
      if (!soundEnabled) {
        return;
      }

      if (!week5ScrollClickSound) {
        week5ScrollClickSound =
          new Audio(
            "/sounds/scroll.mp3"
          );

        week5ScrollClickSound.volume = 0.42;
        week5ScrollClickSound.loop = true;

        week5ScrollClickActiveSounds.push(
          week5ScrollClickSound
        );

        week5ScrollClickSound
          .play()
          .catch(() => {});
      }

      if (week5ScrollClickSoundTimer) {
        clearTimeout(
          week5ScrollClickSoundTimer
        );
      }

      week5ScrollClickSoundTimer =
        setTimeout(
          stopScrollSound,
          180
        );
    }

    function updateScene() {
      scene.style.transform =
        `translateY(-${scrollPosition}px)`;
    }

    function loadRound() {
      if (finished) {
        return;
      }

      locked = false;

      const round =
        rounds[roundIndex];

      targetDisplay.innerHTML = `
        <span>${round.emoji}</span>
        <strong>${round.name}</strong>
      `;

      progress.textContent =
        `${roundIndex + 1} of ${rounds.length}`;

      status.textContent =
        `Find and CLICK the ${round.name}.`;

      objects.forEach((object) => {
        object.classList.remove(
          "week5-scroll-click-correct",
          "week5-scroll-click-wrong"
        );
      });
    }

    function finishActivity() {
      finished = true;
      locked = true;

      stopScrollSound();

      status.textContent =
        "Great job!";

      const celebration =
        document.createElement("div");

      celebration.className =
        "week5-scroll-click-celebration";

      celebration.innerHTML = `
        <div class="week5-scroll-click-celebration-card">
          <div>⭐</div>
          <strong>GREAT JOB!</strong>
          <span>You scrolled and clicked!</span>
        </div>
      `;

      viewport.appendChild(
        celebration
      );

      requestAnimationFrame(() => {
        celebration.classList.add(
          "week5-scroll-click-celebration-show"
        );
      });

      playSound(
        "/sounds/correct.mp3",
        0.6
      );
    }

    function completeRound(object) {
      if (
        locked ||
        finished
      ) {
        return;
      }

      locked = true;

      stopScrollSound();

      object.classList.add(
        "week5-scroll-click-correct"
      );

      status.textContent =
        "You found it!";

      playSound(
        "/sounds/correct.mp3",
        0.55
      );

      week5ScrollClickRoundTimer =
        setTimeout(() => {
          if (!viewport.isConnected) {
            return;
          }

          object.classList.remove(
            "week5-scroll-click-correct"
          );

          roundIndex += 1;

          if (
            roundIndex >=
            rounds.length
          ) {
            finishActivity();
            return;
          }

          loadRound();
        }, 850);
    }

    const wheelHandler =
      event => {
        if (
          locked ||
          finished
        ) {
          event.preventDefault();
          return;
        }

        const rect =
          viewport.getBoundingClientRect();

        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          return;
        }

        event.preventDefault();

        playScrollSound();

        const amount =
          Math.min(
            Math.max(
              Math.abs(event.deltaY),
              22
            ),
            65
          );

        if (event.deltaY > 0) {
          scrollPosition =
            Math.min(
              scrollPosition + amount,
              MAX_SCROLL
            );

          status.textContent =
            "Scroll, look, then click!";
        } else {
          scrollPosition =
            Math.max(
              scrollPosition - amount,
              0
            );

          status.textContent =
            "Scroll, look, then click!";
        }

        updateScene();
      };

    const clickHandler =
      event => {
        if (
          locked ||
          finished
        ) {
          return;
        }

        const object =
          event.target.closest(
            "[data-scroll-click-object]"
          );

        if (!object) {
          return;
        }

        playSound(
          "/sounds/mouseclick.mp3",
          0.45
        );

        const round =
          rounds[roundIndex];

        if (
          object.dataset.scrollClickObject ===
          round.id
        ) {
          completeRound(object);
          return;
        }

        object.classList.add(
          "week5-scroll-click-wrong"
        );

        status.textContent =
          "Try another one.";

        setTimeout(() => {
          if (object.isConnected) {
            object.classList.remove(
              "week5-scroll-click-wrong"
            );
          }
        }, 350);
      };

    viewport.addEventListener(
      "wheel",
      wheelHandler,
      {
        passive: false
      }
    );

    viewport.addEventListener(
      "click",
      clickHandler
    );

    removeWeek5ScrollClickWheelListener =
      () => {
        viewport.removeEventListener(
          "wheel",
          wheelHandler
        );
      };

    removeWeek5ScrollClickClickListener =
      () => {
        viewport.removeEventListener(
          "click",
          clickHandler
        );
      };

    updateScene();
    loadRound();
  }

  function startWeek5StopTargetBehavior() {
    stopWeek5StopTargetBehavior();

    const area =
      document.getElementById(
        "week5StopTargetArea"
      );

    const elevator =
      document.getElementById(
        "week5StopTargetElevator"
      );

    const target =
      document.getElementById(
        "week5StopTargetFloor"
      );

    const status =
      document.getElementById(
        "week5StopTargetStatus"
      );

    const progress =
      document.getElementById(
        "week5StopTargetProgress"
      );

    if (
      !area ||
      !elevator ||
      !target ||
      !status ||
      !progress
    ) {
      return;
    }

    /*
     * y values are measured from the TOP.
     */
    const rounds = [
      {
        start: 270,
        target: 75,
        floor: "4"
      },
      {
        start: 65,
        target: 235,
        floor: "1"
      },
      {
        start: 250,
        target: 135,
        floor: "3"
      },
      {
        start: 95,
        target: 195,
        floor: "2"
      }
    ];

    const MIN_Y = 45;
    const MAX_Y = 275;
    const TOLERANCE = 13;

    let roundIndex = 0;
    let elevatorY = 0;
    let locked = false;
    let finished = false;

    function stopScrollSound() {
      if (week5StopTargetSoundTimer) {
        clearTimeout(
          week5StopTargetSoundTimer
        );

        week5StopTargetSoundTimer = null;
      }

      if (week5StopTargetSound) {
        week5StopTargetSound.pause();
        week5StopTargetSound.currentTime = 0;
        week5StopTargetSound.loop = false;
        week5StopTargetSound = null;
      }
    }

    function playScrollSound() {
      if (!soundEnabled) {
        return;
      }

      if (!week5StopTargetSound) {
        week5StopTargetSound =
          new Audio(
            "/sounds/scroll.mp3"
          );

        week5StopTargetSound.volume = 0.42;
        week5StopTargetSound.loop = true;

        week5StopTargetSound
          .play()
          .catch(() => {});
      }

      if (week5StopTargetSoundTimer) {
        clearTimeout(
          week5StopTargetSoundTimer
        );
      }

      week5StopTargetSoundTimer =
        setTimeout(
          stopScrollSound,
          180
        );
    }

    function playCorrect() {
      if (!soundEnabled) {
        return;
      }

      const sound =
        new Audio(
          "/sounds/correct.mp3"
        );

      sound.volume = 0.55;
      sound.currentTime = 0;

      sound
        .play()
        .catch(() => {});
    }

    function updateElevator() {
      elevator.style.top =
        `${elevatorY}px`;
    }

    function loadRound() {
      if (finished) {
        return;
      }

      locked = false;

      const round =
        rounds[roundIndex];

      elevatorY =
        round.start;

      elevator.style.top =
        `${round.start}px`;

      target.style.top =
        `${round.target}px`;

      target.querySelector(
        "strong"
      ).textContent =
        `FLOOR ${round.floor}`;

      progress.textContent =
        `${roundIndex + 1} of ${rounds.length}`;

      status.textContent =
        `Stop at FLOOR ${round.floor}.`;

      elevator.classList.remove(
        "week5-stop-target-correct"
      );

      target.classList.remove(
        "week5-stop-target-floor-correct"
      );
    }

    function finishActivity() {
      finished = true;
      locked = true;

      stopScrollSound();

      status.textContent =
        "Great control!";

      const celebration =
        document.createElement("div");

      celebration.className =
        "week5-stop-target-celebration";

      celebration.innerHTML = `
        <div class="week5-stop-target-celebration-card">
          <div>⭐</div>
          <strong>GREAT CONTROL!</strong>
          <span>You stopped right on target!</span>
        </div>
      `;

      area.appendChild(
        celebration
      );

      requestAnimationFrame(() => {
        celebration.classList.add(
          "week5-stop-target-celebration-show"
        );
      });

      playCorrect();
    }

    function completeRound() {
      if (
        locked ||
        finished
      ) {
        return;
      }

      locked = true;

      stopScrollSound();

      elevator.classList.add(
        "week5-stop-target-correct"
      );

      target.classList.add(
        "week5-stop-target-floor-correct"
      );

      status.textContent =
        "Perfect stop!";

      playCorrect();

      week5StopTargetRoundTimer =
        setTimeout(() => {
          if (!area.isConnected) {
            return;
          }

          roundIndex += 1;

          if (
            roundIndex >=
            rounds.length
          ) {
            finishActivity();
            return;
          }

          loadRound();
        }, 900);
    }

    function scheduleStopCheck() {
      if (week5StopTargetCheckTimer) {
        clearTimeout(
          week5StopTargetCheckTimer
        );
      }

      week5StopTargetCheckTimer =
        setTimeout(() => {
          if (
            locked ||
            finished ||
            !area.isConnected
          ) {
            return;
          }

          const round =
            rounds[roundIndex];

          const distance =
            Math.abs(
              elevatorY -
              round.target
            );

          if (
            distance <=
            TOLERANCE
          ) {
            completeRound();
          } else {
            status.textContent =
              elevatorY <
              round.target
                ? "A little lower..."
                : "A little higher...";
          }
        }, 300);
    }

    const wheelHandler =
      event => {
        if (
          locked ||
          finished
        ) {
          event.preventDefault();
          return;
        }

        const rect =
          area.getBoundingClientRect();

        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          return;
        }

        event.preventDefault();

        playScrollSound();

        /*
         * Keep movement small here.
         * This step is about precision.
         */
        const amount =
          Math.min(
            Math.max(
              Math.abs(event.deltaY) * 0.28,
              7
            ),
            18
          );

        if (event.deltaY > 0) {
          elevatorY =
            Math.min(
              elevatorY + amount,
              MAX_Y
            );

          status.textContent =
            "Moving DOWN...";
        } else {
          elevatorY =
            Math.max(
              elevatorY - amount,
              MIN_Y
            );

          status.textContent =
            "Moving UP...";
        }

        updateElevator();
        scheduleStopCheck();
      };

    area.addEventListener(
      "wheel",
      wheelHandler,
      {
        passive: false
      }
    );

    removeWeek5StopTargetWheelListener =
      () => {
        area.removeEventListener(
          "wheel",
          wheelHandler
        );

        stopScrollSound();
      };

    loadRound();
  }

  function startWeek5ScrollPracticeBehavior() {
    stopWeek5ScrollPracticeBehavior();

    const viewport =
      document.getElementById(
        "week5ScrollPracticeViewport"
      );

    const scene =
      document.getElementById(
        "week5ScrollPracticeScene"
      );

    const targetDisplay =
      document.getElementById(
        "week5ScrollPracticeTarget"
      );

    const progress =
      document.getElementById(
        "week5ScrollPracticeProgress"
      );

    const status =
      document.getElementById(
        "week5ScrollPracticeStatus"
      );

    if (
      !viewport ||
      !scene ||
      !targetDisplay ||
      !progress ||
      !status
    ) {
      return;
    }

    const rounds = [
      {
        id: "frog",
        emoji: "🐸",
        name: "FROG",
        y: 150
      },
      {
        id: "penguin",
        emoji: "🐧",
        name: "PENGUIN",
        y: 980
      },
      {
        id: "monkey",
        emoji: "🐵",
        name: "MONKEY",
        y: 430
      },
      {
        id: "lion",
        emoji: "🦁",
        name: "LION",
        y: 780
      }
    ];

    const MAX_SCROLL = 900;
    /*
     * Guarantee that every object used by the hunt
     * actually exists in the scrolling scene.
     */
    const requiredTargets = [
      {
        id: "key",
        emoji: "🔑",
        top: 160,
        left: 24
      },
      {
        id: "map",
        emoji: "🗺️",
        top: 500,
        left: 34
      },
      {
        id: "chest",
        emoji: "🧰",
        top: 860,
        left: 25
      },
      {
        id: "gem",
        emoji: "💎",
        top: 1220,
        left: 32
      },
      {
        id: "crown",
        emoji: "👑",
        top: 1540,
        left: 28
      }
    ];

    requiredTargets.forEach(
      targetInfo => {
        let item =
          scene.querySelector(
            `[data-week6-treasure="${targetInfo.id}"]`
          );

        if (!item) {
          item =
            document.createElement(
              "button"
            );

          item.type =
            "button";

          item.className =
            "week6-treasure-item";

          item.dataset.week6Treasure =
            targetInfo.id;

          item.textContent =
            targetInfo.emoji;

          scene.appendChild(
            item
          );
        }

        /*
         * Also force every required target to a
         * known reachable location.
         */
        item.style.top =
          `${targetInfo.top}px`;

        item.style.left =
          `${targetInfo.left}%`;
      }
    );

    const VIEW_CENTER = 170;
    const TARGET_TOLERANCE = 22;

    let scrollPosition = 390;
    let roundIndex = 0;
    let locked = false;
    let finished = false;

    function stopScrollSound() {
      if (week5ScrollPracticeSoundTimer) {
        clearTimeout(
          week5ScrollPracticeSoundTimer
        );

        week5ScrollPracticeSoundTimer = null;
      }

      if (week5ScrollPracticeSound) {
        week5ScrollPracticeSound.pause();
        week5ScrollPracticeSound.currentTime = 0;
        week5ScrollPracticeSound.loop = false;
        week5ScrollPracticeSound = null;
      }
    }

    function playScrollSound() {
      if (!soundEnabled) {
        return;
      }

      if (!week5ScrollPracticeSound) {
        week5ScrollPracticeSound =
          new Audio(
            "/sounds/scroll.mp3"
          );

        week5ScrollPracticeSound.volume = 0.42;
        week5ScrollPracticeSound.loop = true;

        week5ScrollPracticeSound
          .play()
          .catch(() => {});
      }

      if (week5ScrollPracticeSoundTimer) {
        clearTimeout(
          week5ScrollPracticeSoundTimer
        );
      }

      week5ScrollPracticeSoundTimer =
        setTimeout(
          stopScrollSound,
          180
        );
    }

    function playCorrect() {
      if (!soundEnabled) {
        return;
      }

      const sound =
        new Audio(
          "/sounds/correct.mp3"
        );

      sound.volume = 0.55;
      sound.currentTime = 0;

      sound
        .play()
        .catch(() => {});
    }

    function updateScene() {
      scene.style.transform =
        `translateY(-${scrollPosition}px)`;
    }

    function loadRound() {
      if (finished) {
        return;
      }

      locked = false;

      const round =
        rounds[roundIndex];

      targetDisplay.innerHTML =
        `
          <span>${round.emoji}</span>
          <strong>${round.name}</strong>
        `;

      progress.textContent =
        `${roundIndex + 1} of ${rounds.length}`;

      status.textContent =
        `Find the ${round.name}.`;
    }

    function finish() {
      finished = true;
      locked = true;

      stopScrollSound();

      status.textContent =
        "Great scrolling!";

      const box =
        document.createElement("div");

      box.className =
        "week5-scroll-practice-celebration";

      box.innerHTML = `
        <div class="week5-scroll-practice-celebration-card">
          <div>⭐</div>
          <strong>GREAT SCROLLING!</strong>
          <span>You can scroll UP and DOWN!</span>
        </div>
      `;

      viewport.appendChild(box);

      requestAnimationFrame(() => {
        box.classList.add(
          "week5-scroll-practice-celebration-show"
        );
      });

      playCorrect();
    }

    function completeRound() {
      if (
        locked ||
        finished
      ) {
        return;
      }

      locked = true;

      stopScrollSound();

      const round =
        rounds[roundIndex];

      const animal =
        scene.querySelector(
          `[data-scroll-animal="${round.id}"]`
        );

      animal?.classList.add(
        "week5-scroll-practice-found"
      );

      status.textContent =
        `You found the ${round.name}!`;

      playCorrect();

      week5ScrollPracticeRoundTimer =
        setTimeout(() => {
          if (!viewport.isConnected) {
            return;
          }

          animal?.classList.remove(
            "week5-scroll-practice-found"
          );

          roundIndex += 1;

          if (
            roundIndex >=
            rounds.length
          ) {
            finish();
            return;
          }

          loadRound();
        }, 850);
    }

    function checkTarget() {
      if (
        locked ||
        finished
      ) {
        return;
      }

      if (week5ScrollPracticeTargetStopTimer) {
        clearTimeout(
          week5ScrollPracticeTargetStopTimer
        );
      }

      week5ScrollPracticeTargetStopTimer =
        setTimeout(() => {
          if (
            locked ||
            finished ||
            !viewport.isConnected
          ) {
            return;
          }

          const round =
            rounds[roundIndex];

          const visibleY =
            round.y - scrollPosition;

          if (
            Math.abs(
              visibleY - VIEW_CENTER
            ) <= TARGET_TOLERANCE
          ) {
            completeRound();
          }
        }, 260);
    }

    const wheelHandler =
      event => {
        if (
          locked ||
          finished
        ) {
          event.preventDefault();
          return;
        }

        const rect =
          viewport.getBoundingClientRect();

        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          return;
        }

        event.preventDefault();

        playScrollSound();

        const amount =
          Math.min(
            Math.max(
              Math.abs(event.deltaY),
              22
            ),
            65
          );

        if (event.deltaY > 0) {
          scrollPosition =
            Math.min(
              scrollPosition + amount,
              MAX_SCROLL
            );

          status.textContent =
            "Scrolling DOWN...";
        } else {
          scrollPosition =
            Math.max(
              scrollPosition - amount,
              0
            );

          status.textContent =
            "Scrolling UP...";
        }

        updateScene();
        checkTarget();
      };

    viewport.addEventListener(
      "wheel",
      wheelHandler,
      {
        passive: false
      }
    );

    removeWeek5ScrollPracticeWheelListener =
      () => {
        viewport.removeEventListener(
          "wheel",
          wheelHandler
        );

        stopScrollSound();
      };

    updateScene();
    loadRound();
  }

  function startWeek5ScrollUpBehavior() {
    stopWeek5ScrollUpBehavior();

    const viewport =
      document.getElementById(
        "week5ScrollUpViewport"
      );

    const scene =
      document.getElementById(
        "week5ScrollUpScene"
      );

    const treehouse =
      document.getElementById(
        "week5ScrollUpTreehouse"
      );

    const status =
      document.getElementById(
        "week5ScrollUpStatus"
      );

    const arrow =
      document.getElementById(
        "week5ScrollUpArrow"
      );

    const progress =
      document.getElementById(
        "week5ScrollUpProgress"
      );

    if (
      !viewport ||
      !scene ||
      !treehouse ||
      !status ||
      !arrow ||
      !progress
    ) {
      return;
    }

    const MAX_SCROLL = 760;

    /*
     * Start at the BOTTOM.
     */
    let scrollPosition = MAX_SCROLL;
    let completed = false;

    function stopScrollSound() {
      if (week5ScrollUpSoundTimer) {
        clearTimeout(
          week5ScrollUpSoundTimer
        );

        week5ScrollUpSoundTimer = null;
      }

      if (week5ScrollUpSound) {
        week5ScrollUpSound.pause();
        week5ScrollUpSound.currentTime = 0;
        week5ScrollUpSound.loop = false;
        week5ScrollUpSound = null;
      }
    }

    function playScrollSound() {
      if (!soundEnabled) {
        return;
      }

      if (!week5ScrollUpSound) {
        week5ScrollUpSound =
          new Audio(
            "/sounds/scroll.mp3"
          );

        week5ScrollUpSound.volume = 0.45;
        week5ScrollUpSound.loop = true;

        week5ScrollUpActiveSounds.push(
          week5ScrollUpSound
        );

        week5ScrollUpSound
          .play()
          .catch(() => {});
      }

      if (week5ScrollUpSoundTimer) {
        clearTimeout(
          week5ScrollUpSoundTimer
        );
      }

      week5ScrollUpSoundTimer =
        setTimeout(() => {
          stopScrollSound();
        }, 180);
    }

    function updateScene() {
      scene.style.transform =
        `translateY(-${scrollPosition}px)`;

      const percent =
        Math.round(
          (
            (MAX_SCROLL - scrollPosition) /
            MAX_SCROLL
          ) * 100
        );

      progress.style.width =
        `${percent}%`;

      if (scrollPosition <= 0) {
        finish();
      }
    }

    function finish() {
      if (completed) {
        return;
      }

      completed = true;

      stopScrollSound();

      scene.style.transform =
        "translateY(0px)";

      progress.style.width =
        "100%";

      treehouse.classList.add(
        "week5-scroll-treehouse-found"
      );

      arrow.classList.add(
        "week5-scroll-up-arrow-complete"
      );

      status.textContent =
        "You reached the treehouse!";

      const celebration =
        document.createElement("div");

      celebration.className =
        "week5-scroll-up-celebration";

      celebration.innerHTML = `
        <div class="week5-scroll-up-celebration-card">

          <div class="week5-scroll-up-celebration-icon">
            ⭐
          </div>

          <strong>
            GOOD JOB!
          </strong>

          <span>
            You scrolled UP!
          </span>

        </div>
      `;

      viewport.appendChild(
        celebration
      );

      requestAnimationFrame(() => {
        celebration.classList.add(
          "week5-scroll-up-celebration-show"
        );
      });

      if (soundEnabled) {
        const correctSound =
          new Audio(
            "/sounds/correct.mp3"
          );

        correctSound.volume = 0.6;
        correctSound.currentTime = 0;

        week5ScrollUpActiveSounds.push(
          correctSound
        );

        week5ScrollUpSound =
          correctSound;

        correctSound
          .play()
          .catch(() => {});

        correctSound.addEventListener(
          "ended",
          () => {
            week5ScrollUpActiveSounds =
              week5ScrollUpActiveSounds.filter(
                sound =>
                  sound !== correctSound
              );

            if (
              week5ScrollUpSound ===
              correctSound
            ) {
              week5ScrollUpSound = null;
            }
          },
          { once: true }
        );
      }
    }

    const wheelHandler =
      (event) => {
        if (completed) {
          event.preventDefault();
          return;
        }

        const rect =
          viewport.getBoundingClientRect();

        const inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;

        if (!inside) {
          return;
        }

        event.preventDefault();

        /*
         * Step 4 teaches UP only.
         */
        if (event.deltaY >= 0) {
          status.textContent =
            "Roll the wheel UP.";

          arrow.classList.add(
            "week5-scroll-up-arrow-wrong"
          );

          setTimeout(() => {
            if (arrow.isConnected) {
              arrow.classList.remove(
                "week5-scroll-up-arrow-wrong"
              );
            }
          }, 220);

          return;
        }

        playScrollSound();

        const amount =
          Math.min(
            Math.max(
              Math.abs(event.deltaY),
              24
            ),
            70
          );

        scrollPosition =
          Math.max(
            scrollPosition - amount,
            0
          );

        status.textContent =
          "Keep rolling UP!";

        arrow.classList.add(
          "week5-scroll-up-arrow-active"
        );

        setTimeout(() => {
          if (arrow.isConnected) {
            arrow.classList.remove(
              "week5-scroll-up-arrow-active"
            );
          }
        }, 160);

        updateScene();
      };

    viewport.addEventListener(
      "wheel",
      wheelHandler,
      {
        passive: false
      }
    );

    removeWeek5ScrollUpWheelListener =
      () => {
        viewport.removeEventListener(
          "wheel",
          wheelHandler
        );

        stopScrollSound();
      };

    updateScene();
  }

  function startWeek5ScrollDownBehavior() {
    stopWeek5ScrollDownBehavior();

    const viewport =
      document.getElementById(
        "week5ScrollDownViewport"
      );

    const scene =
      document.getElementById(
        "week5ScrollDownScene"
      );

    const treasure =
      document.getElementById(
        "week5ScrollDownTreasure"
      );

    const status =
      document.getElementById(
        "week5ScrollDownStatus"
      );

    const arrow =
      document.getElementById(
        "week5ScrollDownArrow"
      );

    const progress =
      document.getElementById(
        "week5ScrollDownProgress"
      );

    if (
      !viewport ||
      !scene ||
      !treasure ||
      !status ||
      !arrow ||
      !progress
    ) {
      return;
    }

    let scrollPosition = 0;
    let completed = false;

    const MAX_SCROLL = 760;

    function stopScrollSound() {
      if (week5ScrollDownSoundTimer) {
        clearTimeout(
          week5ScrollDownSoundTimer
        );

        week5ScrollDownSoundTimer = null;
      }

      if (week5ScrollDownSound) {
        week5ScrollDownSound.pause();
        week5ScrollDownSound.currentTime = 0;
        week5ScrollDownSound = null;
      }
    }

    function playScrollSound() {
      if (!soundEnabled) {
        return;
      }

      if (!week5ScrollDownSound) {
        week5ScrollDownSound =
          new Audio(
            "/sounds/scroll.mp3"
          );

        week5ScrollDownSound.volume = 0.45;
        week5ScrollDownSound.loop = true;

        week5ScrollDownActiveSounds.push(
          week5ScrollDownSound
        );

        week5ScrollDownSound
          .play()
          .catch(() => {});
      }

      if (week5ScrollDownSoundTimer) {
        clearTimeout(
          week5ScrollDownSoundTimer
        );
      }

      week5ScrollDownSoundTimer =
        setTimeout(() => {
          stopScrollSound();
        }, 180);
    }

    function updateScene() {
      scene.style.transform =
        `translateY(-${scrollPosition}px)`;

      const percent =
        Math.round(
          (scrollPosition / MAX_SCROLL) *
          100
        );

      progress.style.width =
        `${percent}%`;

      if (
        scrollPosition >=
        MAX_SCROLL
      ) {
        finish();
      }
    }

    function finish() {
      if (completed) {
        return;
      }

      completed = true;

      stopScrollSound();

      scene.style.transform =
        `translateY(-${MAX_SCROLL}px)`;

      progress.style.width =
        "100%";

      treasure.classList.add(
        "week5-scroll-treasure-found"
      );

      arrow.classList.add(
        "week5-scroll-down-arrow-complete"
      );

      status.textContent =
        "You found the treasure!";

      const celebration =
        document.createElement("div");

      celebration.className =
        "week5-scroll-down-celebration";

      celebration.innerHTML = `
        <div class="week5-scroll-down-celebration-card">
          <div class="week5-scroll-down-celebration-icon">
            ⭐
          </div>

          <strong>
            GOOD JOB!
          </strong>

          <span>
            You scrolled DOWN!
          </span>
        </div>
      `;

      viewport.appendChild(
        celebration
      );

      requestAnimationFrame(() => {
        celebration.classList.add(
          "week5-scroll-down-celebration-show"
        );
      });

      if (soundEnabled) {
        const correctSound =
          new Audio(
            "/sounds/correct.mp3"
          );

        correctSound.volume = 0.6;
        correctSound.currentTime = 0;

        week5ScrollDownActiveSounds.push(
          correctSound
        );

        week5ScrollDownSound =
          correctSound;

        correctSound
          .play()
          .catch(() => {});

        correctSound.addEventListener(
          "ended",
          () => {
            week5ScrollDownActiveSounds =
              week5ScrollDownActiveSounds.filter(
                sound =>
                  sound !== correctSound
              );

            if (
              week5ScrollDownSound ===
              correctSound
            ) {
              week5ScrollDownSound = null;
            }
          },
          { once: true }
        );
      }
    }

    const wheelHandler =
      (event) => {
        if (completed) {
          event.preventDefault();
          return;
        }

        /*
         * Only capture the wheel while the
         * pointer is inside this activity.
         */
        const rect =
          viewport.getBoundingClientRect();

        const inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;

        if (!inside) {
          return;
        }

        event.preventDefault();

        /*
         * Step 3 teaches DOWN only.
         * Upward scrolling does not advance.
         */
        if (event.deltaY <= 0) {
          status.textContent =
            "Roll the wheel DOWN.";

          arrow.classList.add(
            "week5-scroll-down-arrow-wrong"
          );

          setTimeout(() => {
            arrow.classList.remove(
              "week5-scroll-down-arrow-wrong"
            );
          }, 220);

          return;
        }

        playScrollSound();

        /*
         * Normalize different mouse-wheel
         * hardware so progress feels consistent.
         */
        const amount =
          Math.min(
            Math.max(
              Math.abs(event.deltaY),
              24
            ),
            70
          );

        scrollPosition =
          Math.min(
            scrollPosition + amount,
            MAX_SCROLL
          );

        status.textContent =
          "Keep rolling DOWN!";

        arrow.classList.add(
          "week5-scroll-down-arrow-active"
        );

        setTimeout(() => {
          arrow.classList.remove(
            "week5-scroll-down-arrow-active"
          );
        }, 160);

        updateScene();
      };

    viewport.addEventListener(
      "wheel",
      wheelHandler,
      {
        passive: false
      }
    );

    removeWeek5ScrollDownWheelListener =
      () => {
        viewport.removeEventListener(
          "wheel",
          wheelHandler
        );

        stopScrollSound();
      };

    updateScene();
  }

  function startWeek5MeetWheelAnimation() {
    stopWeek5MeetWheelAnimation();

    const screen =
      document.querySelector(
        ".lesson-screen-week5-meet-wheel"
      );

    if (!screen) {
      return;
    }

    const wheel =
      document.getElementById(
        "week5MeetWheel"
      );

    const finger =
      document.getElementById(
        "week5MeetWheelFinger"
      );

    const message =
      document.getElementById(
        "week5MeetWheelMessage"
      );

    const upArrow =
      document.getElementById(
        "week5MeetWheelUp"
      );

    const downArrow =
      document.getElementById(
        "week5MeetWheelDown"
      );

    if (
      !wheel ||
      !finger ||
      !message ||
      !upArrow ||
      !downArrow
    ) {
      return;
    }

    function stopScrollSound() {
      if (!week5MeetWheelSound) {
        return;
      }

      week5MeetWheelSound.pause();
      week5MeetWheelSound.currentTime = 0;
      week5MeetWheelSound = null;
    }

    function playScrollSound() {
      stopScrollSound();

      if (!soundEnabled) {
        return;
      }

      week5MeetWheelSound =
        new Audio(
          "/sounds/scroll.mp3"
        );

      week5MeetWheelSound.volume = 0.5;
      week5MeetWheelSound.currentTime = 0;

      week5MeetWheelSound
        .play()
        .catch(() => {});
    }

    function clearMotion() {
      wheel.classList.remove(
        "week5-wheel-roll-down",
        "week5-wheel-roll-up"
      );

      finger.classList.remove(
        "week5-wheel-hand-ready",
        "week5-wheel-hand-down",
        "week5-wheel-hand-up"
      );

      upArrow.classList.remove(
        "week5-wheel-arrow-active"
      );

      downArrow.classList.remove(
        "week5-wheel-arrow-active"
      );

      stopScrollSound();
    }

    function startSequence() {
      clearMotion();

      message.textContent =
        "This is the SCROLL WHEEL.";

      wheel.classList.add(
        "week5-wheel-highlight"
      );

      /*
       * Finger moves onto wheel.
       */
      week5MeetWheelTimers.push(
        setTimeout(() => {
          finger.classList.add(
            "week5-wheel-hand-ready"
          );

          message.textContent =
            "Put your finger on the wheel.";
        }, 1200)
      );

      /*
       * Roll down.
       */
      week5MeetWheelTimers.push(
        setTimeout(() => {
          wheel.classList.add(
            "week5-wheel-roll-down"
          );

          finger.classList.add(
            "week5-wheel-hand-down"
          );

          downArrow.classList.add(
            "week5-wheel-arrow-active"
          );

          message.textContent =
            "ROLL DOWN.";

          playScrollSound();
        }, 2600)
      );

      /*
       * Stop after down motion.
       */
      week5MeetWheelTimers.push(
        setTimeout(() => {
          stopScrollSound();

          wheel.classList.remove(
            "week5-wheel-roll-down"
          );

          finger.classList.remove(
            "week5-wheel-hand-down"
          );

          downArrow.classList.remove(
            "week5-wheel-arrow-active"
          );
        }, 3900)
      );

      /*
       * Roll up.
       */
      week5MeetWheelTimers.push(
        setTimeout(() => {
          wheel.classList.add(
            "week5-wheel-roll-up"
          );

          finger.classList.add(
            "week5-wheel-hand-up"
          );

          upArrow.classList.add(
            "week5-wheel-arrow-active"
          );

          message.textContent =
            "ROLL UP.";

          playScrollSound();
        }, 4550)
      );

      /*
       * Finish and loop.
       */
      week5MeetWheelTimers.push(
        setTimeout(() => {
          clearMotion();

          message.textContent =
            "The wheel moves pages UP and DOWN.";
        }, 5900)
      );

      week5MeetWheelTimers.push(
        setTimeout(
          startSequence,
          7600
        )
      );
    }

    startSequence();
  }

  let removeWeek6WarmUpWheelListener = null;
  let week6WarmUpScrollSound = null;
  let week6WarmUpScrollSoundTimer = null;
  let week6WarmUpStopTimer = null;
  let week6WarmUpRoundTimer = null;

  function stopWeek6WarmUpBehavior() {
    removeWeek6WarmUpWheelListener?.();
    removeWeek6WarmUpWheelListener = null;

    if (week6WarmUpScrollSoundTimer) {
      clearTimeout(
        week6WarmUpScrollSoundTimer
      );

      week6WarmUpScrollSoundTimer = null;
    }

    if (week6WarmUpStopTimer) {
      clearTimeout(
        week6WarmUpStopTimer
      );

      week6WarmUpStopTimer = null;
    }

    if (week6WarmUpRoundTimer) {
      clearTimeout(
        week6WarmUpRoundTimer
      );

      week6WarmUpRoundTimer = null;
    }

    if (week6WarmUpScrollSound) {
      week6WarmUpScrollSound.pause();
      week6WarmUpScrollSound.currentTime = 0;
      week6WarmUpScrollSound.loop = false;
      week6WarmUpScrollSound = null;
    }
  }


  let removeWeek6PrecisionWheelListener = null;
  let week6PrecisionScrollSound = null;
  let week6PrecisionSoundTimer = null;
  let week6PrecisionStopTimer = null;
  let week6PrecisionRoundTimer = null;

  function stopWeek6PrecisionBehavior() {
    removeWeek6PrecisionWheelListener?.();
    removeWeek6PrecisionWheelListener = null;

    if (week6PrecisionSoundTimer) {
      clearTimeout(
        week6PrecisionSoundTimer
      );
      week6PrecisionSoundTimer = null;
    }

    if (week6PrecisionStopTimer) {
      clearTimeout(
        week6PrecisionStopTimer
      );
      week6PrecisionStopTimer = null;
    }

    if (week6PrecisionRoundTimer) {
      clearTimeout(
        week6PrecisionRoundTimer
      );
      week6PrecisionRoundTimer = null;
    }

    if (week6PrecisionScrollSound) {
      week6PrecisionScrollSound.pause();
      week6PrecisionScrollSound.currentTime = 0;
      week6PrecisionScrollSound.loop = false;
      week6PrecisionScrollSound = null;
    }
  }

  let removeWeek6ScrollClickWheelListener = null;
  let removeWeek6ScrollClickClickListener = null;
  let week6ScrollClickSound = null;
  let week6ScrollClickSoundTimer = null;
  let week6ScrollClickRoundTimer = null;

  function stopWeek6ScrollClickBehavior() {
    removeWeek6ScrollClickWheelListener?.();
    removeWeek6ScrollClickWheelListener = null;

    removeWeek6ScrollClickClickListener?.();
    removeWeek6ScrollClickClickListener = null;

    if (week6ScrollClickSoundTimer) {
      clearTimeout(
        week6ScrollClickSoundTimer
      );

      week6ScrollClickSoundTimer = null;
    }

    if (week6ScrollClickRoundTimer) {
      clearTimeout(
        week6ScrollClickRoundTimer
      );

      week6ScrollClickRoundTimer = null;
    }

    if (week6ScrollClickSound) {
      week6ScrollClickSound.pause();
      week6ScrollClickSound.currentTime = 0;
      week6ScrollClickSound.loop = false;
      week6ScrollClickSound = null;
    }
  }

  let removeWeek6MixedWheelListener = null;
  let removeWeek6MixedMoveListener = null;
  let removeWeek6MixedClickListener = null;
  let removeWeek6MixedDownListener = null;
  let removeWeek6MixedDragListener = null;
  let removeWeek6MixedUpListener = null;

  let week6MixedScrollSound = null;
  let week6MixedScrollSoundTimer = null;
  let week6MixedFloatingObject = null;

  const week6MixedSounds = new Set();
  const week6MixedTimers = new Set();

  function stopWeek6MixedBehavior() {
    removeWeek6MixedWheelListener?.();
    removeWeek6MixedMoveListener?.();
    removeWeek6MixedClickListener?.();
    removeWeek6MixedDownListener?.();
    removeWeek6MixedDragListener?.();
    removeWeek6MixedUpListener?.();

    removeWeek6MixedWheelListener = null;
    removeWeek6MixedMoveListener = null;
    removeWeek6MixedClickListener = null;
    removeWeek6MixedDownListener = null;
    removeWeek6MixedDragListener = null;
    removeWeek6MixedUpListener = null;

    if (week6MixedScrollSoundTimer) {
      clearTimeout(
        week6MixedScrollSoundTimer
      );
      week6MixedScrollSoundTimer = null;
    }

    if (week6MixedScrollSound) {
      week6MixedScrollSound.pause();
      week6MixedScrollSound.currentTime = 0;
      week6MixedScrollSound.loop = false;
      week6MixedScrollSound = null;
    }

    week6MixedTimers.forEach(timer => {
      clearTimeout(timer);
    });
    week6MixedTimers.clear();

    week6MixedSounds.forEach(sound => {
      sound.pause();
      sound.currentTime = 0;
    });
    week6MixedSounds.clear();

    if (
      week6MixedFloatingObject &&
      week6MixedFloatingObject.isConnected
    ) {
      week6MixedFloatingObject.remove();
    }

    week6MixedFloatingObject = null;
  }

  function startWeek6MixedBehavior() {
    stopWeek6MixedBehavior();

    const viewport =
      document.getElementById(
        "week6MixedViewport"
      );

    const scene =
      document.getElementById(
        "week6MixedScene"
      );

    const task =
      document.getElementById(
        "week6MixedTask"
      );

    const progress =
      document.getElementById(
        "week6MixedProgress"
      );

    const status =
      document.getElementById(
        "week6MixedStatus"
      );

    const repairBay =
      document.querySelector(
        ".week6-mixed-repair-bay"
      );

    const robot =
      document.getElementById(
        "week6MixedRobot"
      );

    const robotFace =
      document.getElementById(
        "week6MixedRobotFace"
      );

    const blueButton =
      document.getElementById(
        "week6MixedBlueButton"
      );

    const batterySlot =
      document.getElementById(
        "week6MixedBatterySlot"
      );

    const antennaSlot =
      document.getElementById(
        "week6MixedAntennaSlot"
      );

    const reactorSlot =
      document.getElementById(
        "week6MixedReactorSlot"
      );

    if (
      !viewport ||
      !scene ||
      !task ||
      !progress ||
      !status ||
      !repairBay ||
      !robot ||
      !robotFace ||
      !blueButton ||
      !batterySlot ||
      !antennaSlot ||
      !reactorSlot
    ) {
      return;
    }

    const missions = [
      {
        id: "wake",
        task: `
          <span class="week6-mixed-picture-clue">
            <span>🤖💤</span>

            <b>+</b>

            <span
              class="week6-mixed-click-mouse"
              aria-label="Click"
            >
              <i class="week6-mixed-click-left"></i>
              <i class="week6-mixed-click-right"></i>
              <i class="week6-mixed-click-wheel"></i>
              <em>↓</em>
            </span>

            <b>→</b>

            <span>🤖👀</span>
          </span>
        `,
        success: "✅ 🤖👀"
      },
      {
        id: "power",
        task: `
          <span class="week6-mixed-picture-clue">
            <span
              class="week6-mixed-click-mouse"
              aria-label="Click"
            >
              <i class="week6-mixed-click-left"></i>
              <i class="week6-mixed-click-right"></i>
              <i class="week6-mixed-click-wheel"></i>
              <em>↓</em>
            </span>

            <b>+</b>

            <span class="week6-mixed-blue-clue"></span>

            <b>→</b>

            <span>🤖⚡</span>
          </span>
        `,
        success: "✅ 🤖⚡"
      },
      {
        id: "battery",
        task: `
          <span class="week6-mixed-picture-clue">
            🖱️↕️ <b>→</b> 🔋 <b>→</b> 🤖
          </span>
        `,
        success: "✅ 🔋🤖"
      },
      {
        id: "antenna",
        task: `
          <span class="week6-mixed-picture-clue">
            <span
              class="week6-mixed-antenna-piece week6-mixed-clue-antenna"
              aria-label="Robot antennas"
            >
              <i></i>
              <i></i>
            </span>
          </span>
        `,
        success: "✅ 📶🤖"
      },
      {
        id: "crystal",
        task: `
          <span class="week6-mixed-picture-clue">
            🖱️↕️ <b>→</b> 💎 <b>→</b> 🤖✨
          </span>
        `,
        success: "✅ 💎🤖✨"
      }
    ];

    const destinations = {
      battery: batterySlot,
      antenna: antennaSlot,
      crystal: reactorSlot
    };

    const MAX_SCROLL = 1320;

    let missionIndex = 0;
    let scrollPosition = 0;
    let robotScrollPosition = 0;
    let locked = false;
    let finished = false;
    let dragging = false;
    let activeObject = null;
    let originalParent = null;
    let originalNextSibling = null;
    let originalStyleText = null;
    let offsetX = 0;
    let offsetY = 0;

    function schedule(callback, delay) {
      const timer = setTimeout(() => {
        week6MixedTimers.delete(timer);
        callback();
      }, delay);

      week6MixedTimers.add(timer);
      return timer;
    }

    function playSound(src, volume) {
      if (!soundEnabled) {
        return;
      }

      const sound = new Audio(src);
      sound.volume = volume;
      week6MixedSounds.add(sound);

      const forgetSound = () => {
        week6MixedSounds.delete(sound);
      };

      sound.addEventListener(
        "ended",
        forgetSound,
        { once: true }
      );

      sound.play().catch(forgetSound);
    }

    function stopScrollSound() {
      if (week6MixedScrollSoundTimer) {
        clearTimeout(
          week6MixedScrollSoundTimer
        );
        week6MixedScrollSoundTimer = null;
      }

      if (week6MixedScrollSound) {
        week6MixedScrollSound.pause();
        week6MixedScrollSound.currentTime = 0;
        week6MixedScrollSound.loop = false;
        week6MixedScrollSound = null;
      }
    }

    function playScrollSound() {
      if (!soundEnabled) {
        return;
      }

      if (!week6MixedScrollSound) {
        week6MixedScrollSound =
          new Audio(
            "/sounds/scroll.mp3"
          );

        week6MixedScrollSound.volume = 0.4;
        week6MixedScrollSound.loop = true;

        week6MixedScrollSound
          .play()
          .catch(() => {});
      }

      if (week6MixedScrollSoundTimer) {
        clearTimeout(
          week6MixedScrollSoundTimer
        );
      }

      week6MixedScrollSoundTimer =
        setTimeout(
          stopScrollSound,
          180
        );
    }

    function updateScene() {
      scene.style.transform =
        `translateY(-${scrollPosition}px)`;
    }

    function updateRobotPosition() {
      robot.style.marginTop =
        `-${robotScrollPosition}px`;
    }

    function currentMission() {
      return missions[missionIndex];
    }

    function updatePartVisibility() {
      scene
        .querySelectorAll(
          "[data-week6-mixed-part]"
        )
        .forEach(part => {
          const firstMission =
            Number(
              part.dataset.mixedMission
            );

          part.hidden =
            firstMission > missionIndex;

          part.classList.remove(
            "week6-mixed-wrong",
            "week6-mixed-correct"
          );
        });
    }

    function loadMission() {
      if (finished) {
        return;
      }

      locked = false;
      dragging = false;
      activeObject = null;

      const mission = currentMission();

      task.innerHTML = mission.task;

      progress.textContent =
        `${missionIndex + 1} of ${missions.length}`;

      status.textContent =
        "👀　💭";

      if (
        mission.id === "battery" ||
        mission.id === "antenna" ||
        mission.id === "crystal"
      ) {
        scrollPosition = 0;
      }

      robot
        .querySelectorAll(
          ".week6-mixed-slot"
        )
        .forEach(slot => {
          slot.classList.remove(
            "week6-mixed-slot-active"
          );
        });

      destinations[
        mission.id
      ]?.classList.add(
        "week6-mixed-slot-active"
      );

      updatePartVisibility();
      updateScene();
    }

    function showWrong(object, message) {
      object?.classList.add(
        "week6-mixed-wrong"
      );

      status.textContent = message;

      playSound(
        "/sounds/buzzer.mp3",
        0.55
      );

      schedule(() => {
        if (object?.isConnected) {
          object.classList.remove(
            "week6-mixed-wrong"
          );
        }
      }, 350);
    }

    function finishActivity() {
      finished = true;
      locked = true;
      dragging = false;

      stopScrollSound();

      robot.classList.add(
        "week6-mixed-robot-complete"
      );

      status.textContent =
        "Robot repair complete!";

      const celebration =
        document.createElement("div");

      celebration.className =
        "week6-mixed-celebration";

      celebration.innerHTML = `
        <div class="week6-mixed-celebration-card">
          <div>🤖✨</div>
          <strong>ROBOT COMPLETE!</strong>
          <span>
            You knew exactly what to do!
          </span>
        </div>
      `;

      viewport.appendChild(
        celebration
      );

      requestAnimationFrame(() => {
        celebration.classList.add(
          "week6-mixed-celebration-show"
        );
      });

      playSound(
        "/sounds/complete.mp3",
        0.65
      );
    }

    function completeMission(object) {
      if (locked || finished) {
        return;
      }

      locked = true;
      dragging = false;

      const mission = currentMission();

      object?.classList.add(
        "week6-mixed-correct"
      );

      status.textContent =
        mission.success;

      playSound(
        "/sounds/correct.mp3",
        0.55
      );

      schedule(() => {
        if (!viewport.isConnected) {
          return;
        }

        missionIndex += 1;

        if (
          missionIndex >=
          missions.length
        ) {
          finishActivity();
          return;
        }

        loadMission();
      }, 850);
    }

    function pointInside(element, x, y) {
      const rect =
        element.getBoundingClientRect();

      return (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      );
    }

    function returnDraggedObject(object) {
      if (!object) {
        return;
      }

      object.classList.remove(
        "week6-mixed-held"
      );

      if (originalParent) {
        if (
          originalNextSibling &&
          originalNextSibling.parentNode ===
            originalParent
        ) {
          originalParent.insertBefore(
            object,
            originalNextSibling
          );
        } else {
          originalParent.appendChild(
            object
          );
        }
      }

      if (originalStyleText === null) {
        object.removeAttribute("style");
      } else {
        object.setAttribute(
          "style",
          originalStyleText
        );
      }

      originalParent = null;
      originalNextSibling = null;
      originalStyleText = null;
      week6MixedFloatingObject = null;
    }

    function installPart(
      object,
      destination,
      missionId
    ) {
      object.classList.remove(
        "week6-mixed-held"
      );

      object.remove();

      originalParent = null;
      originalNextSibling = null;
      originalStyleText = null;
      week6MixedFloatingObject = null;

      destination.classList.remove(
        "week6-mixed-slot-active"
      );

      destination.classList.add(
        "week6-mixed-slot-installed"
      );

      if (missionId === "battery") {
        destination.innerHTML =
          "<span>🔋</span>";
        robot.classList.add(
          "week6-mixed-has-battery"
        );
      }

      if (missionId === "antenna") {
        destination.innerHTML = `
          <span
            class="week6-mixed-antenna-piece week6-mixed-installed-antenna"
            aria-hidden="true"
          >
            <i></i>
            <i></i>
          </span>
        `;
        robot.classList.add(
          "week6-mixed-has-antenna"
        );
      }

      if (missionId === "crystal") {
        destination.innerHTML =
          "<span>💎</span>";
        robot.classList.add(
          "week6-mixed-has-crystal"
        );
      }

      completeMission(destination);
    }

    const wheelHandler = event => {
      if (locked || finished || dragging) {
        event.preventDefault();
        return;
      }

      const rect =
        viewport.getBoundingClientRect();

      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        return;
      }

      event.preventDefault();
      playScrollSound();

      const amount =
        Math.min(
          Math.max(
            Math.abs(event.deltaY),
            22
          ),
          65
        );

      const repairRect =
        repairBay.getBoundingClientRect();

      if (
        event.clientX >= repairRect.left &&
        event.clientX <= repairRect.right
      ) {
        if (event.deltaY > 0) {
          robotScrollPosition =
            Math.min(
              robotScrollPosition + amount,
              95
            );
        } else if (event.deltaY < 0) {
          robotScrollPosition =
            Math.max(
              robotScrollPosition - amount,
              0
            );
        }

        updateRobotPosition();
        return;
      }

      if (event.deltaY > 0) {
        scrollPosition =
          Math.min(
            scrollPosition + amount,
            MAX_SCROLL
          );
      } else if (event.deltaY < 0) {
        scrollPosition =
          Math.max(
            scrollPosition - amount,
            0
          );
      }

      updateScene();
    };

    const clickHandler = event => {
      if (locked || finished || dragging) {
        return;
      }

      const mission = currentMission();

      if (mission.id === "wake") {
        const clickedFace =
          event.target.closest(
            "#week6MixedRobotFace"
          );

        if (!clickedFace) {
          return;
        }

        playSound(
          "/sounds/mouseclick.mp3",
          0.45
        );

        robotFace.classList.add(
          "week6-mixed-face-awake"
        );

        robot.classList.add(
          "week6-mixed-robot-awake"
        );

        completeMission(robotFace);
        return;
      }

      if (mission.id !== "power") {
        return;
      }

      const button =
        event.target.closest(
          "[data-week6-robot-button]"
        );

      if (!button) {
        return;
      }

      playSound(
        "/sounds/mouseclick.mp3",
        0.45
      );

      if (
        button.dataset.week6RobotButton !==
        "blue"
      ) {
        showWrong(
          button,
          "❌　🔴　　👀　🔵"
        );
        return;
      }

      button.classList.add(
        "week6-mixed-button-on"
      );

      robot.classList.add(
        "week6-mixed-robot-powered"
      );

      completeMission(button);
    };

    const downHandler = event => {
      if (
        locked ||
        finished ||
        event.button !== 0
      ) {
        return;
      }

      const part =
        event.target.closest(
          "[data-week6-mixed-part]"
        );

      if (!part) {
        return;
      }

      const mission = currentMission();

      if (
        mission.id !== "battery" &&
        mission.id !== "antenna" &&
        mission.id !== "crystal"
      ) {
        return;
      }

      if (
        part.dataset.week6MixedPart !==
        mission.id
      ) {
        showWrong(
          part,
          "❌　🧩"
        );
        return;
      }

      event.preventDefault();

      const rect =
        part.getBoundingClientRect();

      offsetX =
        event.clientX - rect.left;

      offsetY =
        event.clientY - rect.top;

      originalParent = part.parentNode;
      originalNextSibling =
        part.nextSibling;
      originalStyleText =
        part.getAttribute("style");

      activeObject = part;
      dragging = true;
      week6MixedFloatingObject = part;

      part.style.position = "fixed";
      part.style.left = `${rect.left}px`;
      part.style.top = `${rect.top}px`;
      part.style.width = `${rect.width}px`;
      part.style.height = `${rect.height}px`;
      part.style.margin = "0";
      part.style.transform = "none";
      part.style.zIndex = "9999";

      part.classList.add(
        "week6-mixed-held"
      );

      document.body.appendChild(part);

      playSound(
        "/sounds/mouseclick.mp3",
        0.45
      );

      status.textContent =
        "✋　🧩　→　✨🤖";
    };

    const dragHandler = event => {
      if (!dragging || !activeObject) {
        return;
      }

      event.preventDefault();

      activeObject.style.left =
        `${event.clientX - offsetX}px`;

      activeObject.style.top =
        `${event.clientY - offsetY}px`;
    };

    const upHandler = event => {
      if (
        !dragging ||
        !activeObject ||
        event.button !== 0
      ) {
        return;
      }

      const object = activeObject;
      const mission = currentMission();
      const destination =
        destinations[mission.id];

      dragging = false;
      activeObject = null;

      if (
        destination &&
        pointInside(
          destination,
          event.clientX,
          event.clientY
        )
      ) {
        installPart(
          object,
          destination,
          mission.id
        );
        return;
      }

      returnDraggedObject(object);

      showWrong(
        object,
        "❌　↩️"
      );
    };

    viewport.addEventListener(
      "wheel",
      wheelHandler,
      { passive: false }
    );


    viewport.addEventListener(
      "click",
      clickHandler
    );

    viewport.addEventListener(
      "mousedown",
      downHandler
    );

    window.addEventListener(
      "mousemove",
      dragHandler,
      true
    );

    window.addEventListener(
      "mouseup",
      upHandler,
      true
    );

    removeWeek6MixedWheelListener = () => {
      viewport.removeEventListener(
        "wheel",
        wheelHandler
      );

      stopScrollSound();
    };


    removeWeek6MixedClickListener = () => {
      viewport.removeEventListener(
        "click",
        clickHandler
      );
    };

    removeWeek6MixedDownListener = () => {
      viewport.removeEventListener(
        "mousedown",
        downHandler
      );
    };

    removeWeek6MixedDragListener = () => {
      window.removeEventListener(
        "mousemove",
        dragHandler,
        true
      );
    };

    removeWeek6MixedUpListener = () => {
      window.removeEventListener(
        "mouseup",
        upHandler,
        true
      );
    };

    updatePartVisibility();
    updateScene();
    updateRobotPosition();
    loadMission();
  }
  let removeWeek6ScrollDragWheelListener = null;
  let removeWeek6ScrollDragDownListener = null;
  let removeWeek6ScrollDragMoveListener = null;
  let removeWeek6ScrollDragUpListener = null;

  let week6ScrollDragSound = null;
  let week6ScrollDragSoundTimer = null;
  let week6ScrollDragRoundTimer = null;

  function stopWeek6ScrollDragBehavior() {
    removeWeek6ScrollDragWheelListener?.();
    removeWeek6ScrollDragWheelListener = null;

    removeWeek6ScrollDragDownListener?.();
    removeWeek6ScrollDragDownListener = null;

    removeWeek6ScrollDragMoveListener?.();
    removeWeek6ScrollDragMoveListener = null;

    removeWeek6ScrollDragUpListener?.();
    removeWeek6ScrollDragUpListener = null;

    if (week6ScrollDragSoundTimer) {
      clearTimeout(
        week6ScrollDragSoundTimer
      );

      week6ScrollDragSoundTimer = null;
    }

    if (week6ScrollDragRoundTimer) {
      clearTimeout(
        week6ScrollDragRoundTimer
      );

      week6ScrollDragRoundTimer = null;
    }

    if (week6ScrollDragSound) {
      week6ScrollDragSound.pause();
      week6ScrollDragSound.currentTime = 0;
      week6ScrollDragSound.loop = false;
      week6ScrollDragSound = null;
    }
  }

  function startWeek6ScrollDragBehavior() {
    stopWeek6ScrollDragBehavior();

    const viewport =
      document.getElementById(
        "week6DeliveryViewport"
      );

    const scene =
      document.getElementById(
        "week6DeliveryScene"
      );

    const destination =
      document.getElementById(
        "week6DeliveryDestination"
      );

    const targetDisplay =
      document.getElementById(
        "week6DeliveryTarget"
      );

    const progress =
      document.getElementById(
        "week6DeliveryProgress"
      );

    const status =
      document.getElementById(
        "week6DeliveryStatus"
      );

    if (
      !viewport ||
      !scene ||
      !destination ||
      !targetDisplay ||
      !progress ||
      !status
    ) {
      return;
    }

    const rounds = [
      {
        id: "backpack",
        emoji: "🎒",
        name: "BACKPACK",
        destination: "🚌",
        destinationName: "BUS"
      },
      {
        id: "book",
        emoji: "📘",
        name: "BOOK",
        destination: "📚",
        destinationName: "BOOKSHELF"
      },
      {
        id: "apple",
        emoji: "🍎",
        name: "APPLE",
        destination: "🧺",
        destinationName: "BASKET"
      },
      {
        id: "ball",
        emoji: "⚽",
        name: "BALL",
        destination: "🥅",
        destinationName: "GOAL"
      }
    ];

    const MAX_SCROLL = 1450;
    /*
     * Guarantee every item requested by the
     * delivery challenge exists and is reachable.
     */
    const requiredDeliveryItems = [
      {
        id: "backpack",
        emoji: "🎒",
        top: 170,
        left: 28
      },
      {
        id: "book",
        emoji: "📘",
        top: 520,
        left: 35
      },
      {
        id: "apple",
        emoji: "🍎",
        top: 930,
        left: 30
      },
      {
        id: "ball",
        emoji: "⚽",
        top: 1380,
        left: 34
      }
    ];

    requiredDeliveryItems.forEach(
      itemInfo => {
        let item =
          scene.querySelector(
            `[data-week6-delivery="${itemInfo.id}"]`
          );

        if (!item) {
          item =
            document.createElement(
              "button"
            );

          item.type = "button";

          item.className =
            "week6-delivery-item";

          item.dataset.week6Delivery =
            itemInfo.id;

          item.textContent =
            itemInfo.emoji;

          scene.appendChild(item);
        }

        item.style.top =
          `${itemInfo.top}px`;

        item.style.left =
          `${itemInfo.left}%`;
      }
    );


    let scrollPosition = 500;
    let roundIndex = 0;
    let locked = false;
    let finished = false;

    let activeObject = null;
    let dragging = false;

    let offsetX = 0;
    let offsetY = 0;

    let originalParent = null;
    let originalNextSibling = null;

    function stopScrollSound() {
      if (week6ScrollDragSoundTimer) {
        clearTimeout(
          week6ScrollDragSoundTimer
        );

        week6ScrollDragSoundTimer = null;
      }

      if (week6ScrollDragSound) {
        week6ScrollDragSound.pause();
        week6ScrollDragSound.currentTime = 0;
        week6ScrollDragSound.loop = false;
        week6ScrollDragSound = null;
      }
    }

    function playScrollSound() {
      if (!soundEnabled) {
        return;
      }

      if (!week6ScrollDragSound) {
        week6ScrollDragSound =
          new Audio(
            "/sounds/scroll.mp3"
          );

        week6ScrollDragSound.volume = 0.4;
        week6ScrollDragSound.loop = true;

        week6ScrollDragSound
          .play()
          .catch(() => {});
      }

      if (week6ScrollDragSoundTimer) {
        clearTimeout(
          week6ScrollDragSoundTimer
        );
      }

      week6ScrollDragSoundTimer =
        setTimeout(
          stopScrollSound,
          180
        );
    }

    function playSound(src, volume) {
      if (!soundEnabled) {
        return;
      }

      const sound =
        new Audio(src);

      sound.volume = volume;
      sound.currentTime = 0;

      sound.play().catch(() => {});
    }

    function updateScene() {
      scene.style.transform =
        `translateY(-${scrollPosition}px)`;
    }

    function resetFloatingObject(object) {
      if (!object) {
        return;
      }

      object.classList.remove(
        "week6-delivery-held"
      );

      if (originalParent) {
        if (
          originalNextSibling &&
          originalNextSibling.parentNode ===
            originalParent
        ) {
          originalParent.insertBefore(
            object,
            originalNextSibling
          );
        } else {
          originalParent.appendChild(
            object
          );
        }
      }

      object.style.position = "";
      object.style.left = "";
      object.style.top = "";
      object.style.width = "";
      object.style.height = "";
      object.style.margin = "";
      object.style.transform = "";
      object.style.zIndex = "";

      originalParent = null;
      originalNextSibling = null;
    }

    function loadRound() {
      if (finished) {
        return;
      }

      locked = false;
      dragging = false;
      activeObject = null;

      const round =
        rounds[roundIndex];

      targetDisplay.innerHTML = `
        <span>${round.emoji}</span>
        <strong>${round.name}</strong>
      `;

      destination.innerHTML = `
        <span>${round.destination}</span>
        <strong>
          ${round.destinationName}
        </strong>
      `;

      progress.textContent =
        `${roundIndex + 1} of ${rounds.length}`;

      status.textContent =
        `Find the ${round.name}, then drag it to the ${round.destinationName}.`;

      scene
        .querySelectorAll(
          "[data-week6-delivery]"
        )
        .forEach(item => {
          item.classList.remove(
            "week6-delivery-correct",
            "week6-delivery-wrong"
          );

          item.style.display = "";
        });

      destination.classList.remove(
        "week6-delivery-destination-correct"
      );
    }

    function finishActivity() {
      finished = true;
      locked = true;
      dragging = false;

      stopScrollSound();

      status.textContent =
        "Delivery challenge complete!";

      const celebration =
        document.createElement("div");

      celebration.className =
        "week6-delivery-celebration";

      celebration.innerHTML = `
        <div class="week6-delivery-celebration-card">
          <div>🏆</div>
          <strong>
            DELIVERY COMPLETE!
          </strong>
          <span>
            Great scrolling and dragging!
          </span>
        </div>
      `;

      viewport.appendChild(
        celebration
      );

      requestAnimationFrame(() => {
        celebration.classList.add(
          "week6-delivery-celebration-show"
        );
      });

      playSound(
        "/sounds/correct.mp3",
        0.6
      );
    }

    function completeRound(object) {
      if (
        locked ||
        finished
      ) {
        return;
      }

      locked = true;
      dragging = false;

      destination.classList.add(
        "week6-delivery-destination-correct"
      );

      status.textContent =
        "Great delivery!";

      playSound(
        "/sounds/correct.mp3",
        0.55
      );

      object.remove();

      originalParent = null;
      originalNextSibling = null;

      week6ScrollDragRoundTimer =
        setTimeout(() => {
          if (!viewport.isConnected) {
            return;
          }

          roundIndex += 1;

          if (
            roundIndex >=
            rounds.length
          ) {
            finishActivity();
            return;
          }

          loadRound();
        }, 850);
    }

    function pointInsideDestination(
      x,
      y
    ) {
      const rect =
        destination.getBoundingClientRect();

      return (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      );
    }

    const wheelHandler =
      event => {
        if (
          locked ||
          finished ||
          dragging
        ) {
          event.preventDefault();
          return;
        }

        const rect =
          viewport.getBoundingClientRect();

        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          return;
        }

        event.preventDefault();

        playScrollSound();

        const amount =
          Math.min(
            Math.max(
              Math.abs(event.deltaY),
              22
            ),
            65
          );

        if (event.deltaY > 0) {
          scrollPosition =
            Math.min(
              scrollPosition + amount,
              MAX_SCROLL
            );
        } else if (event.deltaY < 0) {
          scrollPosition =
            Math.max(
              scrollPosition - amount,
              0
            );
        }

        status.textContent =
          "Keep searching...";

        updateScene();
      };

    const downHandler =
      event => {
        if (
          locked ||
          finished ||
          event.button !== 0
        ) {
          return;
        }

        const object =
          event.target.closest(
            "[data-week6-delivery]"
          );

        if (!object) {
          return;
        }

        const round =
          rounds[roundIndex];

        if (
          object.dataset.week6Delivery !==
          round.id
        ) {
          object.classList.add(
            "week6-delivery-wrong"
          );

          playSound(
            "/sounds/buzzer.mp3",
            0.55
          );

          status.textContent =
            `That's not the ${round.name}.`;

          setTimeout(() => {
            if (object.isConnected) {
              object.classList.remove(
                "week6-delivery-wrong"
              );
            }
          }, 350);

          return;
        }

        event.preventDefault();

        const rect =
          object.getBoundingClientRect();

        offsetX =
          event.clientX - rect.left;

        offsetY =
          event.clientY - rect.top;

        originalParent =
          object.parentNode;

        originalNextSibling =
          object.nextSibling;

        activeObject =
          object;

        dragging =
          true;

        object.style.position =
          "fixed";

        object.style.left =
          `${rect.left}px`;

        object.style.top =
          `${rect.top}px`;

        object.style.width =
          `${rect.width}px`;

        object.style.height =
          `${rect.height}px`;

        object.style.margin =
          "0";

        object.style.transform =
          "none";

        object.style.zIndex =
          "9999";

        object.classList.add(
          "week6-delivery-held"
        );

        document.body.appendChild(
          object
        );

        playSound(
          "/sounds/mouseclick.mp3",
          0.45
        );

        status.textContent =
          `Drag it to the ${round.destinationName}!`;
      };

    const moveHandler =
      event => {
        if (
          !dragging ||
          !activeObject
        ) {
          return;
        }

        event.preventDefault();

        activeObject.style.left =
          `${event.clientX - offsetX}px`;

        activeObject.style.top =
          `${event.clientY - offsetY}px`;
      };

    const upHandler =
      event => {
        if (
          !dragging ||
          !activeObject ||
          event.button !== 0
        ) {
          return;
        }

        const object =
          activeObject;

        dragging = false;
        activeObject = null;

        object.classList.remove(
          "week6-delivery-held"
        );

        if (
          pointInsideDestination(
            event.clientX,
            event.clientY
          )
        ) {
          completeRound(object);
          return;
        }

        object.classList.add(
          "week6-delivery-wrong"
        );

        playSound(
          "/sounds/buzzer.mp3",
          0.5
        );

        resetFloatingObject(
          object
        );

        status.textContent =
          "Try that drop again.";

        setTimeout(() => {
          if (object.isConnected) {
            object.classList.remove(
              "week6-delivery-wrong"
            );
          }
        }, 350);
      };

    viewport.addEventListener(
      "wheel",
      wheelHandler,
      {
        passive: false
      }
    );

    viewport.addEventListener(
      "mousedown",
      downHandler
    );

    window.addEventListener(
      "mousemove",
      moveHandler,
      true
    );

    window.addEventListener(
      "mouseup",
      upHandler,
      true
    );

    removeWeek6ScrollDragWheelListener =
      () => {
        viewport.removeEventListener(
          "wheel",
          wheelHandler
        );

        stopScrollSound();
      };

    removeWeek6ScrollDragDownListener =
      () => {
        viewport.removeEventListener(
          "mousedown",
          downHandler
        );
      };

    removeWeek6ScrollDragMoveListener =
      () => {
        window.removeEventListener(
          "mousemove",
          moveHandler,
          true
        );
      };

    removeWeek6ScrollDragUpListener =
      () => {
        window.removeEventListener(
          "mouseup",
          upHandler,
          true
        );
      };

    updateScene();
    loadRound();
  }

  function startWeek6ScrollClickBehavior() {
    stopWeek6ScrollClickBehavior();

    const viewport =
      document.getElementById(
        "week6TreasureViewport"
      );

    const scene =
      document.getElementById(
        "week6TreasureScene"
      );

    const targetDisplay =
      document.getElementById(
        "week6TreasureTarget"
      );

    const progress =
      document.getElementById(
        "week6TreasureProgress"
      );

    const status =
      document.getElementById(
        "week6TreasureStatus"
      );

    if (
      !viewport ||
      !scene ||
      !targetDisplay ||
      !progress ||
      !status
    ) {
      return;
    }

    const rounds = [
      {
        id: "key",
        emoji: "🔑",
        name: "KEY"
      },
      {
        id: "gem",
        emoji: "💎",
        name: "GEM"
      },
      {
        id: "map",
        emoji: "🗺️",
        name: "MAP"
      },
      {
        id: "crown",
        emoji: "👑",
        name: "CROWN"
      },
      {
        id: "chest",
        emoji: "🧰",
        name: "TREASURE CHEST"
      }
    ];

    const MAX_SCROLL = 1390;
    /*
     * Guarantee that every object used by the hunt
     * actually exists in the scrolling scene.
     */
    const requiredTargets = [
      {
        id: "key",
        emoji: "🔑",
        top: 160,
        left: 24
      },
      {
        id: "map",
        emoji: "🗺️",
        top: 500,
        left: 34
      },
      {
        id: "chest",
        emoji: "🧰",
        top: 860,
        left: 25
      },
      {
        id: "gem",
        emoji: "💎",
        top: 1220,
        left: 32
      },
      {
        id: "crown",
        emoji: "👑",
        top: 1540,
        left: 28
      }
    ];

    requiredTargets.forEach(
      targetInfo => {
        let item =
          scene.querySelector(
            `[data-week6-treasure="${targetInfo.id}"]`
          );

        if (!item) {
          item =
            document.createElement(
              "button"
            );

          item.type =
            "button";

          item.className =
            "week6-treasure-item";

          item.dataset.week6Treasure =
            targetInfo.id;

          item.textContent =
            targetInfo.emoji;

          scene.appendChild(
            item
          );
        }

        /*
         * Also force every required target to a
         * known reachable location.
         */
        item.style.top =
          `${targetInfo.top}px`;

        item.style.left =
          `${targetInfo.left}%`;
      }
    );


    let scrollPosition = 430;
    let roundIndex = 0;
    let locked = false;
    let finished = false;

    function stopScrollSound() {
      if (week6ScrollClickSoundTimer) {
        clearTimeout(
          week6ScrollClickSoundTimer
        );

        week6ScrollClickSoundTimer = null;
      }

      if (week6ScrollClickSound) {
        week6ScrollClickSound.pause();
        week6ScrollClickSound.currentTime = 0;
        week6ScrollClickSound.loop = false;
        week6ScrollClickSound = null;
      }
    }

    function playScrollSound() {
      if (!soundEnabled) {
        return;
      }

      if (!week6ScrollClickSound) {
        week6ScrollClickSound =
          new Audio(
            "/sounds/scroll.mp3"
          );

        week6ScrollClickSound.volume = 0.4;
        week6ScrollClickSound.loop = true;

        week6ScrollClickSound
          .play()
          .catch(() => {});
      }

      if (week6ScrollClickSoundTimer) {
        clearTimeout(
          week6ScrollClickSoundTimer
        );
      }

      week6ScrollClickSoundTimer =
        setTimeout(
          stopScrollSound,
          180
        );
    }

    function playSound(src, volume) {
      if (!soundEnabled) {
        return;
      }

      const sound =
        new Audio(src);

      sound.volume = volume;
      sound.currentTime = 0;

      sound.play().catch(() => {});
    }

    function updateScene() {
      scene.style.transform =
        `translateY(-${scrollPosition}px)`;
    }

    function loadRound() {
      if (finished) {
        return;
      }

      locked = false;

      const round =
        rounds[roundIndex];

      targetDisplay.innerHTML = `
        <span>${round.emoji}</span>
        <strong>${round.name}</strong>
      `;

      progress.textContent =
        `${roundIndex + 1} of ${rounds.length}`;

      status.textContent =
        `Find and LEFT-CLICK the ${round.name}.`;

      scene
        .querySelectorAll(
          "[data-week6-treasure]"
        )
        .forEach(item => {
          item.classList.remove(
            "week6-treasure-correct",
            "week6-treasure-wrong"
          );
        });
    }

    function finishActivity() {
      finished = true;
      locked = true;

      stopScrollSound();

      status.textContent =
        "Treasure hunt complete!";

      const celebration =
        document.createElement("div");

      celebration.className =
        "week6-treasure-celebration";

      celebration.innerHTML = `
        <div class="week6-treasure-celebration-card">
          <div>🏆</div>
          <strong>TREASURE HUNT COMPLETE!</strong>
          <span>Great scrolling and clicking!</span>
        </div>
      `;

      viewport.appendChild(
        celebration
      );

      requestAnimationFrame(() => {
        celebration.classList.add(
          "week6-treasure-celebration-show"
        );
      });

      playSound(
        "/sounds/correct.mp3",
        0.6
      );
    }

    function completeRound(item) {
      if (
        locked ||
        finished
      ) {
        return;
      }

      locked = true;
      stopScrollSound();

      item.classList.add(
        "week6-treasure-correct"
      );

      status.textContent =
        "You found it!";

      playSound(
        "/sounds/correct.mp3",
        0.55
      );

      week6ScrollClickRoundTimer =
        setTimeout(() => {
          if (!viewport.isConnected) {
            return;
          }

          roundIndex += 1;

          if (
            roundIndex >=
            rounds.length
          ) {
            finishActivity();
            return;
          }

          loadRound();
        }, 800);
    }

    const wheelHandler =
      event => {
        if (
          locked ||
          finished
        ) {
          event.preventDefault();
          return;
        }

        const rect =
          viewport.getBoundingClientRect();

        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          return;
        }

        event.preventDefault();

        playScrollSound();

        const amount =
          Math.min(
            Math.max(
              Math.abs(event.deltaY),
              22
            ),
            65
          );

        if (event.deltaY > 0) {
          scrollPosition =
            Math.min(
              scrollPosition + amount,
              MAX_SCROLL
            );
        } else if (event.deltaY < 0) {
          scrollPosition =
            Math.max(
              scrollPosition - amount,
              0
            );
        }

        status.textContent =
          "Keep searching...";

        updateScene();
      };

    const clickHandler =
      event => {
        if (
          locked ||
          finished
        ) {
          return;
        }

        const item =
          event.target.closest(
            "[data-week6-treasure]"
          );

        if (!item) {
          return;
        }

        playSound(
          "/sounds/mouseclick.mp3",
          0.45
        );

        const round =
          rounds[roundIndex];

        if (
          item.dataset.week6Treasure ===
          round.id
        ) {
          completeRound(item);
          return;
        }

        item.classList.add(
          "week6-treasure-wrong"
        );

        playSound(
          "/sounds/buzzer.mp3",
          0.55
        );

        status.textContent =
          `That's not the ${round.name}. Keep looking!`;

        setTimeout(() => {
          if (item.isConnected) {
            item.classList.remove(
              "week6-treasure-wrong"
            );
          }
        }, 350);
      };

    viewport.addEventListener(
      "wheel",
      wheelHandler,
      {
        passive: false
      }
    );

    viewport.addEventListener(
      "click",
      clickHandler
    );

    removeWeek6ScrollClickWheelListener =
      () => {
        viewport.removeEventListener(
          "wheel",
          wheelHandler
        );

        stopScrollSound();
      };

    removeWeek6ScrollClickClickListener =
      () => {
        viewport.removeEventListener(
          "click",
          clickHandler
        );
      };

    updateScene();
    loadRound();
  }

  function startWeek6PrecisionBehavior() {
    stopWeek6PrecisionBehavior();

    const area =
      document.getElementById(
        "week6PrecisionArea"
      );

    const rocket =
      document.getElementById(
        "week6PrecisionRocket"
      );

    const target =
      document.getElementById(
        "week6PrecisionTarget"
      );

    const targetLabel =
      document.getElementById(
        "week6PrecisionTargetLabel"
      );

    
    const targetBand =
      document.getElementById(
        "week6PrecisionBand"
      );
const status =
      document.getElementById(
        "week6PrecisionStatus"
      );

    const progress =
      document.getElementById(
        "week6PrecisionProgress"
      );

    if (
      !area ||
      !rocket ||
      !target ||
      !targetLabel ||
      !status ||
      !progress
    ) {
      return;
    }

    const MIN_Y = 48;
    const MAX_Y = 292;

    const rounds = [
      {
        start: 270,
        target: 82,
        tolerance: 25,
        label: "LANDING ZONE"
      },
      {
        start: 72,
        target: 245,
        tolerance: 20,
        label: "SMALL ZONE"
      },
      {
        start: 260,
        target: 145,
        tolerance: 16,
        label: "TINY ZONE"
      },
      {
        start: 82,
        target: 205,
        tolerance: 12,
        label: "PRECISION ZONE"
      }
    ];

    let rocketY = 0;
    let roundIndex = 0;
    let locked = false;
    let finished = false;

    function stopScrollSound() {
      if (week6PrecisionSoundTimer) {
        clearTimeout(
          week6PrecisionSoundTimer
        );

        week6PrecisionSoundTimer = null;
      }

      if (week6PrecisionScrollSound) {
        week6PrecisionScrollSound.pause();
        week6PrecisionScrollSound.currentTime = 0;
        week6PrecisionScrollSound.loop = false;
        week6PrecisionScrollSound = null;
      }
    }

    function playScrollSound() {
      if (!soundEnabled) {
        return;
      }

      if (!week6PrecisionScrollSound) {
        week6PrecisionScrollSound =
          new Audio(
            "/sounds/scroll.mp3"
          );

        week6PrecisionScrollSound.volume = 0.4;
        week6PrecisionScrollSound.loop = true;

        week6PrecisionScrollSound
          .play()
          .catch(() => {});
      }

      if (week6PrecisionSoundTimer) {
        clearTimeout(
          week6PrecisionSoundTimer
        );
      }

      week6PrecisionSoundTimer =
        setTimeout(
          stopScrollSound,
          180
        );
    }

    function playCorrect() {
      if (!soundEnabled) {
        return;
      }

      const sound =
        new Audio(
          "/sounds/correct.mp3"
        );

      sound.volume = 0.55;
      sound.currentTime = 0;

      sound.play().catch(() => {});
    }

    function updateRocket() {
      rocket.style.top =
        `${rocketY}px`;
    }

    function loadRound() {
      if (finished) {
        return;
      }

      locked = false;

      const round =
        rounds[roundIndex];

      rocketY =
        round.start;

      rocket.style.top =
        `${round.start}px`;

      target.style.top =
        `${round.target}px`;

      /*
       * The visible target gets smaller as
       * precision requirements increase.
       */
      const bandHeights = [
        70,
        48,
        28,
        12
      ];

      target.style.height =
        "96px";

      targetBand.style.height =
        `${bandHeights[roundIndex]}px`;

      targetLabel.textContent =
        round.label;

      progress.textContent =
        `${roundIndex + 1} of ${rounds.length}`;

      status.textContent =
        "Scroll the rocket into the landing zone, then STOP.";

      rocket.classList.remove(
        "week6-precision-rocket-correct"
      );

      target.classList.remove(
        "week6-precision-target-correct"
      );
    }

    function finishActivity() {
      finished = true;
      locked = true;

      stopScrollSound();

      status.textContent =
        "Precision scrolling complete!";

      const celebration =
        document.createElement("div");

      celebration.className =
        "week6-precision-celebration";

      celebration.innerHTML = `
        <div class="week6-precision-celebration-card">
          <div>🚀⭐</div>
          <strong>
            PRECISION COMPLETE!
          </strong>
          <span>
            Amazing scroll control!
          </span>
        </div>
      `;

      area.appendChild(
        celebration
      );

      requestAnimationFrame(() => {
        celebration.classList.add(
          "week6-precision-celebration-show"
        );
      });

      playCorrect();
    }

    function completeRound() {
      if (
        locked ||
        finished
      ) {
        return;
      }

      locked = true;
      stopScrollSound();

      rocket.classList.add(
        "week6-precision-rocket-correct"
      );

      target.classList.add(
        "week6-precision-target-correct"
      );

      status.textContent =
        "Perfect landing!";

      playCorrect();

      week6PrecisionRoundTimer =
        setTimeout(() => {
          if (!area.isConnected) {
            return;
          }

          roundIndex += 1;

          if (
            roundIndex >=
            rounds.length
          ) {
            finishActivity();
            return;
          }

          loadRound();
        }, 850);
    }

    function scheduleStopCheck() {
      if (week6PrecisionStopTimer) {
        clearTimeout(
          week6PrecisionStopTimer
        );
      }

      week6PrecisionStopTimer =
        setTimeout(() => {
          if (
            locked ||
            finished ||
            !area.isConnected
          ) {
            return;
          }

          const round =
            rounds[roundIndex];

          const distance =
            Math.abs(
              rocketY -
              round.target
            );

          if (
            distance <=
            round.tolerance
          ) {
            completeRound();
            return;
          }

          status.textContent =
            rocketY < round.target
              ? "A little lower..."
              : "A little higher...";
        }, 300);
    }

    const wheelHandler =
      event => {
        if (
          locked ||
          finished
        ) {
          event.preventDefault();
          return;
        }

        const rect =
          area.getBoundingClientRect();

        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          return;
        }

        event.preventDefault();

        playScrollSound();

        /*
         * Smaller movement than Step 2.
         * This is the precision lesson.
         */
        const amount =
          Math.min(
            Math.max(
              Math.abs(event.deltaY) * 0.2,
              5
            ),
            14
          );

        if (event.deltaY > 0) {
          rocketY =
            Math.min(
              rocketY + amount,
              MAX_Y
            );

          status.textContent =
            "Moving DOWN...";
        } else if (event.deltaY < 0) {
          rocketY =
            Math.max(
              rocketY - amount,
              MIN_Y
            );

          status.textContent =
            "Moving UP...";
        }

        updateRocket();
        scheduleStopCheck();
      };

    area.addEventListener(
      "wheel",
      wheelHandler,
      {
        passive: false
      }
    );

    removeWeek6PrecisionWheelListener =
      () => {
        area.removeEventListener(
          "wheel",
          wheelHandler
        );

        stopScrollSound();
      };

    loadRound();
  }


  function startWeek6WarmUpBehavior() {
    stopWeek6WarmUpBehavior();

    const area =
      document.getElementById(
        "week6WarmUpArea"
      );

    const ball =
      document.getElementById(
        "week6WarmUpBall"
      );

    const topTarget =
      document.getElementById(
        "week6WarmUpTopTarget"
      );

    const bottomTarget =
      document.getElementById(
        "week6WarmUpBottomTarget"
      );

    const instruction =
      document.getElementById(
        "week6WarmUpInstruction"
      );

    const status =
      document.getElementById(
        "week6WarmUpStatus"
      );

    const progress =
      document.getElementById(
        "week6WarmUpProgress"
      );

    if (
      !area ||
      !ball ||
      !topTarget ||
      !bottomTarget ||
      !instruction ||
      !status ||
      !progress
    ) {
      console.warn(
        "Week 6 warm-up elements missing."
      );

      return;
    }

    const TOP_Y = 62;
    const BOTTOM_Y = 278;
    const TOLERANCE = 20;

    const rounds = [
      {
        target: "bottom",
        label: "BOTTOM",
        arrow: "↓"
      },
      {
        target: "top",
        label: "TOP",
        arrow: "↑"
      },
      {
        target: "bottom",
        label: "BOTTOM",
        arrow: "↓"
      },
      {
        target: "top",
        label: "TOP",
        arrow: "↑"
      }
    ];

    let ballY = 165;
    let roundIndex = 0;
    let locked = false;
    let finished = false;


    function stopScrollSound() {
      if (week6WarmUpScrollSoundTimer) {
        clearTimeout(
          week6WarmUpScrollSoundTimer
        );

        week6WarmUpScrollSoundTimer = null;
      }

      if (week6WarmUpScrollSound) {
        week6WarmUpScrollSound.pause();
        week6WarmUpScrollSound.currentTime = 0;
        week6WarmUpScrollSound.loop = false;
        week6WarmUpScrollSound = null;
      }
    }


    function playScrollSound() {
      if (!soundEnabled) {
        return;
      }

      if (!week6WarmUpScrollSound) {
        week6WarmUpScrollSound =
          new Audio(
            "/sounds/scroll.mp3"
          );

        week6WarmUpScrollSound.volume = 0.42;
        week6WarmUpScrollSound.loop = true;

        week6WarmUpScrollSound
          .play()
          .catch(() => {});
      }

      if (week6WarmUpScrollSoundTimer) {
        clearTimeout(
          week6WarmUpScrollSoundTimer
        );
      }

      week6WarmUpScrollSoundTimer =
        setTimeout(
          stopScrollSound,
          180
        );
    }


    function playCorrect() {
      if (!soundEnabled) {
        return;
      }

      const sound =
        new Audio(
          "/sounds/correct.mp3"
        );

      sound.volume = 0.55;
      sound.currentTime = 0;

      sound
        .play()
        .catch(() => {});
    }


    function updateBall() {
      ball.style.top =
        `${ballY}px`;
    }


    function loadRound() {
      if (finished) {
        return;
      }

      locked = false;

      const round =
        rounds[roundIndex];

      instruction.innerHTML = `
        <span>${round.arrow}</span>
        <strong>
          SCROLL TO THE ${round.label}
        </strong>
      `;

      progress.textContent =
        `${roundIndex + 1} of ${rounds.length}`;

      status.textContent =
        `Scroll to the ${round.label}, then STOP.`;

      topTarget.classList.toggle(
        "week6-warm-up-target-active",
        round.target === "top"
      );

      bottomTarget.classList.toggle(
        "week6-warm-up-target-active",
        round.target === "bottom"
      );
    }


    function finishActivity() {
      finished = true;
      locked = true;

      stopScrollSound();

      status.textContent =
        "Great scrolling!";

      const celebration =
        document.createElement("div");

      celebration.className =
        "week6-warm-up-celebration";

      celebration.innerHTML = `
        <div class="week6-warm-up-celebration-card">
          <div>⭐</div>
          <strong>
            WARM-UP COMPLETE!
          </strong>
          <span>
            Great up-and-down scrolling!
          </span>
        </div>
      `;

      area.appendChild(
        celebration
      );

      requestAnimationFrame(() => {
        celebration.classList.add(
          "week6-warm-up-celebration-show"
        );
      });

      playCorrect();
    }


    function completeRound() {
      if (
        locked ||
        finished
      ) {
        return;
      }

      locked = true;

      stopScrollSound();

      const round =
        rounds[roundIndex];

      const target =
        round.target === "top"
          ? topTarget
          : bottomTarget;

      target.classList.add(
        "week6-warm-up-target-correct"
      );

      ball.classList.add(
        "week6-warm-up-ball-correct"
      );

      status.textContent =
        "Perfect stop!";

      playCorrect();

      week6WarmUpRoundTimer =
        setTimeout(() => {
          if (!area.isConnected) {
            return;
          }

          target.classList.remove(
            "week6-warm-up-target-correct"
          );

          ball.classList.remove(
            "week6-warm-up-ball-correct"
          );

          roundIndex += 1;

          if (
            roundIndex >=
            rounds.length
          ) {
            finishActivity();
            return;
          }

          loadRound();
        }, 750);
    }


    function scheduleStopCheck() {
      if (week6WarmUpStopTimer) {
        clearTimeout(
          week6WarmUpStopTimer
        );
      }

      week6WarmUpStopTimer =
        setTimeout(() => {
          if (
            locked ||
            finished ||
            !area.isConnected
          ) {
            return;
          }

          const round =
            rounds[roundIndex];

          const targetY =
            round.target === "top"
              ? TOP_Y
              : BOTTOM_Y;

          if (
            Math.abs(
              ballY - targetY
            ) <= TOLERANCE
          ) {
            completeRound();
          }
        }, 260);
    }


    const wheelHandler =
      event => {
        if (
          locked ||
          finished
        ) {
          event.preventDefault();
          return;
        }

        const rect =
          area.getBoundingClientRect();

        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          return;
        }

        event.preventDefault();

        playScrollSound();

        const amount =
          Math.min(
            Math.max(
              Math.abs(event.deltaY) * 0.3,
              8
            ),
            22
          );

        if (event.deltaY > 0) {
          ballY =
            Math.min(
              ballY + amount,
              BOTTOM_Y
            );

          status.textContent =
            "Scrolling DOWN...";
        } else if (event.deltaY < 0) {
          ballY =
            Math.max(
              ballY - amount,
              TOP_Y
            );

          status.textContent =
            "Scrolling UP...";
        }

        updateBall();
        scheduleStopCheck();
      };


    area.addEventListener(
      "wheel",
      wheelHandler,
      {
        passive: false
      }
    );

    removeWeek6WarmUpWheelListener =
      () => {
        area.removeEventListener(
          "wheel",
          wheelHandler
        );

        stopScrollSound();
      };

    updateBall();
    loadRound();
  }


  function startWeek5QuickReviewAnimation() {
    stopWeek5QuickReviewAnimation();

    let activeReviewSounds = [];

    function playReviewSound(src, volume = 0.5, startTime = 0) {
      /*
       * Never allow an old Step 1 timer to start
       * another sound after this slide is gone.
       */
      if (
        !soundEnabled ||
        !screen.isConnected
      ) {
        return null;
      }

      const sound =
        new Audio(src);

      sound.volume = volume;
      sound.currentTime = startTime;

      activeReviewSounds.push(sound);
      week5ReviewActiveSounds.push(sound);

      sound
        .play()
        .catch(() => {});

      sound.addEventListener(
        "ended",
        () => {
          activeReviewSounds =
            activeReviewSounds.filter(
              item => item !== sound
            );

          week5ReviewActiveSounds =
            week5ReviewActiveSounds.filter(
              item => item !== sound
            );
        },
        { once: true }
      );

      return sound;
    }

    function stopReviewSounds() {
      activeReviewSounds.forEach(
        sound => {
          sound.pause();
          sound.currentTime = 0;
        }
      );

      activeReviewSounds = [];
    }

    window.week5StopReviewSounds =
      stopReviewSounds;

    const screen =
      document.querySelector(
        ".lesson-screen-week5-quick-review"
      );

    if (!screen) {
      return;
    }

    const pointer =
      document.getElementById(
        "week5ReviewPointer"
      );

    const mouse =
      document.getElementById(
        "week5ReviewMouse"
      );

    const leftButton =
      document.getElementById(
        "week5ReviewLeftButton"
      );

    const object =
      document.getElementById(
        "week5ReviewObject"
      );

    const destination =
      document.getElementById(
        "week5ReviewDestination"
      );

    const message =
      document.getElementById(
        "week5ReviewMessage"
      );

    const cards =
      Array.from(
        screen.querySelectorAll(
          "[data-week5-review-step]"
        )
      );

    if (
      !pointer ||
      !mouse ||
      !leftButton ||
      !object ||
      !destination ||
      !message ||
      cards.length !== 5
    ) {
      return;
    }

    function setActive(name) {
      cards.forEach((card) => {
        card.classList.toggle(
          "week5-review-step-active",
          card.dataset.week5ReviewStep ===
            name
        );
      });
    }

    function resetVisuals() {
      pointer.className =
        "week5-visual-review-pointer";

      object.className =
        "week5-visual-review-object";

      destination.className =
        "week5-visual-review-destination";

      leftButton.classList.remove(
        "week5-visual-review-button-down"
      );
    }

    function startSequence() {
      /*
       * Step 1 loops while it is being displayed.
       * The moment its screen is removed, the loop dies.
       */
      if (!screen.isConnected) {
        stopReviewSounds();
        return;
      }

      resetVisuals();

      /*
       * MOVE
       *
       * Start away from the star, pause briefly,
       * then travel onto it.
       */
      setActive("move");

      message.textContent =
        "MOVE the mouse.";

      void pointer.offsetWidth;

      week5ReviewTimers.push(
        setTimeout(() => {
          pointer.classList.add(
            "week5-visual-review-pointer-move"
          );
        }, 300)
      );

      week5ReviewTimers.push(
        setTimeout(() => {

          /*
           * CLICK
           */
          setActive("click");

          message.textContent =
            "CLICK the star.";

          leftButton.classList.add(
            "week5-visual-review-button-down"
          );

          pointer.classList.add(
            "week5-visual-review-pointer-click"
          );

          object.classList.add(
            "week5-visual-review-object-clicked"
          );

          playReviewSound(
            "/sounds/mouseclick.mp3",
            0.5,
            0.12
          );

        }, 1750)
      );

      week5ReviewTimers.push(
        setTimeout(() => {

          /*
           * HOLD
           */
          setActive("hold");

          message.textContent =
            "PRESS and HOLD.";

          pointer.classList.remove(
            "week5-visual-review-pointer-click"
          );

          object.classList.remove(
            "week5-visual-review-object-clicked"
          );

          object.classList.add(
            "week5-visual-review-object-held"
          );

        }, 2950)
      );

      week5ReviewTimers.push(
        setTimeout(() => {

          /*
           * DRAG
           */
          setActive("drag");

          message.textContent =
            "DRAG while holding.";

          /*
           * Pointer and star travel together.
           */
          pointer.classList.add(
            "week5-visual-review-pointer-drag"
          );

          object.classList.add(
            "week5-visual-review-object-drag"
          );

          destination.classList.add(
            "week5-visual-review-destination-ready"
          );

        }, 4150)
      );

      week5ReviewTimers.push(
        setTimeout(() => {

          /*
           * LET GO
           */
          setActive("release");

          message.textContent =
            "LET GO.";

          leftButton.classList.remove(
            "week5-visual-review-button-down"
          );

          object.classList.remove(
            "week5-visual-review-object-held"
          );

          object.classList.add(
            "week5-visual-review-object-dropped"
          );

          destination.classList.add(
            "week5-visual-review-destination-complete"
          );

          playReviewSound(
            "/sounds/correct.mp3",
            0.55,
            0
          );

        }, 5750)
      );

      week5ReviewTimers.push(
        setTimeout(
          startSequence,
          7900
        )
      );
    }

    startSequence();
  }

  function startWeek4QuickReviewAnimation() {
    stopWeek4QuickReviewAnimation();

    const screen =
      document.querySelector(
        ".lesson-screen-week4-quick-review"
      );

    if (!screen) {
      return;
    }

    const pointer =
      document.getElementById("week4ReviewPointer");

    const object =
      document.getElementById("week4ReviewObject");

    const destination =
      document.getElementById("week4ReviewDestination");

    const hand =
      document.getElementById("week4ReviewHand");

    const finger =
      document.getElementById("week4ReviewFinger");

    const leftButton =
      document.getElementById("week4ReviewLeftButton");

    const message =
      document.getElementById("week4ReviewMessage");

    const cards =
      Array.from(
        screen.querySelectorAll(
          "[data-week4-drag-step]"
        )
      );

    if (
      !pointer ||
      !object ||
      !destination ||
      !hand ||
      !finger ||
      !leftButton ||
      !message ||
      cards.length !== 5
    ) {
      return;
    }

    function activeStep(name) {
      cards.forEach((card) => {
        card.classList.toggle(
          "week4-review-step-active",
          card.dataset.week4DragStep === name
        );
      });
    }

    function swish() {
      playWeek3DemoSound(
        "/sounds/swish.mp3",
        0.42
      );
    }

    function click() {
      playWeek3DemoSound(
        "/sounds/mouseclick.mp3",
        0.5
      );
    }

    function resetDemo() {
      stopWeek4QuickReviewAnimation();

      pointer.className =
        "week4-review-pointer";

      object.className =
        "week4-review-object";

      destination.classList.remove(
        "week4-review-destination-ready",
        "week4-review-destination-complete"
      );

      hand.classList.remove(
        "week4-review-hand-held"
      );

      finger.classList.remove(
        "week4-review-finger-held"
      );

      leftButton.classList.remove(
        "week4-review-button-held"
      );

      activeStep("point");

      message.textContent =
        "POINT to the object.";

      void pointer.offsetWidth;
      void object.offsetWidth;

      pointer.classList.add(
        "week4-review-pointer-point"
      );

      swish();

      week4QuickReviewTimers.push(
        setTimeout(
          pressStep,
          1150
        )
      );
    }

    function pressStep() {
      activeStep("press");

      hand.classList.add(
        "week4-review-hand-held"
      );

      finger.classList.add(
        "week4-review-finger-held"
      );

      leftButton.classList.add(
        "week4-review-button-held"
      );

      object.classList.add(
        "week4-review-object-held"
      );

      message.textContent =
        "PRESS the left button.";

      click();

      week4QuickReviewTimers.push(
        setTimeout(
          holdStep,
          850
        )
      );
    }

    function holdStep() {
      activeStep("hold");

      message.textContent =
        "HOLD the button down.";

      week4QuickReviewTimers.push(
        setTimeout(
          moveStep,
          850
        )
      );
    }

    function moveStep() {
      activeStep("move");

      pointer.classList.add(
        "week4-review-pointer-move"
      );

      object.classList.add(
        "week4-review-object-move"
      );

      destination.classList.add(
        "week4-review-destination-ready"
      );

      message.textContent =
        "MOVE while you keep holding.";

      swish();

      week4QuickReviewTimers.push(
        setTimeout(
          releaseStep,
          1350
        )
      );
    }

    function releaseStep() {
      activeStep("release");

      hand.classList.remove(
        "week4-review-hand-held"
      );

      finger.classList.remove(
        "week4-review-finger-held"
      );

      leftButton.classList.remove(
        "week4-review-button-held"
      );

      object.classList.remove(
        "week4-review-object-held"
      );

      object.classList.add(
        "week4-review-object-dropped"
      );

      destination.classList.remove(
        "week4-review-destination-ready"
      );

      destination.classList.add(
        "week4-review-destination-complete"
      );

      message.textContent =
        "LET GO when you get there.";

      week4QuickReviewTimers.push(
        setTimeout(
          resetDemo,
          1450
        )
      );
    }

    resetDemo();
  }

  function startMeetDragAnimation() {
    stopMeetDragAnimation();

    const screen =
      document.querySelector(
        ".lesson-screen-meet-drag"
      );

    if (!screen) {
      return;
    }

    const pointer =
      document.getElementById(
        "meetDragPointer"
      );

    const object =
      document.getElementById(
        "meetDragObject"
      );

    const hand =
      document.getElementById(
        "meetDragHand"
      );

    const finger =
      document.getElementById(
        "meetDragFinger"
      );

    const leftButton =
      document.getElementById(
        "meetDragLeftButton"
      );

    const message =
      document.getElementById(
        "meetDragHandMessage"
      );

    const stepItems =
      Array.from(
        screen.querySelectorAll(
          "[data-drag-demo-step]"
        )
      );

    if (
      !pointer ||
      !object ||
      !hand ||
      !finger ||
      !leftButton ||
      !message
    ) {
      return;
    }

    function setActiveStep(name) {
      stepItems.forEach((item) => {
        item.classList.toggle(
          "meet-drag-step-active",
          item.dataset.dragDemoStep === name
        );
      });
    }

    function playSwish() {
      playWeek3DemoSound(
        "/sounds/swish.mp3",
        0.45
      );
    }

    function playClick() {
      playWeek3DemoSound(
        "/sounds/mouseclick.mp3",
        0.5
      );
    }

    function resetDemo() {
      pointer.className =
        "meet-drag-pointer";

      object.className =
        "meet-drag-object";

      hand.classList.remove(
        "meet-drag-hand-held"
      );

      finger.classList.remove(
        "meet-drag-finger-held"
      );

      leftButton.classList.remove(
        "meet-drag-button-held"
      );

      message.textContent =
        "POINT to the object.";

      setActiveStep("point");

      void pointer.offsetWidth;
      void object.offsetWidth;

      pointer.classList.add(
        "meet-drag-pointer-point"
      );

      playSwish();

      meetDragAnimationTimers.push(
        setTimeout(
          pressAndHold,
          1800
        )
      );
    }

    function pressAndHold() {
      setActiveStep("hold");

      hand.classList.add(
        "meet-drag-hand-held"
      );

      finger.classList.add(
        "meet-drag-finger-held"
      );

      leftButton.classList.add(
        "meet-drag-button-held"
      );

      object.classList.add(
        "meet-drag-object-held"
      );

      message.textContent =
        "PRESS and KEEP HOLDING.";

      playClick();

      meetDragAnimationTimers.push(
        setTimeout(
          moveWhileHolding,
          1500
        )
      );
    }

    function moveWhileHolding() {
      setActiveStep("move");

      pointer.classList.add(
        "meet-drag-pointer-move"
      );

      object.classList.add(
        "meet-drag-object-move"
      );

      message.textContent =
        "Keep holding while you MOVE.";

      playSwish();

      meetDragAnimationTimers.push(
        setTimeout(
          releaseObject,
          2100
        )
      );
    }

    function releaseObject() {
      setActiveStep("release");

      hand.classList.remove(
        "meet-drag-hand-held"
      );

      finger.classList.remove(
        "meet-drag-finger-held"
      );

      leftButton.classList.remove(
        "meet-drag-button-held"
      );

      object.classList.remove(
        "meet-drag-object-held"
      );

      object.classList.add(
        "meet-drag-object-dropped"
      );

      message.textContent =
        "LET GO when you get there.";

      meetDragAnimationTimers.push(
        setTimeout(
          resetDemo,
          2600
        )
      );
    }

    resetDemo();
  }

  function startDragQuickReviewAnimation() {
    stopDragQuickReviewAnimation();

    const screen =
      document.querySelector(
        ".lesson-screen-drag-review"
      );

    if (!screen) {
      return;
    }

    const cards =
      Array.from(
        screen.querySelectorAll(
          ".drag-review-card"
        )
      );

    if (cards.length !== 3) {
      return;
    }

    const moveDemo =
      screen.querySelector(
        ".drag-review-move-demo"
      );

    const clickDemo =
      screen.querySelector(
        ".drag-review-click-demo"
      );

    const clickHand =
      screen.querySelector(
        ".drag-review-click-hand"
      );

    const clickFinger =
      screen.querySelector(
        ".drag-review-pointer-finger"
      );

    const leftButton =
      screen.querySelector(
        ".drag-review-left-button"
      );

    function clearStates() {
      cards.forEach((card) => {
        card.classList.remove(
          "drag-review-active",
          "drag-review-done"
        );
      });

      moveDemo?.classList.remove(
        "drag-review-move-playing"
      );

      clickDemo?.classList.remove(
        "drag-review-click-playing"
      );

      clickHand?.classList.remove(
        "drag-review-hand-click"
      );

      clickFinger?.classList.remove(
        "drag-review-finger-click"
      );

      leftButton?.classList.remove(
        "drag-review-button-click"
      );
    }

    function playSwish() {
      playWeek3DemoSound(
        "/sounds/swish.mp3",
        0.5
      );
    }

    function playClick() {
      playWeek3DemoSound(
        "/sounds/mouseclick.mp3",
        0.5
      );
    }

    function showCard1() {
      clearStates();

      cards[0].classList.add(
        "drag-review-active"
      );

      dragReviewAnimationTimers.push(
        setTimeout(showCard2, 2200)
      );
    }

    function showCard2() {
      cards[0].classList.remove(
        "drag-review-active"
      );

      cards[0].classList.add(
        "drag-review-done"
      );

      cards[1].classList.add(
        "drag-review-active"
      );

      moveDemo?.classList.add(
        "drag-review-move-playing"
      );

      playSwish();

      dragReviewAnimationTimers.push(
        setTimeout(showCard3, 2600)
      );
    }

    function showCard3() {
      cards[1].classList.remove(
        "drag-review-active"
      );

      cards[1].classList.add(
        "drag-review-done"
      );

      cards[2].classList.add(
        "drag-review-active"
      );

      clickDemo?.classList.add(
        "drag-review-click-playing"
      );

      /*
       * Give the hand a moment to appear,
       * then visibly press the left button.
       */
      dragReviewAnimationTimers.push(
        setTimeout(() => {
          clickHand?.classList.add(
            "drag-review-hand-click"
          );

          clickFinger?.classList.add(
            "drag-review-finger-click"
          );

          leftButton?.classList.add(
            "drag-review-button-click"
          );

          playClick();
        }, 600)
      );

      dragReviewAnimationTimers.push(
        setTimeout(() => {
          clickHand?.classList.remove(
            "drag-review-hand-click"
          );

          clickFinger?.classList.remove(
            "drag-review-finger-click"
          );

          leftButton?.classList.remove(
            "drag-review-button-click"
          );
        }, 1050)
      );

      /*
       * Pause on Card 3, then loop the
       * short review again.
       */
      dragReviewAnimationTimers.push(
        setTimeout(showCard1, 3300)
      );
    }

    showCard1();
  }

  function week3ImmediateNavigationStop(event) {
    const step1Active =
      document.querySelector(
        ".lesson-screen-drag-review"
      );

    const step2Active =
      document.querySelector(
        ".lesson-screen-meet-drag"
      );

    if (!step1Active && !step2Active) {
      return;
    }

    const control =
      event.target.closest("button, a");

    if (!control) {
      return;
    }

    const label =
      (control.textContent || "")
        .trim()
        .toLowerCase();

    const isNavigation =
      label.includes("next") ||
      label.includes("back") ||
      label === "home";

    if (!isNavigation) {
      return;
    }

    /*
     * Stop the sound BEFORE the lesson-state
     * request/navigation happens.
     */
    stopWeek3DemoSounds();
    stopDragQuickReviewAnimation();
    stopMeetDragAnimation();
  }

  document.addEventListener(
    "click",
    week3ImmediateNavigationStop,
    true
  );

  function getLessonContainer() {
    let container = document.getElementById("studentLessonView");

    if (!container) {
      container = document.createElement("section");
      container.id = "studentLessonView";
      document.body.appendChild(container);
    }

    return container;
  }

  function showReviewActivitiesHub() {
    currentMode = "review-activities";

    const reviewPopup =
      document.getElementById("reviewCompletePopup");

    if (reviewPopup) {
      reviewPopup.classList.remove("show");
      reviewPopup.remove();
    }

    const homePage =
      document.querySelector(".home-page");

    if (homePage) {
      homePage.hidden = true;
    }

    const container =
      getLessonContainer();

    container.hidden = false;

    const completed =
      getCompletedReviewActivities();

    const cards =
      REVIEW_ACTIVITIES.map((activity) => {
        const isComplete =
          completed.includes(activity.id);

        return `
          <button
            type="button"
            class="review-activity-card ${
              isComplete
                ? "review-activity-complete"
                : ""
            }"
            data-review-activity="${activity.id}"
          >
            <span class="review-activity-icon">
              ${activity.icon}
            </span>

            <strong>${activity.title}</strong>

            <span class="review-activity-description">
              ${activity.description}
            </span>

            ${
              isComplete
                ? '<span class="review-activity-check">✓ Complete</span>'
                : ""
            }
          </button>
        `;
      }).join("");

    container.innerHTML = `
      <div class="lesson-screen review-activities-hub">

        <div class="review-activities-heading">
          <span>QUICK ACTIVITIES</span>
          <h1>Practice Your Mouse Skills</h1>
          <p>
            Pick any activity. You can do them in any order.
          </p>
        </div>

        <div class="review-activities-grid">
          ${cards}
        </div>

        <div
          id="reviewActivitiesCelebration"
          class="review-activities-celebration"
          ${
            completed.length === REVIEW_ACTIVITIES.length
              ? ""
              : "hidden"
          }
        >
          <div class="review-activities-celebration-card">
            <div class="review-celebration-icon">★</div>

            <h2>Mouse Practice Complete!</h2>

            <p>
              You finished all six activities.
            </p>

            <button
              type="button"
              id="resetReviewActivitiesButton"
            >
              Try Them All Again
            </button>
          </div>
        </div>

      </div>
    `;

    container
      .querySelectorAll("[data-review-activity]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const activityId =
            button.dataset.reviewActivity;

          window.dispatchEvent(
            new CustomEvent(
              "handsOnMouseReviewActivitySelected",
              {
                detail: {
                  activityId
                }
              }
            )
          );
        });
      });

    const resetButton =
      document.getElementById(
        "resetReviewActivitiesButton"
      );

    resetButton?.addEventListener("click", () => {
      saveCompletedReviewActivities([]);
      showReviewActivitiesHub();
    });
  }

  let removeBullseyeMoveListener = null;
  let removeBullseyeLeftListener = null;
  let removeBullseyeRightListener = null;

  let removeWaitMoveListener = null;
  let removeWaitLeftListener = null;
  let removeWaitRightListener = null;

  let removeCornerHuntMoveListener = null;
  let removeCornerHuntLeftListener = null;
  let removeCornerHuntRightListener = null;

  let removeColorMatchMoveListener = null;
  let removeColorMatchLeftListener = null;
  let removeColorMatchRightListener = null;

  let removeMouseSprintMoveListener = null;
  let removeMouseSprintLeftListener = null;
  let removeMouseSprintRightListener = null;

  let removeBubblePopMoveListener = null;
  let removeBubblePopLeftListener = null;
  let removeBubblePopRightListener = null;

  function renderMouseHandReference() {
    return `
      <div
        class="mouse-hand-reference"
        role="img"
        aria-label="Keep your hand resting correctly on the mouse"
      >
        <div
          class="hold-mouse-visual mouse-hand-reference-visual"
          aria-hidden="true"
        >
          <div class="mouse-demo-hand left-click-hand">
            <div class="mouse-demo-palm"></div>
            <div class="mouse-demo-finger mouse-demo-index"></div>
            <div class="mouse-demo-finger mouse-demo-middle"></div>
            <div class="mouse-demo-finger mouse-demo-pinky"></div>
          </div>

          <div class="mouse-demo-body">
            <div class="mouse-demo-left"></div>
            <div class="mouse-demo-right"></div>
            <div class="mouse-demo-wheel"></div>
          </div>
        </div>
      </div>
    `;
  }

  function showBubblePopActivity() {
    const container = getLessonContainer();

    stopStepBehavior();
    currentMode = "review-activity";

    container.hidden = false;

    container.innerHTML = `
      <div class="lesson-screen bubble-pop-screen">
        ${renderMouseHandReference()}

        <div class="quick-activity-heading">
          <span>QUICK ACTIVITY</span>
          <h1>Bubble Pop</h1>
          <p>Follow the glowing bubble and left-click it once.</p>
        </div>

        <div
          id="bubblePopArea"
          class="bubble-pop-area"
        >
          <div class="bubble-cloud cloud-one">☁</div>
          <div class="bubble-cloud cloud-two">☁</div>

          <button class="floating-bubble" data-bubble="0" type="button"></button>
          <button class="floating-bubble" data-bubble="1" type="button"></button>
          <button class="floating-bubble" data-bubble="2" type="button"></button>
          <button class="floating-bubble" data-bubble="3" type="button"></button>
          <button class="floating-bubble" data-bubble="4" type="button"></button>
          <button class="floating-bubble" data-bubble="5" type="button"></button>

          <div
            id="bubblePopPointer"
            class="pointer-demo-icon"
          >
            ➤
          </div>
        </div>

        <div class="quick-activity-footer">
          <strong id="bubblePopProgress">0 of 8</strong>
          <span id="bubblePopStatus">
            Find the glowing bubble.
          </span>
        </div>

      </div>
    `;

    startBubblePopBehavior();
  }

  function startBubblePopBehavior() {
    const input = window.HandsOnMouseInput;
    const area = document.getElementById("bubblePopArea");
    const pointer = document.getElementById("bubblePopPointer");
    const progress = document.getElementById("bubblePopProgress");
    const status = document.getElementById("bubblePopStatus");

    const bubbles = Array.from(
      document.querySelectorAll(".floating-bubble")
    );

    if (
      !input ||
      !area ||
      !pointer ||
      !progress ||
      !status ||
      bubbles.length === 0
    ) {
      return;
    }

    let completed = 0;
    let activeBubbleIndex = 0;
    let pendingSuccessTimer = null;
    let activityFinished = false;
    let animationFrame = null;
    let lastTime = 0;

    const DOUBLE_CLICK_WINDOW = 450;

    const bubbleState = bubbles.map((bubble, index) => ({
      element: bubble,
      x: 15 + ((index * 14) % 70),
      y: 20 + ((index * 19) % 60),
      vx: (index % 2 === 0 ? 1 : -1) * (0.008 + index * 0.001),
      vy: (index % 3 === 0 ? 1 : -1) * (0.006 + index * 0.0008)
    }));

    function updateProgress() {
      progress.textContent = `${completed} of 8`;
    }

    function chooseNextBubble() {
      bubbles.forEach((bubble) => {
        bubble.classList.remove("bubble-pop-active");
        bubble.classList.remove("bubble-pop-popped");
      });

      let nextIndex = activeBubbleIndex;

      while (
        bubbles.length > 1 &&
        nextIndex === activeBubbleIndex
      ) {
        nextIndex =
          Math.floor(Math.random() * bubbles.length);
      }

      activeBubbleIndex = nextIndex;

      bubbles[activeBubbleIndex].classList.add(
        "bubble-pop-active"
      );

      status.textContent =
        "Find the glowing bubble.";
    }

    function animate(timestamp) {
      if (activityFinished) {
        return;
      }

      if (!lastTime) {
        lastTime = timestamp;
      }

      const delta =
        Math.min(timestamp - lastTime, 40);

      lastTime = timestamp;

      bubbleState.forEach((state) => {
        state.x += state.vx * delta;
        state.y += state.vy * delta;

        if (state.x <= 7) {
          state.x = 7;
          state.vx = Math.abs(state.vx);
        }

        if (state.x >= 93) {
          state.x = 93;
          state.vx = -Math.abs(state.vx);
        }

        if (state.y <= 12) {
          state.y = 12;
          state.vy = Math.abs(state.vy);
        }

        if (state.y >= 88) {
          state.y = 88;
          state.vy = -Math.abs(state.vy);
        }

        state.element.style.left =
          `${state.x}%`;

        state.element.style.top =
          `${state.y}%`;
      });

      animationFrame =
        requestAnimationFrame(animate);
    }

    function pointerBubble() {
      const activeBubble =
        bubbles[activeBubbleIndex];

      /*
       * Always give priority to the glowing target.
       * This prevents an overlapping non-target bubble
       * from stealing the click.
       */
      if (
        activeBubble &&
        pointerTipHitsElement(
          pointer,
          activeBubble
        )
      ) {
        return activeBubble;
      }

      return bubbles.find((bubble, index) => {
        if (index === activeBubbleIndex) {
          return false;
        }

        return pointerTipHitsElement(
          pointer,
          bubble
        );
      });
    }

    removeBubblePopMoveListener =
      input.subscribe("move", (event) => {
        if (activityFinished) {
          return;
        }

        const rect =
          area.getBoundingClientRect();

        const inside =
          event.x >= rect.left &&
          event.x <= rect.right &&
          event.y >= rect.top &&
          event.y <= rect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.72;

        const offsetY =
          pointer.offsetHeight * 0.72;

        pointer.style.left =
          `${event.x - rect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - rect.top - offsetY}px`;

        // No movement sound in Quick Activities.
      });

    removeBubblePopRightListener =
      input.subscribe("rightDown", () => {
        if (!activityFinished) {
          showWrongButtonWarning();
        }
      });

    removeBubblePopLeftListener =
      input.subscribe("leftDown", (event) => {
        if (activityFinished) {
          return;
        }

        /*
         * Second click inside the confirmation window:
         * cancel the pending success completely.
         */
        if (pendingSuccessTimer) {
          clearTimeout(pendingSuccessTimer);
          pendingSuccessTimer = null;

          showClickWarning();

          status.textContent =
            "Too fast! Click once, then wait.";

          return;
        }

        const clicked =
          pointerBubble();

        if (!clicked) {
          return;
        }

        const clickedIndex =
          Number(clicked.dataset.bubble);

        if (clickedIndex !== activeBubbleIndex) {
          clicked.classList.remove(
            "bubble-pop-wrong"
          );

          void clicked.offsetWidth;

          clicked.classList.add(
            "bubble-pop-wrong"
          );

          status.textContent =
            "Look for the glowing bubble.";

          return;
        }

        status.textContent = "Wait...";

        /*
         * Delay credit so the first half of a
         * double-click never counts.
         */
        pendingSuccessTimer =
          setTimeout(() => {
            pendingSuccessTimer = null;

            completed += 1;

            clicked.classList.remove(
              "bubble-pop-active"
            );

            clicked.classList.add(
              "bubble-pop-popped"
            );

            updateProgress();

            if (soundEnabled) {
              if (!leftClickSound) {
                leftClickSound =
                  new Audio("/sounds/mouseclick.mp3");

                leftClickSound.volume = 0.5;
              }

              leftClickSound.currentTime = 0;
              leftClickSound.play().catch(() => {});
            }

            if (completed >= 8) {
              activityFinished = true;

              if (animationFrame) {
                cancelAnimationFrame(animationFrame);
                animationFrame = null;
              }

              progress.textContent =
                "8 of 8 ✓";

              status.textContent =
                "Bubble Pop complete!";

              setTimeout(() => {
                window
                  .HandsOnMouseReviewActivities
                  ?.complete("bubble-pop");
              }, 1100);

              return;
            }

            setTimeout(
              chooseNextBubble,
              280
            );

          }, DOUBLE_CLICK_WINDOW);
      });

    bubbles[activeBubbleIndex].classList.add(
      "bubble-pop-active"
    );

    updateProgress();

    animationFrame =
      requestAnimationFrame(animate);
  }

  function showMouseSprintActivity() {
    const container = getLessonContainer();

    stopStepBehavior();
    currentMode = "review-activity";

    container.hidden = false;

    container.innerHTML = `
      <div class="lesson-screen mouse-sprint-screen">
        ${renderMouseHandReference()}

        <div class="quick-activity-heading">
          <span>QUICK ACTIVITY</span>
          <h1>Mouse Sprint</h1>
          <p>Catch the mouse before it reaches the hole!</p>
        </div>

        <div
          id="mouseSprintArea"
          class="mouse-sprint-area"
        >
          <div class="mouse-sprint-wall"></div>

          <div class="mouse-hole">
            🕳️
          </div>

          <button
            id="mouseSprintMouse"
            class="mouse-sprint-mouse"
            type="button"
            aria-label="Running mouse"
          >
            <img
              src="/images/mouse.png"
              alt=""
              class="mouse-sprint-image"
              draggable="false"
            >
          </button>

          <div
            id="mouseSprintPointer"
            class="pointer-demo-icon"
          >
            ➤
          </div>
        </div>

        <div class="quick-activity-footer">
          <strong id="mouseSprintProgress">0 of 5</strong>
          <span id="mouseSprintStatus">
            Get ready...
          </span>
        </div>

      </div>
    `;

    startMouseSprintBehavior();
  }

  function startMouseSprintBehavior() {
    const input = window.HandsOnMouseInput;

    const area =
      document.getElementById("mouseSprintArea");

    const mouse =
      document.getElementById("mouseSprintMouse");

    const pointer =
      document.getElementById("mouseSprintPointer");

    const progress =
      document.getElementById("mouseSprintProgress");

    const status =
      document.getElementById("mouseSprintStatus");

    if (
      !input ||
      !area ||
      !mouse ||
      !pointer ||
      !progress ||
      !status
    ) {
      return;
    }

    let completed = 0;
    let activityFinished = false;
    let running = false;
    let animationFrame = null;
    let pendingSuccessTimer = null;

    let mouseX = 0;
    let mouseYPercent = 58;
    let lastFrameTime = 0;

    const DOUBLE_CLICK_WINDOW = 450;

    function updateProgress() {
      progress.textContent =
        `${completed} of 5`;
    }

    function stopMouseAnimation() {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }

      running = false;
    }

    function mouseEscaped() {
      stopMouseAnimation();

      status.textContent =
        "It escaped! Try again.";

      mouse.classList.add(
        "mouse-sprint-escaped"
      );

      setTimeout(() => {
        mouse.classList.remove(
          "mouse-sprint-escaped"
        );

        startRound();
      }, 850);
    }

    function animateMouse(timestamp) {
      if (!running || activityFinished) {
        return;
      }

      if (!lastFrameTime) {
        lastFrameTime = timestamp;
      }

      const delta =
        Math.min(
          timestamp - lastFrameTime,
          40
        );

      lastFrameTime = timestamp;

      /*
       * Slightly faster as students progress.
       */
      const speed =
        0.16 + completed * 0.018;

      mouseX += delta * speed;

      mouse.style.left =
        `${mouseX}px`;

      if (
        mouseX >=
        area.clientWidth - 100
      ) {
        mouseEscaped();
        return;
      }

      animationFrame =
        requestAnimationFrame(
          animateMouse
        );
    }

    function startRound() {
      if (activityFinished) {
        return;
      }

      stopMouseAnimation();

      if (pendingSuccessTimer) {
        clearTimeout(
          pendingSuccessTimer
        );

        pendingSuccessTimer = null;
      }

      mouseX = 15;

      mouseYPercent =
        32 + Math.random() * 42;

      mouse.style.left =
        `${mouseX}px`;

      mouse.style.top =
        `${mouseYPercent}%`;

      status.textContent =
        "Catch the mouse!";

      lastFrameTime = 0;
      running = true;

      animationFrame =
        requestAnimationFrame(
          animateMouse
        );
    }

    function pointerIsOnMouse() {
      const pointerRect =
        pointer.getBoundingClientRect();

      const mouseRect =
        mouse.getBoundingClientRect();

      const tipX =
        pointerRect.left +
        pointerRect.width * 0.72;

      const tipY =
        pointerRect.top +
        pointerRect.height * 0.72;

      return (
        tipX >= mouseRect.left &&
        tipX <= mouseRect.right &&
        tipY >= mouseRect.top &&
        tipY <= mouseRect.bottom
      );
    }

    removeMouseSprintMoveListener =
      input.subscribe("move", (event) => {
        if (activityFinished) {
          return;
        }

        const areaRect =
          area.getBoundingClientRect();

        const inside =
          event.x >= areaRect.left &&
          event.x <= areaRect.right &&
          event.y >= areaRect.top &&
          event.y <= areaRect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.72;

        const offsetY =
          pointer.offsetHeight * 0.72;

        pointer.style.left =
          `${event.x - areaRect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - areaRect.top - offsetY}px`;

        // No movement sound in Quick Activities.
      });

    removeMouseSprintRightListener =
      input.subscribe("rightDown", () => {
        if (activityFinished) {
          return;
        }

        showWrongButtonWarning();
      });

    removeMouseSprintLeftListener =
      input.subscribe("leftDown", (event) => {
        if (activityFinished) {
          return;
        }

        /*
         * Check for the second half of a double-click
         * BEFORE checking whether the mouse is running.
         * The first click temporarily freezes the mouse.
         */
        if (pendingSuccessTimer) {
          clearTimeout(pendingSuccessTimer);
          pendingSuccessTimer = null;

          showClickWarning();

          status.textContent =
            "Too fast! Click once, then wait.";

          setTimeout(() => {
            startRound();
          }, 1200);

          return;
        }

        if (!running) {
          return;
        }

        /*
         * Only the visible black cursor tip counts.
         * Overlapping with the back of the cursor does not.
         */
        if (!pointerIsOnMouse()) {
          status.textContent =
            "Miss! Keep tracking the mouse.";
          return;
        }

        /*
         * Freeze the mouse while we verify
         * that this was a controlled single click.
         */
        stopMouseAnimation();

        status.textContent =
          "Wait...";

        pendingSuccessTimer =
          setTimeout(() => {
            pendingSuccessTimer = null;

            completed += 1;

            updateProgress();

            mouse.classList.add(
              "mouse-sprint-caught"
            );

            if (soundEnabled) {
              if (!leftClickSound) {
                leftClickSound =
                  new Audio(
                    "/sounds/mouseclick.mp3"
                  );

                leftClickSound.volume = 0.5;
              }

              leftClickSound.currentTime = 0;
              leftClickSound
                .play()
                .catch(() => {});
            }

            if (completed >= 5) {
              activityFinished = true;

              progress.textContent =
                "5 of 5 ✓";

              status.textContent =
                "Mouse Sprint complete!";

              setTimeout(() => {
                window
                  .HandsOnMouseReviewActivities
                  ?.complete("mouse-sprint");
              }, 1100);

              return;
            }

            status.textContent =
              "Nice catch!";

            setTimeout(() => {
              mouse.classList.remove(
                "mouse-sprint-caught"
              );

              startRound();
            }, 650);

          }, DOUBLE_CLICK_WINDOW);
      });

    updateProgress();

    setTimeout(
      startRound,
      700
    );
  }

  function showColorMatchActivity() {
    const container = getLessonContainer();

    stopStepBehavior();
    currentMode = "review-activity";

    container.hidden = false;

    container.innerHTML = `
      <div class="lesson-screen color-match-screen">
        ${renderMouseHandReference()}

        <div class="quick-activity-heading">
          <span>QUICK ACTIVITY</span>
          <h1>Color Match</h1>
          <p>Find the color that matches the clue.</p>
        </div>

        <div class="color-match-clue-wrap">
          <span>Find</span>

          <strong
            id="colorMatchClue"
            class="color-match-clue"
          >
            BLUE
          </strong>
        </div>

        <div
          id="colorMatchArea"
          class="color-match-area"
        >
          <button
            class="color-match-target"
            data-color="red"
            type="button"
            aria-label="Red"
          ></button>

          <button
            class="color-match-target"
            data-color="blue"
            type="button"
            aria-label="Blue"
          ></button>

          <button
            class="color-match-target"
            data-color="green"
            type="button"
            aria-label="Green"
          ></button>

          <button
            class="color-match-target"
            data-color="yellow"
            type="button"
            aria-label="Yellow"
          ></button>

          <div
            id="colorMatchPointer"
            class="pointer-demo-icon"
          >
            ➤
          </div>
        </div>

        <div class="quick-activity-footer">
          <strong id="colorMatchProgress">0 of 5</strong>
          <span id="colorMatchStatus">
            Find the matching color.
          </span>
        </div>

      </div>
    `;

    startColorMatchBehavior();
  }

  function startColorMatchBehavior() {
    const input = window.HandsOnMouseInput;

    const area =
      document.getElementById("colorMatchArea");

    const pointer =
      document.getElementById("colorMatchPointer");

    const clue =
      document.getElementById("colorMatchClue");

    const progress =
      document.getElementById("colorMatchProgress");

    const status =
      document.getElementById("colorMatchStatus");

    const targets =
      Array.from(
        document.querySelectorAll(
          ".color-match-target"
        )
      );

    if (
      !input ||
      !area ||
      !pointer ||
      !clue ||
      !progress ||
      !status ||
      targets.length !== 4
    ) {
      return;
    }

    const COLORS = [
      "red",
      "blue",
      "green",
      "yellow"
    ];

    const DISPLAY_NAMES = {
      red: "RED",
      blue: "BLUE",
      green: "GREEN",
      yellow: "YELLOW"
    };

    const TARGET_POSITIONS = [
      { x: 22, y: 30 },
      { x: 76, y: 30 },
      { x: 22, y: 72 },
      { x: 76, y: 72 }
    ];

    let completed = 0;
    let currentColor = null;
    let roundStartedAt = 0;
    let pendingSuccessTimer = null;
    let activityFinished = false;

    const DOUBLE_CLICK_WINDOW = 450;

    const wrongColorSound =
      new Audio("/sounds/mistake.mp3");

    wrongColorSound.preload = "auto";
    wrongColorSound.volume = 0.55;

    function shuffle(array) {
      const copy = [...array];

      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j =
          Math.floor(Math.random() * (i + 1));

        [copy[i], copy[j]] =
          [copy[j], copy[i]];
      }

      return copy;
    }

    function updateProgress() {
      progress.textContent =
        `${completed} of 5`;
    }

    function layoutTargets() {
      const shuffledColors =
        shuffle(COLORS);

      targets.forEach((target, index) => {
        const color =
          shuffledColors[index];

        const position =
          TARGET_POSITIONS[index];

        target.dataset.color = color;

        target.className =
          `color-match-target color-${color}`;

        target.style.left =
          `${position.x}%`;

        target.style.top =
          `${position.y}%`;
      });
    }

    function beginRound() {
      if (activityFinished) {
        return;
      }

      pendingSuccessTimer = null;

      const previousColor =
        currentColor;

      const available =
        COLORS.filter(
          color => color !== previousColor
        );

      currentColor =
        available[
          Math.floor(
            Math.random() * available.length
          )
        ];

      clue.textContent =
        DISPLAY_NAMES[currentColor];

      clue.className =
        `color-match-clue clue-${currentColor}`;

      layoutTargets();

      targets.forEach((target) => {
        target.classList.remove(
          "color-match-correct"
        );

        target.classList.remove(
          "color-match-wrong"
        );
      });

      status.textContent =
        "Find the matching color.";

      roundStartedAt =
        performance.now();
    }

    function pointerTarget() {
      const pointerRect =
        pointer.getBoundingClientRect();

      const tipX =
        pointerRect.left +
        pointerRect.width * 0.72;

      const tipY =
        pointerRect.top +
        pointerRect.height * 0.72;

      return targets.find((target) => {
        const rect =
          target.getBoundingClientRect();

        return (
          tipX >= rect.left &&
          tipX <= rect.right &&
          tipY >= rect.top &&
          tipY <= rect.bottom
        );
      });
    }

    function handleWrongColor(target) {
      target.classList.remove(
        "color-match-wrong"
      );

      void target.offsetWidth;

      target.classList.add(
        "color-match-wrong"
      );

      status.textContent =
        "Not that color. Try again.";

      if (soundEnabled) {
        wrongColorSound.pause();
        wrongColorSound.currentTime = 0;
        wrongColorSound.play().catch(() => {});
      }
    }

    removeColorMatchMoveListener =
      input.subscribe("move", (event) => {
        if (activityFinished) {
          return;
        }

        const areaRect =
          area.getBoundingClientRect();

        const inside =
          event.x >= areaRect.left &&
          event.x <= areaRect.right &&
          event.y >= areaRect.top &&
          event.y <= areaRect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.72;

        const offsetY =
          pointer.offsetHeight * 0.72;

        pointer.style.left =
          `${event.x - areaRect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - areaRect.top - offsetY}px`;

        // No movement sound in Quick Activities.
      });

    removeColorMatchRightListener =
      input.subscribe("rightDown", () => {
        if (activityFinished) {
          return;
        }

        // Warning = no credit.
        showWrongButtonWarning();
      });

    removeColorMatchLeftListener =
      input.subscribe("leftDown", () => {
        if (activityFinished) {
          return;
        }

        /*
         * Second click inside confirmation window:
         * cancel the first click completely.
         */
        if (pendingSuccessTimer) {
          clearTimeout(
            pendingSuccessTimer
          );

          pendingSuccessTimer = null;

          showClickWarning();

          status.textContent =
            "Too fast! Click once, then wait.";

          return;
        }

        const target =
          pointerTarget();

        if (!target) {
          return;
        }

        if (
          target.dataset.color !==
          currentColor
        ) {
          handleWrongColor(target);
          return;
        }

        /*
         * Correct target found.
         * Delay success so double-click cannot
         * earn credit.
         */
        const reactionSeconds =
          (
            performance.now() -
            roundStartedAt
          ) / 1000;

        status.textContent = "Wait...";

        pendingSuccessTimer =
          setTimeout(() => {
            pendingSuccessTimer = null;

            completed += 1;

            target.classList.add(
              "color-match-correct"
            );

            updateProgress();

            if (soundEnabled) {
              if (!leftClickSound) {
                leftClickSound =
                  new Audio(
                    "/sounds/mouseclick.mp3"
                  );

                leftClickSound.volume = 0.5;
              }

              leftClickSound.currentTime = 0;
              leftClickSound
                .play()
                .catch(() => {});
            }

            if (completed >= 5) {
              activityFinished = true;

              progress.textContent =
                "5 of 5 ✓";

              status.textContent =
                `Great! ${reactionSeconds.toFixed(1)} seconds.`;

              setTimeout(() => {
                window
                  .HandsOnMouseReviewActivities
                  ?.complete("color-match");
              }, 1100);

              return;
            }

            status.textContent =
              `Nice! ${reactionSeconds.toFixed(1)} seconds.`;

            setTimeout(
              beginRound,
              750
            );

          }, DOUBLE_CLICK_WINDOW);
      });

    updateProgress();
    beginRound();
  }

  function showCornerHuntActivity() {
    const container = getLessonContainer();

    stopStepBehavior();
    currentMode = "review-activity";

    container.hidden = false;

    container.innerHTML = `
      <div class="lesson-screen corner-hunt-screen">
        ${renderMouseHandReference()}

        <div class="quick-activity-heading">
          <span>QUICK ACTIVITY</span>
          <h1>Corner Hunt</h1>
          <p>Find the deer hiding in the woods and left-click it once.</p>
        </div>

        <div
          id="cornerHuntArea"
          class="corner-hunt-area"
        >
          <div class="corner-hunt-sky"></div>
          <div class="corner-hunt-ground"></div>

          <span class="corner-tree tree-a">🌲</span>
          <span class="corner-tree tree-b">🌳</span>
          <span class="corner-tree tree-c">🌲</span>
          <span class="corner-tree tree-d">🌳</span>
          <span class="corner-tree tree-e">🌲</span>
          <span class="corner-tree tree-f">🌳</span>
          <span class="corner-tree tree-g">🌲</span>
          <span class="corner-tree tree-h">🌳</span>

          <button
            id="cornerHuntDeer"
            class="corner-hunt-deer"
            type="button"
            aria-label="Hidden deer"
          >
            🦌
          </button>

          <span
            id="cornerHuntCoverTree"
            class="corner-hunt-cover-tree"
          >
            🌲
          </span>

          <div
            id="cornerHuntPointer"
            class="pointer-demo-icon"
          >
            ➤
          </div>
        </div>

        <div class="quick-activity-footer">
          <strong id="cornerHuntProgress">0 of 5</strong>
          <span id="cornerHuntStatus">
            Find the deer!
          </span>
        </div>

      </div>
    `;

    startCornerHuntBehavior();
  }

  function startCornerHuntBehavior() {
    const input = window.HandsOnMouseInput;

    const area =
      document.getElementById("cornerHuntArea");

    const deer =
      document.getElementById("cornerHuntDeer");

    const coverTree =
      document.getElementById("cornerHuntCoverTree");

    const pointer =
      document.getElementById("cornerHuntPointer");

    const progress =
      document.getElementById("cornerHuntProgress");

    const status =
      document.getElementById("cornerHuntStatus");

    if (
      !input ||
      !area ||
      !deer ||
      !coverTree ||
      !pointer ||
      !progress ||
      !status
    ) {
      return;
    }

    const hidingSpots = [
      {
        deerX: 14,
        deerY: 23,
        treeX: 11,
        treeY: 21
      },
      {
        deerX: 84,
        deerY: 25,
        treeX: 88,
        treeY: 22
      },
      {
        deerX: 16,
        deerY: 76,
        treeX: 12,
        treeY: 73
      },
      {
        deerX: 84,
        deerY: 74,
        treeX: 88,
        treeY: 72
      },
      {
        deerX: 72,
        deerY: 48,
        treeX: 76,
        treeY: 47
      }
    ];

    let completed = 0;
    let pendingSuccessTimer = null;
    let activityFinished = false;

    const DOUBLE_CLICK_WINDOW = 450;

    function updateProgress() {
      progress.textContent =
        `${completed} of ${hidingSpots.length}`;
    }

    function positionDeer() {
      if (completed >= hidingSpots.length) {
        return;
      }

      const spot = hidingSpots[completed];

      deer.style.left = `${spot.deerX}%`;
      deer.style.top = `${spot.deerY}%`;

      coverTree.style.left = `${spot.treeX}%`;
      coverTree.style.top = `${spot.treeY}%`;

      deer.classList.remove("corner-deer-found");

      void deer.offsetWidth;

      deer.classList.add("corner-deer-enter");
    }

    function pointerIsOnDeer() {
      const pointerRect =
        pointer.getBoundingClientRect();

      const deerRect =
        deer.getBoundingClientRect();

      const tipX =
        pointerRect.left +
        pointerRect.width * 0.72;

      const tipY =
        pointerRect.top +
        pointerRect.height * 0.72;

      return (
        tipX >= deerRect.left &&
        tipX <= deerRect.right &&
        tipY >= deerRect.top &&
        tipY <= deerRect.bottom
      );
    }

    removeCornerHuntMoveListener =
      input.subscribe("move", (event) => {
        if (activityFinished) {
          return;
        }

        const areaRect =
          area.getBoundingClientRect();

        const inside =
          event.x >= areaRect.left &&
          event.x <= areaRect.right &&
          event.y >= areaRect.top &&
          event.y <= areaRect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.72;

        const offsetY =
          pointer.offsetHeight * 0.72;

        pointer.style.left =
          `${event.x - areaRect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - areaRect.top - offsetY}px`;

        // Intentionally NO movement sound in Quick Activities.
      });

    removeCornerHuntRightListener =
      input.subscribe("rightDown", () => {
        if (activityFinished) {
          return;
        }

        // Warning = no success.
        showWrongButtonWarning();
      });

    removeCornerHuntLeftListener =
      input.subscribe("leftDown", () => {
        if (activityFinished) {
          return;
        }

        if (!pointerIsOnDeer()) {
          status.textContent =
            "Keep looking for the deer.";
          return;
        }

        /*
         * Never award the first click immediately.
         * This prevents the first half of a double-click
         * from receiving credit.
         */
        if (pendingSuccessTimer) {
          clearTimeout(pendingSuccessTimer);
          pendingSuccessTimer = null;

          showClickWarning();

          status.textContent =
            "Too fast! Click once, then wait.";

          return;
        }

        status.textContent = "Wait...";

        pendingSuccessTimer =
          setTimeout(() => {
            pendingSuccessTimer = null;

            completed += 1;

            updateProgress();

            deer.classList.remove(
              "corner-deer-enter"
            );

            deer.classList.add(
              "corner-deer-found"
            );

            if (soundEnabled) {
              if (!leftClickSound) {
                leftClickSound =
                  new Audio(
                    "/sounds/mouseclick.mp3"
                  );

                leftClickSound.volume = 0.5;
              }

              leftClickSound.currentTime = 0;
              leftClickSound
                .play()
                .catch(() => {});
            }

            if (
              completed >= hidingSpots.length
            ) {
              activityFinished = true;

              progress.textContent =
                "5 of 5 ✓";

              status.textContent =
                "Corner Hunt complete!";

              deer.textContent = "✓";

              coverTree.style.display = "none";

              setTimeout(() => {
                window
                  .HandsOnMouseReviewActivities
                  ?.complete("corner-hunt");
              }, 1100);

              return;
            }

            status.textContent =
              "Great! Find the deer again.";

            setTimeout(() => {
              positionDeer();
            }, 450);

          }, DOUBLE_CLICK_WINDOW);
      });

    updateProgress();
    positionDeer();
  }

  function showWaitForItActivity() {
    const container = getLessonContainer();

    stopStepBehavior();
    currentMode = "review-activity";

    container.hidden = false;

    container.innerHTML = `
      <div class="lesson-screen wait-activity-screen">
        ${renderMouseHandReference()}

        <div class="quick-activity-heading">
          <span>QUICK ACTIVITY</span>
          <h1>Wait for It</h1>
          <p>Wait until the light turns bright. Then click!</p>
        </div>

        <div
          id="waitActivityArea"
          class="wait-activity-area"
        >
          <button
            id="waitActivityTarget"
            class="wait-activity-target waiting"
            type="button"
          >
            💡
          </button>

          <div
            id="waitActivityPointer"
            class="pointer-demo-icon"
          >
            ➤
          </div>
        </div>

        <div class="quick-activity-footer">
          <strong id="waitProgress">0 of 5</strong>
          <span id="waitStatus">Wait...</span>
        </div>

      </div>
    `;

    startWaitForItBehavior();
  }

  function startWaitForItBehavior() {
    const input = window.HandsOnMouseInput;
    const area =
      document.getElementById("waitActivityArea");
    const target =
      document.getElementById("waitActivityTarget");
    const pointer =
      document.getElementById("waitActivityPointer");
    const progress =
      document.getElementById("waitProgress");
    const status =
      document.getElementById("waitStatus");

    if (
      !input ||
      !area ||
      !target ||
      !pointer ||
      !progress ||
      !status
    ) {
      return;
    }

    const positions = [
      { x: 20, y: 25 },
      { x: 76, y: 28 },
      { x: 48, y: 52 },
      { x: 24, y: 74 },
      { x: 74, y: 72 }
    ];

    let completed = 0;
    let ready = false;
    let readyTime = 0;
    let readyTimer = null;
    let pendingSuccessTimer = null;
    let activityFinished = false;

    const DOUBLE_CLICK_WINDOW = 450;

    function updateProgress() {
      progress.textContent =
        `${completed} of ${positions.length}`;
    }

    function positionTarget() {
      const position = positions[completed];

      target.style.left = `${position.x}%`;
      target.style.top = `${position.y}%`;
    }

    function beginRound() {
      if (activityFinished) {
        return;
      }

      clearTimeout(readyTimer);

      ready = false;

      target.classList.remove("ready");
      target.classList.add("waiting");

      status.textContent = "Wait...";

      positionTarget();

      const waitTime =
        1500 + Math.random() * 1500;

      readyTimer = setTimeout(() => {
        ready = true;
        readyTime = performance.now();

        target.classList.remove("waiting");
        target.classList.add("ready");

        status.textContent = "GO! Click the light!";
      }, waitTime);
    }

    function pointerIsOnTarget() {
      return pointerTipHitsElement(
        pointer,
        target
      );
    }

    removeWaitMoveListener =
      input.subscribe("move", (event) => {
        if (activityFinished) {
          return;
        }

        const areaRect =
          area.getBoundingClientRect();

        const inside =
          event.x >= areaRect.left &&
          event.x <= areaRect.right &&
          event.y >= areaRect.top &&
          event.y <= areaRect.bottom;

        if (!inside) {
          return;
        }

        const offsetX =
          pointer.offsetWidth * 0.72;

        const offsetY =
          pointer.offsetHeight * 0.72;

        pointer.style.left =
          `${event.x - areaRect.left - offsetX}px`;

        pointer.style.top =
          `${event.y - areaRect.top - offsetY}px`;
      });

    removeWaitRightListener =
      input.subscribe("rightDown", () => {
        if (!activityFinished) {
          showWrongButtonWarning();
        }
      });

    removeWaitLeftListener =
      input.subscribe("leftDown", () => {
        if (activityFinished) {
          return;
        }

        /*
         * If a second click arrives before the first
         * click has been confirmed, cancel the success.
         * Neither click gets credit.
         */
        if (pendingSuccessTimer) {
          clearTimeout(pendingSuccessTimer);
          pendingSuccessTimer = null;

          ready = false;

          showClickWarning();

          status.textContent =
            "Too fast! Wait for the light, then click once.";

          setTimeout(beginRound, 1200);
          return;
        }

        /*
         * Clicking before GO is also a mistake.
         */
        if (!ready) {
          clearTimeout(readyTimer);
          readyTimer = null;

          showClickWarning();

          status.textContent =
            "Too soon! Wait for the bright light.";

          setTimeout(beginRound, 1200);
          return;
        }

        if (!pointerIsOnTarget()) {
          return;
        }

        const reactionSeconds =
          (performance.now() - readyTime) / 1000;

        /*
         * Do not award credit yet.
         * Wait briefly to make sure this was a
         * controlled single click.
         */
        status.textContent = "Wait...";

        pendingSuccessTimer =
          setTimeout(() => {
            pendingSuccessTimer = null;

            completed += 1;
            ready = false;

            updateProgress();

            if (soundEnabled) {
              if (!leftClickSound) {
                leftClickSound =
                  new Audio("/sounds/mouseclick.mp3");

                leftClickSound.volume = 0.5;
              }

              leftClickSound.currentTime = 0;
              leftClickSound.play().catch(() => {});
            }

            if (completed >= positions.length) {
              activityFinished = true;

              target.textContent = "✓";
              target.classList.remove("ready");
              target.classList.add("wait-finished");

              progress.textContent = "5 of 5 ✓";

              status.textContent =
                `Great! ${reactionSeconds.toFixed(1)} seconds.`;

              setTimeout(() => {
                window
                  .HandsOnMouseReviewActivities
                  ?.complete("wait-for-it");
              }, 1200);

              return;
            }

            status.textContent =
              `Nice! ${reactionSeconds.toFixed(1)} seconds.`;

            setTimeout(beginRound, 900);
          }, DOUBLE_CLICK_WINDOW);
      });

    updateProgress();
    beginRound();
  }

  function showBullseyeActivity() {
    const container = getLessonContainer();

    stopStepBehavior();
    currentMode = "review-activity";

    container.hidden = false;

    container.innerHTML = `
      <div class="lesson-screen bullseye-activity-screen">
        ${renderMouseHandReference()}

        <div class="quick-activity-heading">
          <span>QUICK ACTIVITY</span>
          <h1>Bullseye Click</h1>
          <p>Move to the target and left-click once.</p>
        </div>

        <div
          id="bullseyeActivityArea"
          class="bullseye-activity-area"
        >
          <button
            id="bullseyeActivityTarget"
            class="bullseye-real-target"
            type="button"
            aria-label="Bullseye target"
          >
            <span class="bullseye-ring ring-1"></span>
            <span class="bullseye-ring ring-2"></span>
            <span class="bullseye-ring ring-3"></span>
            <span class="bullseye-ring ring-4"></span>
            <span class="bullseye-center"></span>
          </button>

          <div
            id="bullseyeActivityPointer"
            class="pointer-demo-icon"
          >
            ➤
          </div>
        </div>

        <div class="quick-activity-footer">
          <strong id="bullseyeProgress">0 of 5</strong>
          <span id="bullseyeStatus">
            Find the first target.
          </span>
        </div>

      </div>
    `;

    startBullseyeActivityBehavior();
  }

  function startBullseyeActivityBehavior() {
    const input = window.HandsOnMouseInput;
    const area =
      document.getElementById("bullseyeActivityArea");
    const target =
      document.getElementById("bullseyeActivityTarget");
    const pointer =
      document.getElementById("bullseyeActivityPointer");
    const progress =
      document.getElementById("bullseyeProgress");
    const status =
      document.getElementById("bullseyeStatus");

    if (
      !input ||
      !area ||
      !target ||
      !pointer ||
      !progress ||
      !status
    ) {
      return;
    }

    const positions = [
      { x: 18, y: 24 },
      { x: 78, y: 26 },
      { x: 50, y: 52 },
      { x: 22, y: 76 },
      { x: 76, y: 74 }
    ];

    let completed = 0;
    let pendingClickTimer = null;
    let activityFinished = false;

    const DOUBLE_CLICK_WINDOW = 450;

    const bullseyeHitSound =
      new Audio("/sounds/arrow.mp3");

    bullseyeHitSound.preload = "auto";
    bullseyeHitSound.volume = 0.6;

    const bullseyeMissSound =
      new Audio("/sounds/swish.mp3");

    bullseyeMissSound.preload = "auto";
    bullseyeMissSound.volume = 0.55;

    function updateProgress() {
      progress.textContent =
        `${completed} of ${positions.length}`;
    }

    function positionTarget() {
      if (completed >= positions.length) {
        return;
      }

      const position = positions[completed];

      target.style.left = `${position.x}%`;
      target.style.top = `${position.y}%`;
    }

    function pointerIsOnTarget() {
      return pointerTipHitsElement(
        pointer,
        target
      );
    }

    removeBullseyeMoveListener =
      input.subscribe("move", (event) => {
        if (activityFinished) {
          return;
        }

        const areaRect =
          area.getBoundingClientRect();

        const insideArea =
          event.x >= areaRect.left &&
          event.x <= areaRect.right &&
          event.y >= areaRect.top &&
          event.y <= areaRect.bottom;

        if (!insideArea) {
          return;
        }

        const tipOffsetX =
          pointer.offsetWidth * 0.72;

        const tipOffsetY =
          pointer.offsetHeight * 0.72;

        pointer.style.left =
          `${event.x - areaRect.left - tipOffsetX}px`;

        pointer.style.top =
          `${event.y - areaRect.top - tipOffsetY}px`;

      });

    removeBullseyeRightListener =
      input.subscribe("rightDown", () => {
        if (activityFinished) {
          return;
        }

        showWrongButtonWarning();
      });

    removeBullseyeLeftListener =
      input.subscribe("leftDown", () => {
        if (activityFinished) {
          return;
        }

        if (!pointerIsOnTarget()) {
          if (soundEnabled) {
            bullseyeMissSound.pause();
            bullseyeMissSound.currentTime = 0;
            bullseyeMissSound.play().catch(() => {});
          }

          status.textContent =
            "Miss! Aim for the bullseye.";

          return;
        }

        /*
         * Do not immediately give credit.
         * Wait briefly to make sure this was not
         * the first half of a double-click.
         */
        if (pendingClickTimer) {
          clearTimeout(pendingClickTimer);
          pendingClickTimer = null;

          showClickWarning();

          target.classList.remove(
            "bullseye-hit"
          );

          return;
        }

        if (soundEnabled) {
          bullseyeHitSound.pause();
          bullseyeHitSound.currentTime = 0.08;
          bullseyeHitSound.play().catch(() => {});
        }

        status.textContent = "Wait...";

        pendingClickTimer =
          setTimeout(() => {
            pendingClickTimer = null;

            completed += 1;
            updateProgress();

            target.classList.remove(
              "bullseye-hit"
            );

            void target.offsetWidth;

            target.classList.add(
              "bullseye-hit"
            );


            if (
              completed >= positions.length
            ) {
              activityFinished = true;

              status.textContent =
                "Bullseye Click complete!";

              progress.textContent =
                "5 of 5 ✓";

              target.classList.add(
                "bullseye-finished"
              );

              setTimeout(() => {
                window
                  .HandsOnMouseReviewActivities
                  ?.complete("bullseye");
              }, 900);

              return;
            }

            status.textContent =
              "Great! Find the next target.";

            positionTarget();
          }, DOUBLE_CLICK_WINDOW);
      });

    positionTarget();
    updateProgress();
  }

  function markReviewActivityComplete(activityId) {
    const completed =
      getCompletedReviewActivities();

    if (!completed.includes(activityId)) {
      completed.push(activityId);
      saveCompletedReviewActivities(completed);
    }

    showReviewActivitiesHub();
  }

  window.HandsOnMouseReviewActivities = {
    showHub: showReviewActivitiesHub,
    complete: markReviewActivityComplete
  };


  window.addEventListener(
    "handsOnMouseReviewActivitySelected",
    (event) => {
      const activityId =
        event.detail?.activityId;

      if (activityId === "bullseye") {
        showBullseyeActivity();
      }

      if (activityId === "wait-for-it") {
        showWaitForItActivity();
      }

      if (activityId === "corner-hunt") {
        showCornerHuntActivity();
      }

      if (activityId === "color-match") {
        showColorMatchActivity();
      }

      if (activityId === "mouse-sprint") {
        showMouseSprintActivity();
      }

      if (activityId === "bubble-pop") {
        showBubblePopActivity();
      }

      if (activityId === "target-trail") {
        showTargetTrailActivity();
      }
    }
  );

  function showLessonView() {
    const homePage = document.querySelector(".home-page");

    if (homePage) {
      homePage.hidden = true;
    }

    getLessonContainer().hidden = false;
  }

  function getStepContent(step, safeIndex) {
    if (step.id === "week5-complete") {
      return `
        <div class="lesson-screen lesson-screen-week5-complete">

          <div class="week5-complete-burst">
            <span>⭐</span>
            <span>🎉</span>
            <span>⭐</span>
          </div>

          <div class="week5-complete-badge">
            WEEK 5 COMPLETE
          </div>

          <h1>
            Scrolling Master!
          </h1>

          <p class="week5-complete-message">
            You learned how to use the scroll wheel!
          </p>

          <div class="week5-complete-skills">

            <div class="week5-complete-skill">
              <div class="week5-complete-skill-icon">
                ↑
              </div>

              <strong>
                SCROLL UP
              </strong>
            </div>

            <div class="week5-complete-skill">

              <div
                class="week5-complete-mouse"
                aria-hidden="true"
              >
                <div class="week5-complete-mouse-left"></div>
                <div class="week5-complete-mouse-right"></div>

                <div class="week5-complete-wheel">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <strong>
                SCROLL WHEEL
              </strong>

            </div>

            <div class="week5-complete-skill">
              <div class="week5-complete-skill-icon">
                ↓
              </div>

              <strong>
                SCROLL DOWN
              </strong>
            </div>

          </div>

          <div class="week5-complete-review">

            <div>
              <span>🖱️</span>
              <strong>MOVE</strong>
            </div>

            <div>
              <span>👆</span>
              <strong>CLICK</strong>
            </div>

            <div>
              <span>✋</span>
              <strong>DRAG</strong>
            </div>

            <div>
              <span>↕️</span>
              <strong>SCROLL</strong>
            </div>

          </div>

          <div class="week5-complete-footer">
            Amazing work!
          </div>

        </div>
      `;
    }

    if (step.id === "week5-scroll-drag") {
      return `
        <div class="lesson-screen lesson-screen-week5-scroll-drag">

          <div class="week5-scroll-drag-heading">

            <span class="drag-review-badge">
              SCROLL + DRAG
            </span>

            <h1>Find It and Drag It!</h1>

            <p>
              Scroll to find the object, then drag it to the box.
            </p>

          </div>

          <div class="week5-scroll-drag-topbar">

            <strong>
              FIND:
            </strong>

            <div
              id="week5ScrollDragTarget"
              class="week5-scroll-drag-target"
            >
              <span>🎁</span>
              <strong>PRESENT</strong>
            </div>

            <div
              id="week5ScrollDragProgress"
              class="week5-scroll-drag-progress"
            >
              1 of 4
            </div>

          </div>

          <div class="week5-scroll-drag-layout">

            <div class="week5-scroll-drag-guide">

              <span>↑</span>

              <div
                class="week5-scroll-drag-guide-mouse"
                aria-hidden="true"
              >
                <div class="week5-scroll-drag-guide-left"></div>
                <div class="week5-scroll-drag-guide-right"></div>

                <div class="week5-scroll-drag-guide-wheel">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <strong>
                SCROLL
              </strong>

              <span>↓</span>

              <div class="week5-scroll-drag-plus">
                +
              </div>

              <div class="week5-scroll-drag-button">
                HOLD + DRAG
              </div>

            </div>

            <div
              id="week5ScrollDragViewport"
              class="week5-scroll-drag-viewport"
            >

              <div
                id="week5ScrollDragDestination"
                class="week5-scroll-drag-destination"
              >
                <span>🎂</span>
                <strong>DROP HERE</strong>
              </div>

              <div
                id="week5ScrollDragScene"
                class="week5-scroll-drag-scene"
              >

                <div
                  class="week5-scroll-drag-object"
                  data-scroll-drag-object="present"
                  style="top: 130px; left: 30%;"
                >
                  🎁
                </div>

                <div
                  class="week5-scroll-drag-object"
                  data-scroll-drag-object="duck"
                  style="top: 280px; left: 68%;"
                >
                  🦆
                </div>

                <div
                  class="week5-scroll-drag-object"
                  data-scroll-drag-object="book"
                  style="top: 445px; left: 32%;"
                >
                  📘
                </div>

                <div
                  class="week5-scroll-drag-object"
                  data-scroll-drag-object="frog"
                  style="top: 610px; left: 70%;"
                >
                  🐸
                </div>

                <div
                  class="week5-scroll-drag-object"
                  data-scroll-drag-object="ball"
                  style="top: 775px; left: 31%;"
                >
                  ⚽
                </div>

                <div
                  class="week5-scroll-drag-object"
                  data-scroll-drag-object="star"
                  style="top: 915px; left: 69%;"
                >
                  ⭐
                </div>

                <div
                  class="week5-scroll-drag-object"
                  data-scroll-drag-object="flower"
                  style="top: 1060px; left: 31%;"
                >
                  🌼
                </div>

              </div>

            </div>

          </div>

          <div
            id="week5ScrollDragStatus"
            class="week5-scroll-drag-status"
          >
            Find the PRESENT, then drag it to the box.
          </div>

        </div>
      `;
    }

    if (step.id === "week5-scroll-click") {
      return `
        <div class="lesson-screen lesson-screen-week5-scroll-click">

          <div class="week5-scroll-click-heading">

            <span class="drag-review-badge">
              SCROLL + CLICK
            </span>

            <h1>Find It and Click It!</h1>

            <p>
              Scroll to find the object, then LEFT-CLICK it.
            </p>

          </div>

          <div class="week5-scroll-click-topbar">

            <strong>
              FIND:
            </strong>

            <div
              id="week5ScrollClickTarget"
              class="week5-scroll-click-target"
            >
              <span>🎈</span>
              <strong>RED BALLOON</strong>
            </div>

            <div
              id="week5ScrollClickProgress"
              class="week5-scroll-click-progress"
            >
              1 of 4
            </div>

          </div>

          <div class="week5-scroll-click-layout">

            <div class="week5-scroll-click-guide">

              <span class="week5-scroll-click-up">
                ↑
              </span>

              <div
                class="week5-scroll-click-guide-mouse"
                aria-hidden="true"
              >
                <div class="week5-scroll-click-guide-left"></div>
                <div class="week5-scroll-click-guide-right"></div>

                <div class="week5-scroll-click-guide-wheel">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <strong>
                SCROLL
              </strong>

              <span class="week5-scroll-click-down">
                ↓
              </span>

              <div class="week5-scroll-click-plus">
                +
              </div>

              <div class="week5-scroll-click-button">
                LEFT CLICK
              </div>

            </div>

            <div
              id="week5ScrollClickViewport"
              class="week5-scroll-click-viewport"
            >

              <div
                id="week5ScrollClickScene"
                class="week5-scroll-click-scene"
              >

                <div
                  class="week5-scroll-click-object"
                  data-scroll-click-object="balloon"
                  style="top: 125px; left: 30%;"
                >
                  🎈
                </div>

                <div
                  class="week5-scroll-click-object"
                  data-scroll-click-object="duck"
                  style="top: 280px; left: 68%;"
                >
                  🦆
                </div>

                <div
                  class="week5-scroll-click-object"
                  data-scroll-click-object="monkey"
                  style="top: 420px; left: 32%;"
                >
                  🐵
                </div>

                <div
                  class="week5-scroll-click-object"
                  data-scroll-click-object="star"
                  style="top: 565px; left: 70%;"
                >
                  ⭐
                </div>

                <div
                  class="week5-scroll-click-object"
                  data-scroll-click-object="apple"
                  style="top: 735px; left: 31%;"
                >
                  🍎
                </div>

                <div
                  class="week5-scroll-click-object"
                  data-scroll-click-object="frog"
                  style="top: 875px; left: 69%;"
                >
                  🐸
                </div>

                <div
                  class="week5-scroll-click-object"
                  data-scroll-click-object="rocket"
                  style="top: 1030px; left: 32%;"
                >
                  🚀
                </div>

                <div
                  class="week5-scroll-click-object"
                  data-scroll-click-object="soccer"
                  style="top: 1160px; left: 70%;"
                >
                  ⚽
                </div>

              </div>

            </div>

          </div>

          <div
            id="week5ScrollClickStatus"
            class="week5-scroll-click-status"
          >
            Find and CLICK the RED BALLOON.
          </div>

        </div>
      `;
    }

    if (step.id === "week5-stop-target") {
      return `
        <div class="lesson-screen lesson-screen-week5-stop-target">

          <div class="week5-stop-target-heading">

            <span class="drag-review-badge">
              SCROLL CONTROL
            </span>

            <h1>Stop at the Target!</h1>

            <p>
              Scroll the elevator and stop on the glowing floor.
            </p>

          </div>

          <div class="week5-stop-target-layout">

            <div class="week5-stop-target-guide">

              <div class="week5-stop-target-guide-direction">
                <span>↑</span>
                <strong>UP</strong>
              </div>

              <div
                class="week5-stop-target-guide-mouse"
                aria-hidden="true"
              >
                <div class="week5-stop-target-guide-left"></div>
                <div class="week5-stop-target-guide-right"></div>

                <div class="week5-stop-target-guide-wheel">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <div class="week5-stop-target-guide-direction">
                <strong>DOWN</strong>
                <span>↓</span>
              </div>

            </div>

            <div
              id="week5StopTargetArea"
              class="week5-stop-target-area"
            >

              <div class="week5-stop-target-shaft">

                <div class="week5-stop-target-line floor-4">
                  <span>4</span>
                </div>

                <div class="week5-stop-target-line floor-3">
                  <span>3</span>
                </div>

                <div class="week5-stop-target-line floor-2">
                  <span>2</span>
                </div>

                <div class="week5-stop-target-line floor-1">
                  <span>1</span>
                </div>

                <div
                  id="week5StopTargetFloor"
                  class="week5-stop-target-floor"
                >
                  <strong>
                    FLOOR 4
                  </strong>
                </div>

                <div
                  id="week5StopTargetElevator"
                  class="week5-stop-target-elevator"
                >
                  <div class="week5-stop-target-elevator-window">
                    🙂
                  </div>

                  <strong>
                    ELEVATOR
                  </strong>
                </div>

              </div>

              <div class="week5-stop-target-building">
                🏢
              </div>

            </div>

          </div>

          <div class="week5-stop-target-footer">

            <div
              id="week5StopTargetStatus"
              class="week5-stop-target-status"
            >
              Stop at FLOOR 4.
            </div>

            <div
              id="week5StopTargetProgress"
              class="week5-stop-target-progress"
            >
              1 of 4
            </div>

          </div>

        </div>
      `;
    }

    if (step.id === "week5-scroll-practice") {
      return `
        <div class="lesson-screen lesson-screen-week5-scroll-practice">

          <div class="week5-scroll-practice-heading">
            <span class="drag-review-badge">
              SCROLL PRACTICE
            </span>

            <h1>Find the Animal!</h1>

            <p>
              Scroll UP or DOWN to find the animal.
            </p>
          </div>

          <div class="week5-scroll-practice-layout">

            <div class="week5-scroll-practice-guide">

              <div class="week5-scroll-practice-directions">
                <span>↑</span>
                <strong>UP</strong>
              </div>

              <div
                class="week5-scroll-practice-guide-mouse"
                aria-hidden="true"
              >
                <div class="week5-scroll-practice-guide-left"></div>
                <div class="week5-scroll-practice-guide-right"></div>

                <div class="week5-scroll-practice-guide-wheel">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <div class="week5-scroll-practice-directions">
                <strong>DOWN</strong>
                <span>↓</span>
              </div>

            </div>

            <div class="week5-scroll-practice-main">

              <div class="week5-scroll-practice-topbar">

                <strong>FIND:</strong>

                <div
                  id="week5ScrollPracticeTarget"
                  class="week5-scroll-practice-target"
                >
                  <span>🐸</span>
                  <strong>FROG</strong>
                </div>

                <div
                  id="week5ScrollPracticeProgress"
                  class="week5-scroll-practice-progress"
                >
                  1 of 4
                </div>

              </div>

              <div
                id="week5ScrollPracticeViewport"
                class="week5-scroll-practice-viewport"
              >

                <div class="week5-scroll-practice-center-zone">
                  <span>LOOK HERE</span>
                </div>

                <div
                  id="week5ScrollPracticeScene"
                  class="week5-scroll-practice-scene"
                >

                  <div
                    class="week5-scroll-practice-animal"
                    data-scroll-animal="frog"
                    style="top: 150px;"
                  >
                    🐸
                  </div>

                  <div
                    class="week5-scroll-practice-animal"
                    data-scroll-animal="owl"
                    style="top: 285px;"
                  >
                    🦉
                  </div>

                  <div
                    class="week5-scroll-practice-animal"
                    data-scroll-animal="monkey"
                    style="top: 430px;"
                  >
                    🐵
                  </div>

                  <div
                    class="week5-scroll-practice-animal"
                    data-scroll-animal="fox"
                    style="top: 600px;"
                  >
                    🦊
                  </div>

                  <div
                    class="week5-scroll-practice-animal"
                    data-scroll-animal="lion"
                    style="top: 780px;"
                  >
                    🦁
                  </div>

                  <div
                    class="week5-scroll-practice-animal"
                    data-scroll-animal="penguin"
                    style="top: 980px;"
                  >
                    🐧
                  </div>

                </div>

              </div>

            </div>

          </div>

          <div
            id="week5ScrollPracticeStatus"
            class="week5-scroll-practice-status"
          >
            Find the FROG.
          </div>

        </div>
      `;
    }

    if (step.id === "week5-scroll-up") {
      return `
        <div class="lesson-screen lesson-screen-week5-scroll-up">

          <div class="week5-scroll-up-heading">

            <span class="drag-review-badge">
              SCROLL UP
            </span>

            <h1>Reach the Treehouse!</h1>

            <p>
              Put your pointer in the window and roll the wheel UP.
            </p>

          </div>

          <div class="week5-scroll-up-layout">

            <div class="week5-scroll-up-guide">

              <div
                id="week5ScrollUpArrow"
                class="week5-scroll-up-arrow"
              >
                ↑
              </div>

              <strong>
                ROLL UP
              </strong>

              <div
                class="week5-scroll-up-guide-mouse"
                aria-hidden="true"
              >

                <div class="week5-scroll-up-guide-left"></div>
                <div class="week5-scroll-up-guide-right"></div>

                <div class="week5-scroll-up-guide-wheel">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

              </div>

            </div>

            <div
              id="week5ScrollUpViewport"
              class="week5-scroll-up-viewport"
            >

              <div
                id="week5ScrollUpScene"
                class="week5-scroll-up-scene"
              >

                <section class="week5-treehouse-top">

                  <div
                    id="week5ScrollUpTreehouse"
                    class="week5-scroll-treehouse"
                  >
                    🛖
                  </div>

                  <strong>
                    TREEHOUSE!
                  </strong>

                  <span class="week5-treehouse-bird">
                    🐦
                  </span>

                </section>

                <section class="week5-treehouse-high-branches">
                  <span>🍃</span>
                  <span>🐿️</span>
                  <span>🍃</span>
                  <span>🦉</span>
                </section>

                <section class="week5-treehouse-middle">
                  <span>🌿</span>
                  <span>🐦</span>
                  <span>🌳</span>
                  <span>🍎</span>
                </section>

                <section class="week5-treehouse-low-branches">
                  <span>🍂</span>
                  <span>🐛</span>
                  <span>🍃</span>
                  <span>🦋</span>
                </section>

                <section class="week5-treehouse-ground">

                  <span>🌻</span>
                  <span>🌳</span>
                  <span>🌼</span>

                  <strong>
                    START HERE
                  </strong>

                </section>

              </div>

            </div>

          </div>

          <div class="week5-scroll-up-progress-track">
            <div
              id="week5ScrollUpProgress"
              class="week5-scroll-up-progress-fill"
            ></div>
          </div>

          <div
            id="week5ScrollUpStatus"
            class="week5-scroll-up-status"
          >
            Roll the wheel UP.
          </div>

        </div>
      `;
    }

    if (step.id === "week5-scroll-down") {
      return `
        <div class="lesson-screen lesson-screen-week5-scroll-down">

          <div class="week5-scroll-down-heading">

            <span class="drag-review-badge">
              SCROLL DOWN
            </span>

            <h1>Find the Treasure!</h1>

            <p>
              Put your pointer in the window and roll the wheel DOWN.
            </p>

          </div>

          <div class="week5-scroll-down-layout">

            <div class="week5-scroll-down-guide">

              <div
                id="week5ScrollDownArrow"
                class="week5-scroll-down-arrow"
              >
                ↓
              </div>

              <strong>
                ROLL DOWN
              </strong>

              <div
                class="week5-scroll-guide-mouse"
                aria-hidden="true"
              >
                <div class="week5-scroll-guide-left"></div>
                <div class="week5-scroll-guide-right"></div>

                <div class="week5-scroll-guide-wheel">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

            </div>

            <div
              id="week5ScrollDownViewport"
              class="week5-scroll-down-viewport"
            >

              <div
                id="week5ScrollDownScene"
                class="week5-scroll-down-scene"
              >

                <section class="week5-treasure-sky">
                  <div class="week5-treasure-sun">
                    ☀️
                  </div>

                  <div class="week5-treasure-cloud cloud-a">
                    ☁️
                  </div>

                  <div class="week5-treasure-cloud cloud-b">
                    ☁️
                  </div>

                  <strong>
                    START HERE
                  </strong>
                </section>

                <section class="week5-treasure-treetops">
                  <span>🌴</span>
                  <span>🦜</span>
                  <span>🌴</span>
                </section>

                <section class="week5-treasure-jungle">
                  <span>🌿</span>
                  <span>🐒</span>
                  <span>🌺</span>
                  <span>🦋</span>
                </section>

                <section class="week5-treasure-beach">
                  <span>🏝️</span>

                  <div class="week5-treasure-path">
                    • • • • •
                  </div>
                </section>

                <section class="week5-treasure-bottom">

                  <div
                    id="week5ScrollDownTreasure"
                    class="week5-scroll-treasure"
                  >
                    🧰
                  </div>

                  <strong>
                    TREASURE!
                  </strong>

                </section>

              </div>

            </div>

          </div>

          <div class="week5-scroll-down-progress-track">
            <div
              id="week5ScrollDownProgress"
              class="week5-scroll-down-progress-fill"
            ></div>
          </div>

          <div
            id="week5ScrollDownStatus"
            class="week5-scroll-down-status"
          >
            Roll the wheel DOWN.
          </div>

        </div>
      `;
    }

    if (step.id === "week5-meet-wheel") {
      return `
        <div class="lesson-screen lesson-screen-week5-meet-wheel">

          <div class="week5-wheel-heading">

            <span class="drag-review-badge">
              NEW SKILL
            </span>

            <h1>Meet the Scroll Wheel</h1>

            <p>
              This little wheel moves a page up and down.
            </p>

          </div>

          <div class="week5-wheel-demo">

            <div
              id="week5MeetWheelUp"
              class="week5-wheel-direction week5-wheel-direction-up"
            >
              <span>▲</span>
              <strong>UP</strong>
            </div>

            <div class="week5-wheel-mouse-wrap">

              <div class="week5-wheel-mouse">

                <div class="week5-wheel-left-button"></div>

                <div class="week5-wheel-right-button"></div>

                <div
                  id="week5MeetWheel"
                  class="week5-wheel-wheel"
                >
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

              </div>

              <div
                id="week5MeetWheelFinger"
                class="week5-wheel-hand"
                aria-hidden="true"
              >
                <div class="mouse-demo-palm"></div>

                <div
                  class="
                    mouse-demo-finger
                    mouse-demo-index
                    week5-wheel-index
                  "
                ></div>

                <div
                  class="
                    mouse-demo-finger
                    mouse-demo-middle
                  "
                ></div>

                <div
                  class="
                    mouse-demo-finger
                    week5-wheel-ring
                  "
                ></div>

                <div
                  class="
                    mouse-demo-finger
                    mouse-demo-pinky
                  "
                ></div>

                <div
                  class="week5-wheel-thumb"
                ></div>
              </div>

            </div>

            <div
              id="week5MeetWheelDown"
              class="week5-wheel-direction week5-wheel-direction-down"
            >
              <strong>DOWN</strong>
              <span>▼</span>
            </div>

          </div>

          <div
            id="week5MeetWheelMessage"
            class="week5-wheel-message"
          >
            This is the SCROLL WHEEL.
          </div>

          <div class="week5-wheel-reminder">
            <span>🖱️</span>
            <strong>ROLL — DON'T CLICK</strong>
          </div>

        </div>
      `;
    }

    if (step.id === "week5-quick-review") {
      return `
        <div class="lesson-screen lesson-screen-week5-quick-review">

          <div class="week5-review-heading">
            <span class="drag-review-badge">
              QUICK REVIEW
            </span>

            <h1>What Do We Already Know?</h1>

            <p>
              Watch the mouse skills we have learned.
            </p>
          </div>

          <div class="week5-visual-review-steps">

            <div
              class="week5-visual-review-step"
              data-week5-review-step="move"
            >
              <strong>1</strong>
              <span>MOVE</span>
            </div>

            <div
              class="week5-visual-review-step"
              data-week5-review-step="click"
            >
              <strong>2</strong>
              <span>CLICK</span>
            </div>

            <div
              class="week5-visual-review-step"
              data-week5-review-step="hold"
            >
              <strong>3</strong>
              <span>HOLD</span>
            </div>

            <div
              class="week5-visual-review-step"
              data-week5-review-step="drag"
            >
              <strong>4</strong>
              <span>DRAG</span>
            </div>

            <div
              class="week5-visual-review-step"
              data-week5-review-step="release"
            >
              <strong>5</strong>
              <span>LET GO</span>
            </div>

          </div>

          <div class="week5-visual-review-demo">

            <div class="week5-visual-review-action">

              <div
                id="week5ReviewObject"
                class="week5-visual-review-object"
              >
                ★
              </div>

              <div
                id="week5ReviewDestination"
                class="week5-visual-review-destination"
              >
                ☆
              </div>

              <div
                id="week5ReviewPointer"
                class="week5-visual-review-pointer"
              >
                ➤
              </div>

            </div>

            <div class="week5-visual-review-mouse-side">

              <div
                id="week5ReviewMouse"
                class="week5-visual-review-mouse"
              >
                <div
                  id="week5ReviewLeftButton"
                  class="week5-visual-review-left-button"
                ></div>

                <div class="week5-visual-review-right-button"></div>

                <div class="week5-visual-review-wheel"></div>
              </div>

              <div
                id="week5ReviewMessage"
                class="week5-visual-review-message"
              >
                MOVE the mouse.
              </div>

            </div>

          </div>

        </div>
      `;
    }

    if (step.id === "week4-complete") {
      return `
        <div class="lesson-screen lesson-screen-week4-complete">

          <div class="week4-complete-stars">
            ✦ ★ ✦
          </div>

          <div class="week4-complete-trophy">
            🏆
          </div>

          <h1>
            Drag Master!
          </h1>

          <p class="week4-complete-message">
            You learned how to control, drag, and drop with the mouse!
          </p>

          <div class="week4-complete-recap">

            <div class="week4-complete-recap-item">
              <span class="week4-complete-recap-icon">
                👆
              </span>
              <strong>POINT</strong>
            </div>

            <div class="week4-complete-arrow">
              ➜
            </div>

            <div class="week4-complete-recap-item">
              <span class="week4-complete-recap-icon">
                🖱️
              </span>
              <strong>PRESS</strong>
            </div>

            <div class="week4-complete-arrow">
              ➜
            </div>

            <div class="week4-complete-recap-item">
              <span class="week4-complete-recap-icon">
                ✊
              </span>
              <strong>HOLD</strong>
            </div>

            <div class="week4-complete-arrow">
              ➜
            </div>

            <div class="week4-complete-recap-item">
              <span class="week4-complete-recap-icon">
                ➤
              </span>
              <strong>MOVE</strong>
            </div>

            <div class="week4-complete-arrow">
              ➜
            </div>

            <div class="week4-complete-recap-item">
              <span class="week4-complete-recap-icon">
                ✋
              </span>
              <strong>LET GO</strong>
            </div>

          </div>

          <div class="week4-complete-banner">
            ⭐ CLICK & DRAG COMPLETE ⭐
          </div>

        </div>
      `;
    }

    if (step.id === "week4-challenge") {
      return `
        <div class="lesson-screen lesson-screen-week4-challenge">

          <div class="week4-challenge-heading">
            <span class="drag-review-badge">
              FINAL CHALLENGE
            </span>

            <h1>Drag Master Challenge</h1>

            <p>
              Show what you can do!
            </p>
          </div>

          <div class="week4-challenge-meta">
            <span id="week4ChallengeRoundLabel">
              Round 1
            </span>

            <strong id="week4ChallengeProgress">
              1 of 5
            </strong>
          </div>

          <div
            id="week4ChallengeArea"
            class="week4-challenge-area"
          >

            <div
              id="week4ChallengeStage"
              class="week4-challenge-stage"
            ></div>

            <div
              id="week4ChallengePointer"
              class="week4-challenge-pointer"
            >
              ➤
            </div>

            <div
              id="week4ChallengeStatus"
              class="week4-challenge-status"
            >
              Drag the star into the box.
            </div>

          </div>

        </div>
      `;
    }

    if (step.id === "week4-activities") {
      return `
        <div class="lesson-screen lesson-screen-week4-activities">

          <div class="week4-activities-heading">
            <span class="drag-review-badge">
              QUICK ACTIVITIES
            </span>

            <h1>Choose an Activity</h1>

            <p>
              Pick a game and practice your dragging.
            </p>
          </div>


          <div
            id="week4ActivitiesHub"
            class="week4-activities-hub"
          >

            <button
              class="week4-activity-card"
              type="button"
              data-week4-activity="feed-animals"
            >
              <span class="week4-activity-icon">
                🐶
              </span>

              <strong>
                Feed the Animals
              </strong>

              <span>
                Match each animal with its food.
              </span>
            </button>


            <button
              class="week4-activity-card"
              type="button"
              data-week4-activity="build-robot"
            >
              <span class="week4-activity-icon">
                🤖
              </span>

              <strong>
                Build a Robot
              </strong>

              <span>
                Put the robot pieces together.
              </span>
            </button>


            <button
              class="week4-activity-card"
              type="button"
              data-week4-activity="make-pizza"
            >
              <span class="week4-activity-icon">
                🍕
              </span>

              <strong>
                Make a Pizza
              </strong>

              <span>
                Create your own pizza.
              </span>
            </button>

          </div>


          <div
            id="week4ActivityView"
            class="week4-activity-view"
            hidden
          ></div>

        </div>
      `;
    }

    if (step.id === "week4-moving-targets") {
      return `
        <div class="lesson-screen lesson-screen-week4-moving">

          <div class="week4-moving-heading">
            <span class="drag-review-badge">
              CHALLENGE
            </span>

            <h1>Moving Targets</h1>

            <p>
              Drag the object into the moving box and LET GO.
            </p>
          </div>

          <div class="week4-moving-progress">
            Round:
            <strong id="week4MovingProgress">
              1 of 5
            </strong>
          </div>

          <div
            id="week4MovingArea"
            class="week4-moving-area"
          >

            <div
              id="week4MovingObject"
              class="week4-moving-object"
              style="left: 18%; top: 50%;"
            >
              ★
            </div>

            <div
              id="week4MovingDestination"
              class="
                week4-moving-destination
                week4-moving-size-large
                week4-moving-drift-a
              "
            >
              DROP HERE
            </div>

            <div
              id="week4MovingPointer"
              class="week4-moving-pointer"
            >
              ➤
            </div>

            <div
              id="week4MovingStatus"
              class="week4-moving-status"
            >
              Drag the object into the moving target.
            </div>

          </div>


          <div
            class="week4-moving-reference"
            aria-hidden="true"
          >
            <div class="week4-moving-reference-label">
              HOLD & MOVE
            </div>

            <div class="week4-moving-reference-visual">

              <div
                class="mouse-demo-hand hold-mouse-hand week4-moving-reference-hand"
              >
                <div class="mouse-demo-palm"></div>

                <div
                  class="mouse-demo-finger mouse-demo-index"
                ></div>

                <div
                  class="mouse-demo-finger mouse-demo-middle"
                ></div>

                <div
                  class="mouse-demo-finger mouse-demo-pinky"
                ></div>
              </div>

              <div class="mouse-demo-body">

                <div
                  class="mouse-demo-left week4-moving-reference-button"
                ></div>

                <div class="mouse-demo-right"></div>
                <div class="mouse-demo-wheel"></div>

              </div>

            </div>
          </div>

        </div>
      `;
    }

    if (step.id === "week4-puzzle") {
      return `
        <div class="lesson-screen lesson-screen-week4-puzzle">

          <div class="week4-puzzle-heading">
            <span class="drag-review-badge">
              PUZZLE
            </span>

            <h1>Puzzle Pieces</h1>

            <p>
              Drag each piece into its matching spot.
            </p>
          </div>

          <div class="week4-puzzle-progress">
            Pieces:
            <strong id="week4PuzzleProgress">
              0 of 4
            </strong>
          </div>

          <div
            id="week4PuzzleArea"
            class="week4-puzzle-area"
          >

            <!-- PUZZLE PIECES -->

            <div
              class="
                week4-puzzle-piece
                week4-mouse-piece
                week4-mouse-piece-tl
              "
              data-match="mouse-tl"
              style="left: 34%; top: 72%;"
            >
              <div class="week4-mouse-fragment mouse-fragment-tl"></div>
            </div>

            <div
              class="
                week4-puzzle-piece
                week4-mouse-piece
                week4-mouse-piece-tr
              "
              data-match="mouse-tr"
              style="left: 14%; top: 72%;"
            >
              <div class="week4-mouse-fragment mouse-fragment-tr"></div>
            </div>

            <div
              class="
                week4-puzzle-piece
                week4-mouse-piece
                week4-mouse-piece-bl
              "
              data-match="mouse-bl"
              style="left: 34%; top: 27%;"
            >
              <div class="week4-mouse-fragment mouse-fragment-bl"></div>
            </div>

            <div
              class="
                week4-puzzle-piece
                week4-mouse-piece
                week4-mouse-piece-br
              "
              data-match="mouse-br"
              style="left: 14%; top: 27%;"
            >
              <div class="week4-mouse-fragment mouse-fragment-br"></div>
            </div>


            <!-- MOUSE PUZZLE BOARD -->

            <div class="week4-puzzle-board week4-mouse-puzzle-board">

              <div
                class="week4-puzzle-slot week4-mouse-slot slot-tl"
                data-match="mouse-tl"
              ></div>

              <div
                class="week4-puzzle-slot week4-mouse-slot slot-tr"
                data-match="mouse-tr"
              ></div>

              <div
                class="week4-puzzle-slot week4-mouse-slot slot-bl"
                data-match="mouse-bl"
              ></div>

              <div
                class="week4-puzzle-slot week4-mouse-slot slot-br"
                data-match="mouse-br"
              ></div>

            </div>


            <div
              id="week4PuzzlePointer"
              class="week4-puzzle-pointer"
            >
              ➤
            </div>

            <div
              id="week4PuzzleStatus"
              class="week4-puzzle-status"
            >
              Choose a puzzle piece.
            </div>

          </div>


          <div
            class="week4-puzzle-reference"
            aria-hidden="true"
          >
            <div class="week4-puzzle-reference-label">
              HOLD & MOVE
            </div>

            <div class="week4-puzzle-reference-visual">

              <div
                class="mouse-demo-hand hold-mouse-hand week4-puzzle-reference-hand"
              >
                <div class="mouse-demo-palm"></div>

                <div
                  class="mouse-demo-finger mouse-demo-index"
                ></div>

                <div
                  class="mouse-demo-finger mouse-demo-middle"
                ></div>

                <div
                  class="mouse-demo-finger mouse-demo-pinky"
                ></div>
              </div>

              <div class="mouse-demo-body">

                <div
                  class="mouse-demo-left week4-puzzle-reference-button"
                ></div>

                <div class="mouse-demo-right"></div>
                <div class="mouse-demo-wheel"></div>

              </div>

            </div>
          </div>

        </div>
      `;
    }

    if (step.id === "week4-clean-up") {
      return `
        <div class="lesson-screen lesson-screen-week4-clean">

          <div class="week4-clean-heading">
            <span class="drag-review-badge">
              CLEAN UP!
            </span>

            <h1>Clean Up the Classroom</h1>

            <p>
              Put each classroom item where it belongs.
            </p>
          </div>

          <div class="week4-clean-progress">
            Put away:
            <strong id="week4CleanUpProgress">
              0 of 4
            </strong>
          </div>

          <div
            id="week4CleanUpArea"
            class="week4-clean-area"
          >

            <!-- SCATTERED ITEMS -->

            <div
              class="week4-clean-object"
              data-match="book"
              style="left: 13%; top: 25%;"
            >
              📘
              <span>BOOK</span>
            </div>

            <div
              class="week4-clean-object"
              data-match="headphones"
              style="left: 34%; top: 29%;"
            >
              🎧
              <span>HEADPHONES</span>
            </div>

            <div
              class="week4-clean-object"
              data-match="teddy"
              style="left: 16%; top: 69%;"
            >
              🧸
              <span>TEDDY</span>
            </div>

            <div
              class="week4-clean-object"
              data-match="pencil"
              style="left: 37%; top: 73%;"
            >
              ✏️
              <span>PENCIL</span>
            </div>


            <!-- DESTINATIONS -->

            <div
              class="
                week4-clean-destination
                week4-clean-bookshelf
              "
              data-match="book"
            >
              <div class="week4-clean-bookshelf-visual">
                <i></i>
                <i></i>
                <i></i>
              </div>

              <strong>BOOKSHELF</strong>
            </div>

            <div
              class="
                week4-clean-destination
                week4-clean-headphone-hook
              "
              data-match="headphones"
            >
              <div class="week4-clean-hook-visual">
                <span>🎧</span>
              </div>

              <strong>HEADPHONE HOOK</strong>
            </div>

            <div
              class="
                week4-clean-destination
                week4-clean-toy-bin
              "
              data-match="teddy"
            >
              <div class="week4-clean-toy-bin-visual">
                TOYS
              </div>

              <strong>TOY BIN</strong>
            </div>

            <div
              class="
                week4-clean-destination
                week4-clean-pencil-cup
              "
              data-match="pencil"
            >
              <div class="week4-clean-pencil-cup-visual">
                <i></i>
                <i></i>
                <i></i>
              </div>

              <strong>PENCIL CUP</strong>
            </div>


            <div
              id="week4CleanUpPointer"
              class="week4-clean-pointer"
            >
              ➤
            </div>

            <div
              id="week4CleanUpStatus"
              class="week4-clean-status"
            >
              Choose something to put away.
            </div>

          </div>


          <div
            class="week4-clean-reference"
            aria-hidden="true"
          >
            <div class="week4-clean-reference-label">
              HOLD & MOVE
            </div>

            <div class="week4-clean-reference-visual">

              <div
                class="mouse-demo-hand hold-mouse-hand week4-clean-reference-hand"
              >
                <div class="mouse-demo-palm"></div>

                <div
                  class="mouse-demo-finger mouse-demo-index"
                ></div>

                <div
                  class="mouse-demo-finger mouse-demo-middle"
                ></div>

                <div
                  class="mouse-demo-finger mouse-demo-pinky"
                ></div>
              </div>

              <div class="mouse-demo-body">

                <div
                  class="mouse-demo-left week4-clean-reference-button"
                ></div>

                <div class="mouse-demo-right"></div>
                <div class="mouse-demo-wheel"></div>

              </div>

            </div>
          </div>

        </div>
      `;
    }

    if (step.id === "week4-sort") {
      return `
        <div class="lesson-screen lesson-screen-week4-sort">

          <div class="week4-sort-heading">
            <span class="drag-review-badge">
              SORT IT!
            </span>

            <h1>School or Toy?</h1>

            <p>
              Drag each item into the group where it belongs.
            </p>
          </div>

          <div class="week4-sort-progress">
            Sorted:
            <strong id="week4SortProgress">
              0 of 6
            </strong>
          </div>

          <div
            id="week4SortArea"
            class="week4-sort-area"
          >

            <div class="week4-sort-items">

              <div
                class="week4-sort-object"
                data-category="school"
                style="left: 30%; top: 22%;"
              >
                ✏️
                <span>PENCIL</span>
              </div>

              <div
                class="week4-sort-object"
                data-category="toy"
                style="left: 13%; top: 22%;"
              >
                🧸
                <span>TEDDY</span>
              </div>

              <div
                class="week4-sort-object"
                data-category="school"
                style="left: 13%; top: 51%;"
              >
                📘
                <span>BOOK</span>
              </div>

              <div
                class="week4-sort-object"
                data-category="toy"
                style="left: 30%; top: 51%;"
              >
                ⚽
                <span>BALL</span>
              </div>

              <div
                class="week4-sort-object"
                data-category="school"
                style="left: 30%; top: 80%;"
              >
                🖍️
                <span>CRAYON</span>
              </div>

              <div
                class="week4-sort-object"
                data-category="toy"
                style="left: 13%; top: 80%;"
              >
                🪀
                <span>YO-YO</span>
              </div>

            </div>


            <div
              class="week4-sort-bin week4-sort-school-bin"
              data-category="school"
            >
              <div class="week4-sort-bin-icon">
                🎒
              </div>

              <strong>
                SCHOOL
              </strong>

              <span>
                Things we use for learning
              </span>
            </div>


            <div
              class="week4-sort-bin week4-sort-toy-bin"
              data-category="toy"
            >
              <div class="week4-sort-bin-icon">
                🧸
              </div>

              <strong>
                TOYS
              </strong>

              <span>
                Things we play with
              </span>
            </div>


            <div
              id="week4SortPointer"
              class="week4-sort-pointer"
            >
              ➤
            </div>

            <div
              id="week4SortStatus"
              class="week4-sort-status"
            >
              Choose an item to sort.
            </div>

          </div>


          <div
            class="week4-sort-reference"
            aria-hidden="true"
          >
            <div class="week4-sort-reference-label">
              HOLD & MOVE
            </div>

            <div class="week4-sort-reference-visual">

              <div
                class="mouse-demo-hand hold-mouse-hand week4-sort-reference-hand"
              >
                <div class="mouse-demo-palm"></div>

                <div
                  class="mouse-demo-finger mouse-demo-index"
                ></div>

                <div
                  class="mouse-demo-finger mouse-demo-middle"
                ></div>

                <div
                  class="mouse-demo-finger mouse-demo-pinky"
                ></div>
              </div>

              <div class="mouse-demo-body">

                <div
                  class="mouse-demo-left week4-sort-reference-button"
                ></div>

                <div class="mouse-demo-right"></div>
                <div class="mouse-demo-wheel"></div>

              </div>

            </div>
          </div>

        </div>
      `;
    }

    if (step.id === "week4-warm-up") {
      return `
        <div class="lesson-screen lesson-screen-week4-backpack">

          <div class="week4-backpack-heading">
            <span class="drag-review-badge">
              WARM-UP
            </span>

            <h1>Pack the Backpack</h1>

            <p>
              Drag all three school items into the backpack.
            </p>
          </div>

          <div class="week4-backpack-progress">
            Packed:
            <strong id="week4BackpackProgress">
              0 of 3
            </strong>
          </div>

          <div
            id="week4BackpackArea"
            class="week4-backpack-area"
          >

            <div
              class="week4-backpack-object"
              data-item="pencil"
              style="left: 18%; top: 27%;"
            >
              ✏️

              <span>PENCIL</span>
            </div>

            <div
              class="week4-backpack-object"
              data-item="notebook"
              style="left: 24%; top: 58%;"
            >
              📓

              <span>NOTEBOOK</span>
            </div>

            <div
              class="week4-backpack-object"
              data-item="headphones"
              style="left: 15%; top: 82%;"
            >
              🎧

              <span>HEADPHONES</span>
            </div>


            <div
              id="week4Backpack"
              class="week4-backpack"
            >
              <div class="week4-backpack-handle"></div>

              <div class="week4-backpack-body">
                <div class="week4-backpack-pocket">
                  SCHOOL
                </div>

                <div
                  id="week4BackpackPackedItems"
                  class="week4-backpack-packed-items"
                ></div>
              </div>

              <strong>
                BACKPACK
              </strong>
            </div>


            <div
              id="week4BackpackPointer"
              class="week4-backpack-pointer"
            >
              ➤
            </div>

            <div
              id="week4BackpackStatus"
              class="week4-backpack-status"
            >
              Choose a school item to pack.
            </div>

          </div>


          <div
            class="week4-backpack-reference"
            aria-hidden="true"
          >
            <div class="week4-backpack-reference-label">
              HOLD & MOVE
            </div>

            <div class="week4-backpack-reference-visual">

              <div
                class="mouse-demo-hand hold-mouse-hand week4-backpack-reference-hand"
              >
                <div class="mouse-demo-palm"></div>

                <div
                  class="mouse-demo-finger mouse-demo-index"
                ></div>

                <div
                  class="mouse-demo-finger mouse-demo-middle"
                ></div>

                <div
                  class="mouse-demo-finger mouse-demo-pinky"
                ></div>
              </div>

              <div class="mouse-demo-body">

                <div
                  class="mouse-demo-left week4-backpack-reference-button"
                ></div>

                <div class="mouse-demo-right"></div>
                <div class="mouse-demo-wheel"></div>

              </div>

            </div>
          </div>

        </div>
      `;
    }

    if (step.id === "week4-quick-review") {
      return `
        <div class="lesson-screen lesson-screen-week4-quick-review">

          <div class="week4-review-heading">
            <span class="drag-review-badge">
              QUICK REVIEW
            </span>

            <h1>Remember How to Drag?</h1>

            <p>
              Watch the whole drag motion again.
            </p>
          </div>

          <div class="week4-review-steps">

            <div
              class="week4-review-step"
              data-week4-drag-step="point"
            >
              <strong>1</strong>
              <span>POINT</span>
            </div>

            <div
              class="week4-review-step"
              data-week4-drag-step="press"
            >
              <strong>2</strong>
              <span>PRESS</span>
            </div>

            <div
              class="week4-review-step"
              data-week4-drag-step="hold"
            >
              <strong>3</strong>
              <span>HOLD</span>
            </div>

            <div
              class="week4-review-step"
              data-week4-drag-step="move"
            >
              <strong>4</strong>
              <span>MOVE</span>
            </div>

            <div
              class="week4-review-step"
              data-week4-drag-step="release"
            >
              <strong>5</strong>
              <span>LET GO</span>
            </div>

          </div>

          <div class="week4-review-demo">

            <div class="week4-review-hand-side">

              <div
                id="week4ReviewMessage"
                class="week4-review-message"
              >
                POINT to the object.
              </div>

              <div class="week4-review-mouse-visual">

                <div
                  id="week4ReviewHand"
                  class="mouse-demo-hand hold-mouse-hand week4-review-hand"
                >
                  <div class="mouse-demo-palm"></div>

                  <div
                    id="week4ReviewFinger"
                    class="mouse-demo-finger mouse-demo-index"
                  ></div>

                  <div
                    class="mouse-demo-finger mouse-demo-middle"
                  ></div>

                  <div
                    class="mouse-demo-finger mouse-demo-pinky"
                  ></div>
                </div>

                <div class="mouse-demo-body">

                  <div
                    id="week4ReviewLeftButton"
                    class="mouse-demo-left"
                  ></div>

                  <div class="mouse-demo-right"></div>
                  <div class="mouse-demo-wheel"></div>

                </div>

              </div>

            </div>

            <div class="week4-review-action">

              <div
                id="week4ReviewObject"
                class="week4-review-object"
              >
                ★
              </div>

              <div
                id="week4ReviewDestination"
                class="week4-review-destination"
              >
                DROP HERE
              </div>

              <div
                id="week4ReviewPointer"
                class="week4-review-pointer"
              >
                ➤
              </div>

            </div>

          </div>

        </div>
      `;
    }

    if (step.id === "drag-complete") {
      return `
        <div class="lesson-screen lesson-screen-drag-complete">

          <div class="drag-complete-card">

            <div class="drag-complete-trophy">
              🏆
            </div>

            <div class="drag-complete-stars">
              ✦ ★ ✦
            </div>

            <h1>Dragging Master!</h1>

            <p class="drag-complete-message">
              You learned how to click and drag!
            </p>

            <div class="drag-complete-steps">

              <div>
                <strong>1</strong>

                <div class="drag-recap-picture recap-point">
                  <span class="recap-star">★</span>
                  <span class="recap-pointer">➤</span>
                </div>

                <span>POINT</span>
              </div>

              <div>
                <strong>2</strong>

                <div class="drag-recap-picture recap-press">
                  <span class="recap-mini-mouse">
                    <i class="recap-left-button"></i>
                  </span>
                  <span class="recap-finger">☝</span>
                </div>

                <span>PRESS</span>
              </div>

              <div>
                <strong>3</strong>

                <div class="drag-recap-picture recap-hold">
                  <span class="recap-mini-mouse">
                    <i class="recap-left-button"></i>
                  </span>
                  <span class="recap-hold-ring"></span>
                </div>

                <span>HOLD</span>
              </div>

              <div>
                <strong>4</strong>

                <div class="drag-recap-picture recap-move">
                  <span>★</span>
                  <b>→</b>
                </div>

                <span>MOVE</span>
              </div>

              <div>
                <strong>5</strong>

                <div class="drag-recap-picture recap-release">
                  <span>★</span>
                  <i></i>
                </div>

                <span>LET GO</span>
              </div>

            </div>

            <div class="drag-complete-footer">
              Great work!
            </div>

          </div>

        </div>
      `;
    }

    if (step.id === "drag-challenge") {
      return `
        <div class="lesson-screen lesson-screen-drag-challenge">

          <div class="drag-challenge-heading">

            <span class="drag-review-badge">
              CHALLENGE
            </span>

            <h1>Click & Drag Challenge</h1>

            <p>
              Show what you can do!
            </p>

          </div>

          <div class="drag-challenge-progress">
            Round
            <strong id="dragChallengeProgress">
              1 of 4
            </strong>
          </div>

          <div
            id="dragChallengeArea"
            class="drag-challenge-area"
          >

            <div
              id="dragChallengeTarget"
              class="drag-challenge-target"
            >
              ⭐
            </div>

            <div
              id="dragChallengeDestination"
              class="drag-challenge-destination"
            >
              <div class="drag-challenge-destination-icon">
                🌙
              </div>

              <strong>
                NIGHT SKY
              </strong>
            </div>

            <div
              id="dragChallengePointer"
              class="drag-challenge-pointer"
            >
              ➤
            </div>

            <div
              id="dragChallengeStatus"
              class="drag-challenge-status"
            >
              Drag it to the matching place!
            </div>

          </div>

        </div>
      `;
    }

    if (step.id === "drag-and-drop") {
      return `
        <div class="lesson-screen lesson-screen-drag-drop">

          <div class="drag-drop-heading">
            <span class="drag-review-badge">
              PRACTICE
            </span>

            <h1>Drag & Drop</h1>

            <p>
              Drag each object to where it belongs.
            </p>
          </div>

          <div class="drag-drop-progress">
            Finished:
            <strong id="dragDropProgress">
              0 of 3
            </strong>
          </div>

          <div
            id="dragDropArea"
            class="drag-drop-area"
          >

            <!-- OBJECTS -->

            <div
              class="drag-drop-object"
              data-match="pencil"
              style="left: 13%; top: 25%;"
            >
              ✏️
            </div>

            <div
              class="drag-drop-object"
              data-match="book"
              style="left: 13%; top: 50%;"
            >
              📘
            </div>

            <div
              class="drag-drop-object"
              data-match="toy"
              style="left: 13%; top: 75%;"
            >
              🧸
            </div>


            <!-- DESTINATIONS -->

            <div
              class="
                drag-drop-destination
                drag-drop-pencil-cup
              "
              data-match="pencil"
            >
              <div class="drag-pencil-cup">
                <span></span>
                <span></span>
                <span></span>
              </div>

              <strong>PENCIL CUP</strong>
            </div>


            <div
              class="
                drag-drop-destination
                drag-drop-bookshelf
              "
              data-match="book"
            >
              <div class="drag-bookshelf">
                <span></span>
                <span></span>
                <span></span>
              </div>

              <strong>BOOKSHELF</strong>
            </div>


            <div
              class="
                drag-drop-destination
                drag-drop-toybox
              "
              data-match="toy"
            >
              <div class="drag-toybox">
                TOYS
              </div>

              <strong>TOY BOX</strong>
            </div>


            <div
              class="drag-drop-corner-reference"
              aria-hidden="true"
            >
              <div class="drag-drop-reference-label">
                HOLD & MOVE
              </div>

              <div class="drag-drop-reference-visual">

                <div
                  class="mouse-demo-hand hold-mouse-hand drag-drop-reference-hand"
                >
                  <div class="mouse-demo-palm"></div>

                  <div
                    class="mouse-demo-finger mouse-demo-index drag-drop-reference-finger"
                  ></div>

                  <div
                    class="mouse-demo-finger mouse-demo-middle"
                  ></div>

                  <div
                    class="mouse-demo-finger mouse-demo-pinky"
                  ></div>
                </div>

                <div class="mouse-demo-body">
                  <div
                    class="mouse-demo-left drag-drop-reference-button"
                  ></div>

                  <div class="mouse-demo-right"></div>
                  <div class="mouse-demo-wheel"></div>
                </div>

              </div>
            </div>

            <div
              id="dragDropPointer"
              class="drag-drop-pointer"
            >
              ➤
            </div>

            <div
              id="dragDropStatus"
              class="drag-drop-status"
            >
              Pick an object to start.
            </div>

          </div>

        </div>
      `;
    }

    if (step.id === "drag-practice") {
      return `
        <div class="lesson-screen lesson-screen-drag-practice">

          <div class="drag-practice-heading">
            <span class="drag-review-badge">
              PRACTICE
            </span>

            <h1>Drag Practice</h1>

            <p>
              Use the whole skill three times.
            </p>
          </div>

          <div class="drag-practice-layout">

            <div class="drag-practice-hand-side">

              <div
                id="dragPracticeHandMessage"
                class="drag-practice-hand-message"
              >
                Press, hold, move, then let go.
              </div>

              <div
                class="hold-mouse-visual drag-practice-hand-visual"
              >

                <div
                  class="mouse-demo-hand hold-mouse-hand drag-practice-hand"
                >
                  <div class="mouse-demo-palm"></div>

                  <div
                    id="dragPracticeFinger"
                    class="mouse-demo-finger mouse-demo-index"
                  ></div>

                  <div
                    class="mouse-demo-finger mouse-demo-middle"
                  ></div>

                  <div
                    class="mouse-demo-finger mouse-demo-pinky"
                  ></div>
                </div>

                <div class="mouse-demo-body">

                  <div
                    id="dragPracticeLeftButton"
                    class="mouse-demo-left"
                  ></div>

                  <div class="mouse-demo-right"></div>
                  <div class="mouse-demo-wheel"></div>

                </div>

              </div>

            </div>

            <div class="drag-practice-side">

              <div class="drag-practice-progress">
                Round
                <strong id="dragPracticeProgress">
                  1 of 3
                </strong>
              </div>

              <div
                id="dragPracticeArea"
                class="drag-practice-area"
              >

                <div
                  id="dragPracticeTarget"
                  class="drag-practice-target"
                >
                  ★
                </div>

                <div
                  id="dragPracticeDestination"
                  class="drag-practice-destination"
                >
                  <span
                    id="dragPracticeDestinationIcon"
                    class="drag-practice-destination-icon"
                  >
                    📦
                  </span>

                  <strong
                    id="dragPracticeDestinationLabel"
                  >
                    BOX
                  </strong>
                </div>

                <div
                  id="dragPracticePointer"
                  class="drag-practice-pointer"
                >
                  ➤
                </div>

                <div
                  id="dragPracticeStatus"
                  class="drag-practice-status"
                >
                  Move to the object.
                </div>

              </div>

            </div>

          </div>

        </div>
      `;
    }

    if (step.id === "let-go") {
      return `
        <div class="lesson-screen lesson-screen-let-go">

          <div class="let-go-heading">
            <span class="drag-review-badge">
              PRACTICE
            </span>

            <h1>Let Go</h1>

            <p>
              Drag the star into the box, then LET GO.
            </p>
          </div>

          <div class="let-go-layout">

            <div class="let-go-hand-side">

              <div
                id="letGoHandMessage"
                class="let-go-hand-message"
              >
                Keep holding until you reach the box.
              </div>

              <div class="hold-mouse-visual let-go-hand-visual">

                <div
                  class="mouse-demo-hand hold-mouse-hand let-go-hand"
                >
                  <div class="mouse-demo-palm"></div>

                  <div
                    id="letGoFinger"
                    class="mouse-demo-finger mouse-demo-index"
                  ></div>

                  <div
                    class="mouse-demo-finger mouse-demo-middle"
                  ></div>

                  <div
                    class="mouse-demo-finger mouse-demo-pinky"
                  ></div>
                </div>

                <div class="mouse-demo-body">
                  <div
                    id="letGoLeftButton"
                    class="mouse-demo-left"
                  ></div>

                  <div class="mouse-demo-right"></div>
                  <div class="mouse-demo-wheel"></div>
                </div>

              </div>
            </div>

            <div class="let-go-practice-side">

              <div
                id="letGoArea"
                class="let-go-area"
              >

                <div
                  id="letGoTarget"
                  class="let-go-target"
                >
                  ★
                </div>

                <div
                  id="letGoDestination"
                  class="let-go-destination"
                >
                  DROP HERE
                </div>

                <div
                  id="letGoPointer"
                  class="let-go-pointer"
                >
                  ➤
                </div>

                <div
                  id="letGoStatus"
                  class="let-go-status"
                >
                  Move to the star.
                </div>

              </div>

            </div>

          </div>

        </div>
      `;
    }

    if (step.id === "hold-and-move") {
      return `
        <div class="lesson-screen lesson-screen-hold-move">

          <div class="hold-move-heading">
            <span class="drag-review-badge">
              PRACTICE
            </span>

            <h1>Hold & Move</h1>

            <p>
              Keep the left button DOWN while you move.
            </p>
          </div>

          <div class="hold-move-layout">

            <div class="hold-move-hand-side">

              <div class="hold-move-hand-message">
                Keep your pointer finger DOWN!
              </div>

              <div class="hold-mouse-visual hold-move-hand-visual">

                <div
                  id="holdMoveHand"
                  class="mouse-demo-hand hold-mouse-hand hold-move-hand"
                >
                  <div class="mouse-demo-palm"></div>

                  <div
                    id="holdMoveFinger"
                    class="
                      mouse-demo-finger
                      mouse-demo-index
                    "
                  ></div>

                  <div
                    class="
                      mouse-demo-finger
                      mouse-demo-middle
                    "
                  ></div>

                  <div
                    class="
                      mouse-demo-finger
                      mouse-demo-pinky
                    "
                  ></div>
                </div>

                <div class="mouse-demo-body">

                  <div
                    id="holdMoveLeftButton"
                    class="mouse-demo-left"
                  ></div>

                  <div class="mouse-demo-right"></div>
                  <div class="mouse-demo-wheel"></div>

                </div>

              </div>

            </div>

            <div class="hold-move-practice-side">

              <div
                id="holdMoveArea"
                class="hold-move-area"
              >

                <div
                  id="holdMoveTarget"
                  class="hold-move-target"
                >
                  ★
                </div>

                <div
                  id="holdMoveDestination"
                  class="hold-move-destination"
                >
                  MOVE HERE
                </div>

                <div
                  id="holdMovePointer"
                  class="hold-move-pointer"
                >
                  ➤
                </div>

                <div
                  id="holdMoveStatus"
                  class="hold-move-status"
                >
                  Move to the star.
                </div>

              </div>

            </div>

          </div>

        </div>
      `;
    }

    if (step.id === "press-and-hold") {
      return `
        <div class="lesson-screen lesson-screen-press-hold">

          <div class="press-hold-heading">
            <span class="drag-review-badge">
              PRACTICE
            </span>

            <h1>Press & Hold</h1>

            <p>
              Press the left button and KEEP holding it down.
            </p>
          </div>

          <div class="press-hold-layout">

            <div class="press-hold-hand-side">

              <div class="hold-mouse-visual press-hold-hand-visual">

                <div
                  id="pressHoldHand"
                  class="mouse-demo-hand hold-mouse-hand press-hold-hand"
                >
                  <div class="mouse-demo-palm"></div>

                  <div
                    id="pressHoldFinger"
                    class="
                      mouse-demo-finger
                      mouse-demo-index
                    "
                  ></div>

                  <div
                    class="
                      mouse-demo-finger
                      mouse-demo-middle
                    "
                  ></div>

                  <div
                    class="
                      mouse-demo-finger
                      mouse-demo-pinky
                    "
                  ></div>
                </div>

                <div class="mouse-demo-body">
                  <div
                    id="pressHoldLeftButton"
                    class="mouse-demo-left"
                  ></div>

                  <div class="mouse-demo-right"></div>
                  <div class="mouse-demo-wheel"></div>
                </div>

              </div>

              <div
                id="pressHoldHandMessage"
                class="press-hold-hand-message"
              >
                Your pointer finger presses the left button.
              </div>

            </div>

            <div class="press-hold-practice-side">

              <div
                id="pressHoldArea"
                class="press-hold-area"
              >
                <div
                  id="pressHoldTarget"
                  class="press-hold-target"
                >
                  ★
                </div>

                <div
                  id="pressHoldPointer"
                  class="press-hold-pointer"
                >
                  ➤
                </div>

                <div
                  id="pressHoldStatus"
                  class="press-hold-status"
                >
                  Move to the star.
                </div>

                <div class="press-hold-meter">
                  <div
                    id="pressHoldMeterFill"
                    class="press-hold-meter-fill"
                  ></div>
                </div>
              </div>

            </div>

          </div>

        </div>
      `;
    }

    if (step.id === "meet-click-drag") {
      return `
        <div class="lesson-screen lesson-screen-meet-drag">

          <div class="meet-drag-heading">
            <span class="drag-review-badge">
              NEW SKILL
            </span>

            <h1>Meet Click & Drag</h1>

            <p>
              Press, hold, move, then let go.
            </p>
          </div>

          <div class="meet-drag-stage">

            <div class="meet-drag-hand-side">

              <div class="hold-mouse-visual meet-drag-hand-visual">

                <div
                  id="meetDragHand"
                  class="mouse-demo-hand hold-mouse-hand meet-drag-hand"
                >
                  <div class="mouse-demo-palm"></div>

                  <div
                    id="meetDragFinger"
                    class="
                      mouse-demo-finger
                      mouse-demo-index
                      meet-drag-index
                    "
                  ></div>

                  <div
                    class="
                      mouse-demo-finger
                      mouse-demo-middle
                    "
                  ></div>

                  <div
                    class="
                      mouse-demo-finger
                      mouse-demo-pinky
                    "
                  ></div>
                </div>

                <div class="mouse-demo-body">
                  <div
                    id="meetDragLeftButton"
                    class="
                      mouse-demo-left
                      meet-drag-left-button
                    "
                  ></div>

                  <div class="mouse-demo-right"></div>
                  <div class="mouse-demo-wheel"></div>
                </div>

              </div>

              <div
                id="meetDragHandMessage"
                class="meet-drag-hand-message"
              >
                Get ready...
              </div>

            </div>

            <div class="meet-drag-demo-side">

              <div
                id="meetDragArea"
                class="meet-drag-area"
              >
                <div
                  id="meetDragObject"
                  class="meet-drag-object"
                >
                  ★
                </div>

                <div
                  id="meetDragDestination"
                  class="meet-drag-destination"
                >
                  DROP HERE
                </div>

                <div
                  id="meetDragPointer"
                  class="meet-drag-pointer"
                >
                  ➤
                </div>
              </div>

            </div>

          </div>

          <div class="meet-drag-steps">

            <div
              class="meet-drag-step"
              data-drag-demo-step="point"
            >
              <strong>1</strong>
              <span>POINT</span>
            </div>

            <div
              class="meet-drag-step"
              data-drag-demo-step="hold"
            >
              <strong>2</strong>
              <span>PRESS & HOLD</span>
            </div>

            <div
              class="meet-drag-step"
              data-drag-demo-step="move"
            >
              <strong>3</strong>
              <span>MOVE</span>
            </div>

            <div
              class="meet-drag-step"
              data-drag-demo-step="release"
            >
              <strong>4</strong>
              <span>LET GO</span>
            </div>

          </div>

        </div>
      `;
    }

    if (step.id === "drag-quick-review") {
      return `
        <div class="lesson-screen lesson-screen-drag-review">

          <div class="drag-review-heading">
            <span class="drag-review-badge">
              QUICK REVIEW
            </span>

            <h1>Remember Your Mouse Skills</h1>

            <p>
              Before we learn something new, let's remember the basics.
            </p>
          </div>

          <div class="drag-review-grid">

            <section class="drag-review-card">

              <div class="drag-review-number">
                1
              </div>

              <div class="drag-review-visual drag-review-hand">

                <div class="hold-mouse-visual">

                  <div class="mouse-demo-hand hold-mouse-hand">
                    <div class="mouse-demo-palm"></div>

                    <div class="
                      mouse-demo-finger
                      mouse-demo-index
                    "></div>

                    <div class="
                      mouse-demo-finger
                      mouse-demo-middle
                    "></div>

                    <div class="
                      mouse-demo-finger
                      mouse-demo-pinky
                    "></div>
                  </div>

                  <div class="mouse-demo-body">
                    <div class="mouse-demo-left"></div>
                    <div class="mouse-demo-right"></div>
                    <div class="mouse-demo-wheel"></div>
                  </div>

                </div>

              </div>

              <h2>Hold the Mouse</h2>

              <p>
                Rest your hand gently on the mouse.
              </p>

            </section>

            <section class="drag-review-card">

              <div class="drag-review-number">
                2
              </div>

              <div class="drag-review-move-demo">

                <div class="drag-review-move-arrow">
                  ↔
                </div>

                <div class="drag-review-big-pointer">
                  ➤
                </div>

              </div>

              <h2>Move the Mouse</h2>

              <p>
                Move the mouse to move the pointer.
              </p>

            </section>

            <section class="drag-review-card">

              <div class="drag-review-number">
                3
              </div>

              <div class="drag-review-click-demo">

                <div class="hold-mouse-visual">

                  <div class="
                    mouse-demo-hand
                    drag-review-click-hand
                  ">
                    <div class="mouse-demo-palm"></div>

                    <div class="
                      mouse-demo-finger
                      mouse-demo-index
                      drag-review-pointer-finger
                    "></div>

                    <div class="
                      mouse-demo-finger
                      mouse-demo-middle
                    "></div>

                    <div class="
                      mouse-demo-finger
                      mouse-demo-pinky
                    "></div>
                  </div>

                  <div class="mouse-demo-body">
                    <div class="
                      mouse-demo-left
                      drag-review-left-button
                    "></div>

                    <div class="mouse-demo-right"></div>
                    <div class="mouse-demo-wheel"></div>
                  </div>

                </div>

              </div>

              <h2>Left Click</h2>

              <p>
                Click once with your pointer finger.
              </p>

            </section>

          </div>

          <p class="drag-review-footer">
            Great! Now let's learn a new mouse skill.
          </p>

        </div>
      `;
    }

    if (step.id === "review-week1") {
      return `
        <div class="lesson-screen lesson-screen-review-board">

          <div class="review-board-heading">
            <span class="review-board-badge">QUICK REVIEW</span>
            <h1>Show What You Remember!</h1>
          </div>

          <div class="review-board-grid">

            <section class="review-card review-card-hand">

              <div class="review-card-number">1</div>

              <div class="review-card-visual">
                <div class="hold-mouse-visual review-hand-visual">

                  <div class="mouse-demo-hand hold-mouse-hand">
                    <div class="mouse-demo-palm"></div>
                    <div class="mouse-demo-finger mouse-demo-index highlight-pointer"></div>
                    <div class="mouse-demo-finger mouse-demo-middle highlight-middle"></div>
                    <div class="mouse-demo-finger mouse-demo-pinky highlight-other"></div>
                  </div>

                  <div class="mouse-demo-body">
                    <div class="mouse-demo-left"></div>
                    <div class="mouse-demo-right"></div>
                    <div class="mouse-demo-wheel"></div>
                  </div>

                </div>
              </div>

              <h2>Hold the Mouse</h2>
              <p>Show where your fingers belong.</p>

            </section>

            <section class="review-card review-card-move">

              <div class="review-card-number">2</div>

              <div id="reviewMoveArea" class="review-move-area">

                <div class="review-direction review-up">
                  <span>🐄</span>
                  <strong>UP</strong>
                </div>

                <div class="review-direction review-right">
                  <span>🐕</span>
                  <strong>RIGHT</strong>
                </div>

                <div class="review-direction review-down">
                  <span>🐈</span>
                  <strong>DOWN</strong>
                </div>

                <div class="review-direction review-left">
                  <span>🐖</span>
                  <strong>LEFT</strong>
                </div>

                <div
                  id="reviewMovePointer"
                  class="pointer-demo-icon"
                >
                  ➤
                </div>

              </div>

              <h2>Move the Mouse</h2>

              <p>
                Move to the glowing animal.
              </p>

            </section>

            <section class="review-card review-card-click">

              <div class="review-card-number">3</div>

              <div id="reviewClickArea" class="review-click-area">

                <button
                  id="reviewClickTarget"
                  class="review-click-target"
                  type="button"
                >
                  ★
                </button>

                <div
                  id="reviewClickPointer"
                  class="pointer-demo-icon"
                >
                  ➤
                </div>

              </div>

              <h2>Move & Left Click</h2>
              <p>Point to the star and click once.</p>

            </section>

          </div>

        </div>
      `;
    }

    if (step.id === "complete") {
      return `
        <div class="lesson-screen lesson-screen-complete">

          <div class="lesson-complete-content">

            <div class="lesson-complete-badge">
              ★
            </div>

            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Mouse Master!</h1>

            <p class="lesson-complete-message">
              You finished your first mouse lesson!
            </p>

            <div class="lesson-complete-skills">

              <div class="complete-skill">
                <span class="complete-skill-icon">↔</span>
                <strong>Move</strong>
              </div>

              <div class="complete-skill">
                <span class="complete-skill-icon">➤</span>
                <strong>Point</strong>
              </div>

              <div class="complete-skill">
                <span class="complete-skill-icon">☝</span>
                <strong>Left Click</strong>
              </div>

            </div>

            <p class="lesson-complete-footer">
              Great job using the mouse!
            </p>

          </div>

        </div>
      `;
    }

    if (step.id === "guided-practice") {
      return `
        <div class="lesson-screen lesson-screen-mouse-challenge">
          ${renderMouseHandReference()}

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Mouse Challenge</h1>

            <p class="lesson-instruction">
              Move to each target and left-click once.
            </p>
          </div>

          <div id="mouseChallengeArea" class="mouse-challenge-area">

            <button
              id="mouseChallengeTarget"
              class="mouse-challenge-target"
              type="button"
            >
              ★
            </button>

            <div
              id="mouseChallengePointer"
              class="pointer-demo-icon"
            >
              ➤
            </div>

          </div>

          <div id="mouseChallengeProgress" class="mouse-challenge-progress">
            0 of 5
          </div>

          <p id="mouseChallengeStatus" class="lesson-coaching">
            Find the first target.
          </p>

        </div>
      `;
    }

    if (step.id === "move-and-click") {
      return `
        <div class="lesson-screen lesson-screen-move-and-click">
          ${renderMouseHandReference()}

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Move & Click</h1>

            <p class="lesson-instruction">
              Move to the target. Then left-click once.
            </p>
          </div>

          <div id="moveClickArea" class="move-click-area">

            <button
              id="moveClickTarget"
              class="move-click-target"
              type="button"
            >
              ★
            </button>

            <div
              id="moveClickPointer"
              class="pointer-demo-icon"
            >
              ➤
            </div>

          </div>

          <div class="click-practice-progress">
            <span id="moveClickDot1" class="click-practice-dot"></span>
            <span id="moveClickDot2" class="click-practice-dot"></span>
            <span id="moveClickDot3" class="click-practice-dot"></span>
          </div>

          <p id="moveClickStatus" class="lesson-coaching">
            Find the target.
          </p>

        </div>
      `;
    }

    if (step.id === "left-click-practice") {
      return `
        <div class="lesson-screen lesson-screen-left-click-practice">
          ${renderMouseHandReference()}

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Left-Click Practice</h1>

            <p class="lesson-instruction">
              Point to the target and left-click.
            </p>
          </div>

          <div class="left-click-practice-area">

            <button
              id="leftClickPracticeTarget"
              class="left-click-practice-target"
              type="button"
            >
              ★
            </button>

          </div>

          <div class="click-practice-progress">
            <span id="clickPracticeDot1" class="click-practice-dot"></span>
            <span id="clickPracticeDot2" class="click-practice-dot"></span>
            <span id="clickPracticeDot3" class="click-practice-dot"></span>
          </div>

          <p id="leftClickPracticeStatus" class="lesson-coaching">
            Click the star 3 times.
          </p>

        </div>
      `;
    }

    if (step.id === "left-click") {
      return `
        <div class="lesson-screen lesson-screen-left-click">

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Left Click</h1>

            <p class="lesson-instruction">
              Press the left button one time.
            </p>
          </div>

          <div class="left-click-demo">

            <div class="hold-mouse-visual">

              <div id="leftClickHand" class="mouse-demo-hand left-click-hand">
                <div class="mouse-demo-palm"></div>
                <div id="leftClickFinger" class="mouse-demo-finger mouse-demo-index"></div>
                <div class="mouse-demo-finger mouse-demo-middle"></div>
                <div class="mouse-demo-finger mouse-demo-pinky"></div>
              </div>

              <div class="mouse-demo-body">
                <div id="leftClickButtonVisual" class="mouse-demo-left"></div>
                <div class="mouse-demo-right"></div>
                <div class="mouse-demo-wheel"></div>
              </div>

            </div>

            <div class="left-click-instruction-card">
              <strong>Click once</strong>
              <p>Press down and let go.</p>
            </div>

          </div>

          <p id="leftClickStatus" class="lesson-coaching">
            Try one left click.
          </p>

        </div>
      `;
    }

    if (step.id === "left-button") {
      return `
        <div class="lesson-screen lesson-screen-left-button">

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Meet the Left Button</h1>

            <p class="lesson-instruction">
              Your pointer finger rests on the left mouse button.
            </p>
          </div>

          <div class="left-button-demo">

            <div class="hold-mouse-visual left-button-mouse-visual">

              <div class="mouse-demo-hand left-button-hand">
                <div class="mouse-demo-palm"></div>
                <div class="mouse-demo-finger mouse-demo-index left-button-finger"></div>
                <div class="mouse-demo-finger mouse-demo-middle"></div>
                <div class="mouse-demo-finger mouse-demo-pinky"></div>
              </div>

              <div class="mouse-demo-body">
                <div class="mouse-demo-left left-button-highlight"></div>
                <div class="mouse-demo-right"></div>
                <div class="mouse-demo-wheel"></div>
              </div>

            </div>

            <div class="left-button-explanation">
              <div class="left-button-label">
                <span class="left-button-label-dot"></span>
                <strong>Left Button</strong>
              </div>

              <p>
                Use your pointer finger for a left click.
              </p>
            </div>

          </div>

          <p class="lesson-coaching">
            Rest your finger gently. Do not click yet.
          </p>

        </div>
      `;
    }

    if (step.id === "movement-practice") {
      return `
        <div class="lesson-screen lesson-screen-movement-practice">
          ${renderMouseHandReference()}

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Movement Practice</h1>

            <p id="movementPracticeInstruction" class="lesson-instruction">
              Move to the cow.
            </p>
          </div>

          <div class="movement-practice-board" id="movementPracticeArea">

            <div class="direction-target practice-target direction-up" data-direction="up">
              <span class="direction-animal">🐄</span>
              <strong>UP</strong>
            </div>

            <div class="direction-target practice-target direction-right" data-direction="right">
              <span class="direction-animal">🐕</span>
              <strong>RIGHT</strong>
            </div>

            <div class="direction-target practice-target direction-down" data-direction="down">
              <span class="direction-animal">🐈</span>
              <strong>DOWN</strong>
            </div>

            <div class="direction-target practice-target direction-left" data-direction="left">
              <span class="direction-animal">🐖</span>
              <strong>LEFT</strong>
            </div>

            <div id="movementPracticePointer" class="pointer-demo-icon">➤</div>

          </div>

          <p id="movementPracticeStatus" class="lesson-coaching">
            Follow the directions.
          </p>

        </div>
      `;
    }

    if (step.id === "move-the-mouse") {
      return `
        <div class="lesson-screen lesson-screen-move-mouse">

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Move the Mouse</h1>

            <p class="lesson-instruction">
              Move the mouse up, down, left, and right.
            </p>
          </div>

          <div class="meet-mouse-visuals">

            <div class="mouse-demo">
              <div id="lessonMouseMovement" class="mouse-movement-demo">
                <div class="mouse-demo-hand">
                  <div class="mouse-demo-palm"></div>
                  <div class="mouse-demo-finger mouse-demo-index"></div>
                  <div class="mouse-demo-finger mouse-demo-middle"></div>
                  <div class="mouse-demo-finger mouse-demo-pinky"></div>
                </div>

                <div class="mouse-demo-body">
                  <div class="mouse-demo-left"></div>
                  <div class="mouse-demo-right"></div>
                  <div class="mouse-demo-wheel"></div>
                </div>
              </div>

              <p>Move the Mouse</p>
            </div>

            <div class="mouse-demo-arrow">
              →
            </div>

            <div class="pointer-demo">
              <div id="pointerPracticeArea" class="pointer-practice-area direction-practice-area">

                <div class="direction-target direction-up">
                  <span class="direction-animal">🐄</span>
                  <strong>UP</strong>
                </div>

                <div class="direction-target direction-right">
                  <span class="direction-animal">🐕</span>
                  <strong>RIGHT</strong>
                </div>

                <div class="direction-target direction-down">
                  <span class="direction-animal">🐈</span>
                  <strong>DOWN</strong>
                </div>

                <div class="direction-target direction-left">
                  <span class="direction-animal">🐖</span>
                  <strong>LEFT</strong>
                </div>

                <div id="lessonDemoPointer" class="pointer-demo-icon">➤</div>
              </div>

              <p>Move the Pointer</p>
            </div>

          </div>

          <p class="lesson-coaching">
            Try moving slowly in every direction.
          </p>

        </div>
      `;
    }

    if (step.id === "hold-the-mouse") {
      return `
        <div class="lesson-screen lesson-screen-hold-mouse">

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>How to Hold the Mouse</h1>

            <p class="lesson-instruction">
              Rest your hand gently on the mouse.
            </p>
          </div>

          <div class="hold-mouse-demo">

            <div class="hold-mouse-visual">
              <div class="mouse-demo-hand hold-mouse-hand">
                <div class="mouse-demo-palm highlight-palm"></div>
                <div class="mouse-demo-finger mouse-demo-index highlight-pointer"></div>
                <div class="mouse-demo-finger mouse-demo-middle highlight-middle"></div>
                <div class="mouse-demo-finger mouse-demo-pinky highlight-other"></div>
              </div>

              <div class="mouse-demo-body">
                <div class="mouse-demo-left"></div>
                <div class="mouse-demo-right"></div>
                <div class="mouse-demo-wheel"></div>
              </div>
            </div>

            <div class="finger-guide">
              <div class="finger-guide-item">
                <span class="finger-number">1</span>
                <span>Thumb rests on the side</span>
              </div>

              <div class="finger-guide-item">
                <span class="finger-number">2</span>
                <span>Pointer finger rests on the left button</span>
              </div>

              <div class="finger-guide-item">
                <span class="finger-number">3</span>
                <span>Middle finger rests on the right button</span>
              </div>

              <div class="finger-guide-item">
                <span class="finger-number">4–5</span>
                <span>Other fingers rest along the side</span>
              </div>
            </div>

          </div>

          <p class="lesson-coaching">
            Keep your hand relaxed. You do not need to squeeze the mouse.
          </p>

        </div>
      `;
    }

    if (step.id === "meet-the-mouse") {
      return `
        <div class="lesson-screen lesson-screen-meet-mouse">

          <div class="lesson-screen-heading">
            <p class="student-lesson-progress">
              Step ${safeIndex + 1} of ${lesson.steps.length}
            </p>

            <h1>Meet the Mouse</h1>

            <p class="lesson-instruction">
              Move the mouse. Watch the pointer move.
            </p>
          </div>

          <div class="meet-mouse-visuals">

            <div class="mouse-demo">
              <div id="lessonMouseMovement" class="mouse-movement-demo">
                <div class="mouse-demo-hand">
                  <div class="mouse-demo-palm"></div>
                  <div class="mouse-demo-finger mouse-demo-index"></div>
                  <div class="mouse-demo-finger mouse-demo-middle"></div>
                  <div class="mouse-demo-finger mouse-demo-pinky"></div>
                </div>

                <div class="mouse-demo-body">
                  <div class="mouse-demo-left"></div>
                  <div class="mouse-demo-right"></div>
                  <div class="mouse-demo-wheel"></div>
                </div>
              </div>

              <p>Move the Mouse</p>
            </div>

            <div class="mouse-demo-arrow">
              →
            </div>

            <div class="pointer-demo">
              <div id="pointerPracticeArea" class="pointer-practice-area">
                <div id="lessonDemoPointer" class="pointer-demo-icon">➤</div>
              </div>
              <p>Pointer</p>
            </div>

          </div>

          <p class="lesson-coaching">
            When you move the mouse, the pointer moves on the screen.
          </p>

        </div>
      `;
    }

    if (step.id === "week6-quick-review") {
      return `
        <div class="lesson-screen lesson-screen-week6-quick-review">

          <div class="week6-review-heading">
            <span class="drag-review-badge">
              QUICK REVIEW
            </span>

            <h1>What Do We Remember About Scrolling?</h1>

            <p>
              Remember what the scroll wheel can do.
            </p>
          </div>

          <div class="week6-review-cards">

            <div
              id="week6ReviewWheelCard"
              class="week6-review-card week6-review-card-wheel"
            >
              <strong>1</strong>

              <div
                class="week6-review-mouse"
                aria-hidden="true"
              >
                <div class="week6-review-mouse-left"></div>
                <div class="week6-review-mouse-right"></div>

                <div
                  id="week6ReviewWheel"
                  class="week6-review-wheel"
                >
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <span>SCROLL WHEEL</span>
            </div>

            <div
              id="week6ReviewDownCard"
              class="week6-review-card"
            >
              <strong>2</strong>

              <div class="week6-review-direction">
                ↓
              </div>

              <span>SCROLL DOWN</span>
            </div>

            <div
              id="week6ReviewUpCard"
              class="week6-review-card"
            >
              <strong>3</strong>

              <div class="week6-review-direction">
                ↑
              </div>

              <span>SCROLL UP</span>
            </div>

          </div>

          <div
            id="week6ReviewMessage"
            class="week6-review-message"
          >
            Find the SCROLL WHEEL.
          </div>

          <div class="week6-review-reminder">
            <span>🖱️</span>
            <strong>ROLL — DON'T CLICK</strong>
          </div>

        </div>
      `;
    }

    if (step.id === "week6-warm-up") {
      return `
        <div class="lesson-screen lesson-screen-week6-warm-up">

          <div class="week6-warm-up-heading">

            <span class="drag-review-badge">
              SCROLL WARM-UP
            </span>

            <h1>Up, Down, Stop!</h1>

            <p>
              Scroll the ball to the glowing target and stop.
            </p>

          </div>

          <div class="week6-warm-up-layout">

            <div class="week6-warm-up-guide">

              <div
                id="week6WarmUpInstruction"
                class="week6-warm-up-instruction"
              >
                <span>↓</span>
                <strong>
                  SCROLL TO THE BOTTOM
                </strong>
              </div>

              <div
                class="week6-warm-up-guide-mouse"
                aria-hidden="true"
              >
                <div class="week6-warm-up-guide-left"></div>
                <div class="week6-warm-up-guide-right"></div>

                <div class="week6-warm-up-guide-wheel">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <div
                id="week6WarmUpProgress"
                class="week6-warm-up-progress"
              >
                1 of 4
              </div>

            </div>

            <div
              id="week6WarmUpArea"
              class="week6-warm-up-area"
            >

              <div
                id="week6WarmUpTrack"
                class="week6-warm-up-track"
              >

                <div
                  id="week6WarmUpTopTarget"
                  class="week6-warm-up-target week6-warm-up-target-top"
                >
                  <span>TOP</span>
                </div>

                <div class="week6-warm-up-track-line"></div>

                <div
                  id="week6WarmUpBall"
                  class="week6-warm-up-ball"
                >
                  ⭐
                </div>

                <div
                  id="week6WarmUpBottomTarget"
                  class="week6-warm-up-target week6-warm-up-target-bottom"
                >
                  <span>BOTTOM</span>
                </div>

              </div>

            </div>

          </div>

          <div
            id="week6WarmUpStatus"
            class="week6-warm-up-status"
          >
            Scroll to the BOTTOM, then STOP.
          </div>

        </div>
      `;
    }

    if (step.id === "week6-precision") {
      return `
        <div class="lesson-screen lesson-screen-week6-precision">

          <div class="week6-precision-heading">

            <span class="drag-review-badge">
              PRECISION SCROLLING
            </span>

            <h1>Park the Rocket!</h1>

            <p>
              Use small scrolls and stop inside the landing zone.
            </p>

          </div>

          <div class="week6-precision-layout">

            <div class="week6-precision-guide">

              <span class="week6-precision-arrow">
                ↑
              </span>

              <div
                class="week6-precision-guide-mouse"
                aria-hidden="true"
              >
                <div class="week6-precision-guide-left"></div>
                <div class="week6-precision-guide-right"></div>

                <div class="week6-precision-guide-wheel">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <strong>
                SMALL
                <br>
                SCROLLS
              </strong>

              <span class="week6-precision-arrow">
                ↓
              </span>

              <div
                id="week6PrecisionProgress"
                class="week6-precision-progress"
              >
                1 of 4
              </div>

            </div>

            <div
              id="week6PrecisionArea"
              class="week6-precision-area"
            >

              <div class="week6-precision-space-star star-one">
                ✦
              </div>

              <div class="week6-precision-space-star star-two">
                ✦
              </div>

              <div class="week6-precision-space-star star-three">
                ✦
              </div>

              <div class="week6-precision-flight-line"></div>

              <div
                id="week6PrecisionTarget"
                class="week6-precision-target"
              >
                <div
                  id="week6PrecisionBand"
                  class="week6-precision-band"
                ></div>
                <span>
                  ◎
                </span>

                <strong
                  id="week6PrecisionTargetLabel"
                >
                  LANDING ZONE
                </strong>
              </div>

              <div
                id="week6PrecisionRocket"
                class="week6-precision-rocket"
              >
                🚀
              </div>

            </div>

          </div>

          <div
            id="week6PrecisionStatus"
            class="week6-precision-status"
          >
            Scroll the rocket into the landing zone, then STOP.
          </div>

        </div>
      `;
    }

    if (step.id === "week6-scroll-click") {
      return `
        <div class="lesson-screen lesson-screen-week6-treasure">

          <div class="week6-treasure-heading">

            <span class="drag-review-badge">
              SCROLL + CLICK
            </span>

            <h1>Treasure Hunt!</h1>

            <p>
              Scroll to search, then left-click the treasure.
            </p>

          </div>

          <div class="week6-treasure-topbar">

            <strong>FIND:</strong>

            <div
              id="week6TreasureTarget"
              class="week6-treasure-target-display"
            >
              <span>🔑</span>
              <strong>KEY</strong>
            </div>

            <div
              id="week6TreasureProgress"
              class="week6-treasure-progress"
            >
              1 of 5
            </div>

          </div>

          <div
            id="week6TreasureViewport"
            class="week6-treasure-viewport"
          >

            <div
              id="week6TreasureScene"
              class="week6-treasure-scene"
            >

              <div class="week6-treasure-shelf shelf-one"></div>
              <div class="week6-treasure-shelf shelf-two"></div>
              <div class="week6-treasure-shelf shelf-three"></div>
              <div class="week6-treasure-shelf shelf-four"></div>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="key"
                style="top: 160px; left: 24%;"
              >🔑</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="book"
                style="top: 320px; left: 67%;"
              >📕</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="map"
                style="top: 500px; left: 34%;"
              >🗺️</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="apple"
                style="top: 680px; left: 72%;"
              >🍎</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="chest"
                style="top: 860px; left: 25%;"
              >🧰</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="ball"
                style="top: 1040px; left: 69%;"
              >⚽</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="gem"
                style="top: 1220px; left: 32%;"
              >💎</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="frog"
                style="top: 1380px; left: 71%;"
              >🐸</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="crown"
                style="top: 1540px; left: 28%;"
              >👑</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="star"
                style="top: 1660px; left: 68%;"
              >⭐</button>
              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="banana"
                style="top: 245px; left: 42%;"
              >🍌</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="clock"
                style="top: 410px; left: 82%;"
              >⏰</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="pencil"
                style="top: 560px; left: 58%;"
              >✏️</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="cookie"
                style="top: 645px; left: 18%;"
              >🍪</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="trophy"
                style="top: 760px; left: 47%;"
              >🏆</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="umbrella"
                style="top: 930px; left: 50%;"
              >☂️</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="car"
                style="top: 1005px; left: 18%;"
              >🚗</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="pizza"
                style="top: 1135px; left: 52%;"
              >🍕</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="bell"
                style="top: 1290px; left: 78%;"
              >🔔</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="fish"
                style="top: 1430px; left: 45%;"
              >🐟</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="moon"
                style="top: 1580px; left: 82%;"
              >🌙</button>

              <button
                type="button"
                class="week6-treasure-item"
                data-week6-treasure="gift"
                style="top: 1710px; left: 44%;"
              >🎁</button>

            </div>

          </div>

          <div
            id="week6TreasureStatus"
            class="week6-treasure-status"
          >
            Find and LEFT-CLICK the KEY.
          </div>

        </div>
      `;
    }
    if (step.id === "week6-scroll-drag") {
      return `
        <div class="lesson-screen lesson-screen-week6-delivery">

          <div class="week6-delivery-heading">

            <span class="drag-review-badge">
              SCROLL + DRAG
            </span>

            <h1>Deliver the Supplies!</h1>

            <p>
              Scroll to find the item, then drag it to the matching place.
            </p>

          </div>

          <div class="week6-delivery-topbar">

            <strong>FIND:</strong>

            <div
              id="week6DeliveryTarget"
              class="week6-delivery-target"
            >
              <span>🎒</span>
              <strong>BACKPACK</strong>
            </div>

            <div
              id="week6DeliveryProgress"
              class="week6-delivery-progress"
            >
              1 of 4
            </div>

          </div>

          <div
            id="week6DeliveryViewport"
            class="week6-delivery-viewport"
          >

            <div
              id="week6DeliveryDestination"
              class="week6-delivery-destination"
            >
              <span>🚌</span>
              <strong>BUS</strong>
            </div>

            <div
              id="week6DeliveryScene"
              class="week6-delivery-scene"
            >

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="backpack"
                style="top: 170px; left: 28%;"
              >🎒</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="pencil"
                style="top: 310px; left: 62%;"
              >✏️</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="book"
                style="top: 520px; left: 35%;"
              >📘</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="cookie"
                style="top: 700px; left: 68%;"
              >🍪</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="apple"
                style="top: 930px; left: 30%;"
              >🍎</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="star"
                style="top: 1120px; left: 67%;"
              >⭐</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="ball"
                style="top: 1380px; left: 34%;"
              >⚽</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="frog"
                style="top: 1580px; left: 69%;"
              >🐸</button>
              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="banana"
                style="top: 245px; left: 52%;"
              >🍌</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="clock"
                style="top: 390px; left: 20%;"
              >⏰</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="car"
                style="top: 455px; left: 72%;"
              >🚗</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="pizza"
                style="top: 620px; left: 27%;"
              >🍕</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="gift"
                style="top: 785px; left: 54%;"
              >🎁</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="bell"
                style="top: 850px; left: 76%;"
              >🔔</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="fish"
                style="top: 1010px; left: 53%;"
              >🐟</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="umbrella"
                style="top: 1190px; left: 24%;"
              >☂️</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="trophy"
                style="top: 1265px; left: 73%;"
              >🏆</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="moon"
                style="top: 1435px; left: 57%;"
              >🌙</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="cookie-two"
                style="top: 1515px; left: 19%;"
              >🍪</button>

              <button
                type="button"
                class="week6-delivery-item"
                data-week6-delivery="flower"
                style="top: 1680px; left: 48%;"
              >🌻</button>

            </div>

          </div>

          <div
            id="week6DeliveryStatus"
            class="week6-delivery-status"
          >
            Find the BACKPACK, then drag it to the BUS.
          </div>

        </div>
      `;
    }
    if (step.id === "week6-mixed-skills") {
      return `
        <div class="lesson-screen lesson-screen-week6-mixed">

          <div class="week6-mixed-heading">
            <span class="drag-review-badge">
              ROBOT REPAIR LAB
            </span>

            <h1>Build the Robot!</h1>

            <p>
              👀　💭　🤖
            </p>
          </div>

          <div class="week6-mixed-topbar">
            <div
              id="week6MixedTask"
              class="week6-mixed-task"
            >
              <span class="week6-mixed-picture-clue">
                🤖💤 <b>→</b> 🤖👀
              </span>
            </div>

            <div
              id="week6MixedProgress"
              class="week6-mixed-progress"
            >
              1 of 5
            </div>
          </div>

          <div
            id="week6MixedViewport"
            class="week6-mixed-viewport"
          >
            <div class="week6-mixed-supply-side">
              <div class="week6-mixed-supply-title">
                PARTS STORAGE
              </div>

              <div
                id="week6MixedScene"
                class="week6-mixed-scene"
              >
                <div class="week6-mixed-shelf shelf-a"></div>
                <div class="week6-mixed-shelf shelf-b"></div>
                <div class="week6-mixed-shelf shelf-c"></div>
                <div class="week6-mixed-shelf shelf-d"></div>

                <button
                  type="button"
                  class="week6-mixed-part"
                  data-week6-mixed-part="gear"
                  data-mixed-mission="2"
                  style="top: 190px; left: 30%;"
                >⚙️</button>

                <button
                  type="button"
                  class="week6-mixed-part"
                  data-week6-mixed-part="flashlight"
                  data-mixed-mission="2"
                  style="top: 350px; left: 70%;"
                >🔦</button>

                <button
                  type="button"
                  class="week6-mixed-part"
                  data-week6-mixed-part="battery"
                  data-mixed-mission="2"
                  style="top: 620px; left: 32%;"
                >🔋</button>

                <button
                  type="button"
                  class="week6-mixed-part"
                  data-week6-mixed-part="wrench"
                  data-mixed-mission="2"
                  style="top: 760px; left: 72%;"
                >🔧</button>

                <button
                  type="button"
                  class="week6-mixed-part"
                  data-week6-mixed-part="satellite"
                  data-mixed-mission="3"
                  style="top: 900px; left: 28%;"
                >🛰️</button>

                <button
                  type="button"
                  class="week6-mixed-part"
                  data-week6-mixed-part="antenna"
                  data-mixed-mission="3"
                  style="top: 1080px; left: 68%;"
                  aria-label="Robot antennas"
                >
                  <span
                    class="week6-mixed-antenna-piece"
                    aria-hidden="true"
                  >
                    <i></i>
                    <i></i>
                  </span>
                </button>

                <button
                  type="button"
                  class="week6-mixed-part"
                  data-week6-mixed-part="star"
                  data-mixed-mission="4"
                  style="top: 1240px; left: 32%;"
                >⭐</button>

                <button
                  type="button"
                  class="week6-mixed-part"
                  data-week6-mixed-part="moon"
                  data-mixed-mission="4"
                  style="top: 1390px; left: 72%;"
                >🌙</button>

                <button
                  type="button"
                  class="week6-mixed-part week6-mixed-crystal"
                  data-week6-mixed-part="crystal"
                  data-mixed-mission="4"
                  style="top: 1490px; left: 34%;"
                >💎</button>

                <button
                  type="button"
                  class="week6-mixed-part"
                  data-week6-mixed-part="planet"
                  data-mixed-mission="4"
                  style="top: 1690px; left: 70%;"
                >🪐</button>
              </div>
            </div>

            <div class="week6-mixed-repair-bay">
              <div class="week6-mixed-bay-title">
                REPAIR BAY
              </div>

              <div
                id="week6MixedRobot"
                class="week6-mixed-robot"
              >
                <div
                  id="week6MixedAntennaSlot"
                  class="week6-mixed-slot week6-mixed-antenna-slot"
                >
                  <span>+</span>
                </div>

                <div class="week6-mixed-robot-ear ear-left"></div>
                <div class="week6-mixed-robot-ear ear-right"></div>

                <div
                  id="week6MixedRobotFace"
                  class="week6-mixed-robot-head"
                >
                  <div class="week6-mixed-eye eye-left"></div>
                  <div class="week6-mixed-eye eye-right"></div>
                  <div class="week6-mixed-robot-mouth"></div>
                </div>

                <div class="week6-mixed-robot-neck"></div>

                <div class="week6-mixed-robot-arm arm-left">
                  <div class="week6-mixed-robot-hand"></div>
                </div>

                <div class="week6-mixed-robot-arm arm-right">
                  <div class="week6-mixed-robot-hand"></div>
                </div>

                <div class="week6-mixed-robot-body">
                  <div class="week6-mixed-button-row">
                    <button
                      id="week6MixedBlueButton"
                      type="button"
                      class="week6-mixed-robot-button button-blue"
                      data-week6-robot-button="blue"
                      aria-label="Blue robot button"
                    ></button>

                    <button
                      type="button"
                      class="week6-mixed-robot-button button-red"
                      data-week6-robot-button="red"
                      aria-label="Red robot button"
                    ></button>
                  </div>

                  <div
                    id="week6MixedReactorSlot"
                    class="week6-mixed-slot week6-mixed-reactor-slot"
                  >
                    <span>+</span>
                  </div>

                  <div
                    id="week6MixedBatterySlot"
                    class="week6-mixed-slot week6-mixed-battery-slot"
                  >
                    <span>+</span>
                  </div>
                </div>

                <div class="week6-mixed-robot-leg leg-left">
                  <div class="week6-mixed-robot-foot"></div>
                </div>

                <div class="week6-mixed-robot-leg leg-right">
                  <div class="week6-mixed-robot-foot"></div>
                </div>
              </div>
            </div>
          </div>

          <div
            id="week6MixedStatus"
            class="week6-mixed-status"
          >
            👀　💭
          </div>

        </div>
      `;
    }
    if (step.id.startsWith("week6-")) {
      return `
        <div class="lesson-screen lesson-screen-week6-placeholder">

          <div class="week6-placeholder-badge">
            WEEK 6
          </div>

          <h1>${step.title}</h1>

          <p class="week6-placeholder-message">
            This Week 6 screen is ready to build.
          </p>

        </div>
      `;
    }

    return `
      <div class="student-lesson-card">
        <p class="student-lesson-progress">
          Step ${safeIndex + 1} of ${lesson.steps.length}
        </p>

        <h1>${step.title}</h1>

        <p class="student-lesson-type">
          ${
            step.type === "practice"
              ? "Practice"
              : step.type === "complete"
                ? "Complete"
                : "Learn"
          }
        </p>
      </div>
    `;
  }

  let removeMeetMouseMovementListener = null;
  let removeReviewMoveListener = null;
  let removeReviewLeftClickListener = null;
  let removeReviewRightClickListener = null;
  let removeMovementPracticeListener = null;
  let removeLeftClickListener = null;
  let removeLeftClickPracticeListener = null;
  let removeWrongButtonListener = null;
  let movementSound = null;
  let movementSoundStopTimer = null;
  let soundEnabled = true;
  let leftClickSound = null;


  function stopStepBehavior() {
    /*
     * Universal audio cleanup.
     */
    stopAllLessonSounds();

    if (removeWeek4ChallengeBehavior) {
      removeWeek4ChallengeBehavior();
      removeWeek4ChallengeBehavior = null;
    }


    if (removeWeek4MovingMoveListener) {
      removeWeek4MovingMoveListener();
      removeWeek4MovingMoveListener = null;
    }

    if (removeWeek4MovingLeftDownListener) {
      removeWeek4MovingLeftDownListener();
      removeWeek4MovingLeftDownListener = null;
    }

    if (removeWeek4MovingRightListener) {
      removeWeek4MovingRightListener();
      removeWeek4MovingRightListener = null;
    }

    if (week4MovingNativeReleaseHandler) {
      window.removeEventListener(
        "mouseup",
        week4MovingNativeReleaseHandler,
        true
      );

      week4MovingNativeReleaseHandler = null;
    }


    if (removeWeek4PuzzleMoveListener) {
      removeWeek4PuzzleMoveListener();
      removeWeek4PuzzleMoveListener = null;
    }

    if (removeWeek4PuzzleLeftDownListener) {
      removeWeek4PuzzleLeftDownListener();
      removeWeek4PuzzleLeftDownListener = null;
    }

    if (removeWeek4PuzzleRightListener) {
      removeWeek4PuzzleRightListener();
      removeWeek4PuzzleRightListener = null;
    }

    if (week4PuzzleNativeReleaseHandler) {
      window.removeEventListener(
        "mouseup",
        week4PuzzleNativeReleaseHandler,
        true
      );

      week4PuzzleNativeReleaseHandler = null;
    }


    if (removeWeek4CleanUpMoveListener) {
      removeWeek4CleanUpMoveListener();
      removeWeek4CleanUpMoveListener = null;
    }

    if (removeWeek4CleanUpLeftDownListener) {
      removeWeek4CleanUpLeftDownListener();
      removeWeek4CleanUpLeftDownListener = null;
    }

    if (removeWeek4CleanUpRightListener) {
      removeWeek4CleanUpRightListener();
      removeWeek4CleanUpRightListener = null;
    }

    if (week4CleanUpNativeReleaseHandler) {
      window.removeEventListener(
        "mouseup",
        week4CleanUpNativeReleaseHandler,
        true
      );

      week4CleanUpNativeReleaseHandler = null;
    }


    if (removeWeek4SortMoveListener) {
      removeWeek4SortMoveListener();
      removeWeek4SortMoveListener = null;
    }

    if (removeWeek4SortLeftDownListener) {
      removeWeek4SortLeftDownListener();
      removeWeek4SortLeftDownListener = null;
    }

    if (removeWeek4SortRightListener) {
      removeWeek4SortRightListener();
      removeWeek4SortRightListener = null;
    }

    if (week4SortNativeReleaseHandler) {
      window.removeEventListener(
        "mouseup",
        week4SortNativeReleaseHandler,
        true
      );

      week4SortNativeReleaseHandler = null;
    }


    if (removeWeek4WarmUpMoveListener) {
      removeWeek4WarmUpMoveListener();
      removeWeek4WarmUpMoveListener = null;
    }

    if (removeWeek4WarmUpLeftDownListener) {
      removeWeek4WarmUpLeftDownListener();
      removeWeek4WarmUpLeftDownListener = null;
    }

    if (removeWeek4WarmUpRightListener) {
      removeWeek4WarmUpRightListener();
      removeWeek4WarmUpRightListener = null;
    }

    if (week4WarmUpNativeReleaseHandler) {
      window.removeEventListener(
        "mouseup",
        week4WarmUpNativeReleaseHandler,
        true
      );

      week4WarmUpNativeReleaseHandler = null;
    }

    stopWeek4QuickReviewAnimation();

    /*
     * Remove the Week 1 Step 4 completion card
     * whenever the teacher/student leaves the step.
     */
    document
      .querySelectorAll(
        ".movement-practice-celebration"
      )
      .forEach((celebration) => {
        celebration.remove();
      });


    if (removeDragChallengeMoveListener) {
      removeDragChallengeMoveListener();
      removeDragChallengeMoveListener = null;
    }

    if (removeDragChallengeLeftDownListener) {
      removeDragChallengeLeftDownListener();
      removeDragChallengeLeftDownListener = null;
    }

    if (removeDragChallengeRightListener) {
      removeDragChallengeRightListener();
      removeDragChallengeRightListener = null;
    }

    if (dragChallengeNativeReleaseHandler) {
      window.removeEventListener(
        "mouseup",
        dragChallengeNativeReleaseHandler,
        true
      );

      dragChallengeNativeReleaseHandler = null;
    }


    if (removeDragDropMoveListener) {
      removeDragDropMoveListener();
      removeDragDropMoveListener = null;
    }

    if (removeDragDropLeftDownListener) {
      removeDragDropLeftDownListener();
      removeDragDropLeftDownListener = null;
    }

    if (removeDragDropRightListener) {
      removeDragDropRightListener();
      removeDragDropRightListener = null;
    }

    if (dragDropNativeReleaseHandler) {
      window.removeEventListener(
        "mouseup",
        dragDropNativeReleaseHandler,
        true
      );

      dragDropNativeReleaseHandler = null;
    }


    if (removeDragPracticeMoveListener) {
      removeDragPracticeMoveListener();
      removeDragPracticeMoveListener = null;
    }

    if (removeDragPracticeLeftDownListener) {
      removeDragPracticeLeftDownListener();
      removeDragPracticeLeftDownListener = null;
    }

    if (removeDragPracticeRightListener) {
      removeDragPracticeRightListener();
      removeDragPracticeRightListener = null;
    }

    if (dragPracticeNativeReleaseHandler) {
      window.removeEventListener(
        "mouseup",
        dragPracticeNativeReleaseHandler,
        true
      );

      dragPracticeNativeReleaseHandler = null;
    }


    if (removeLetGoMoveListener) {
      removeLetGoMoveListener();
      removeLetGoMoveListener = null;
    }

    if (removeLetGoLeftDownListener) {
      removeLetGoLeftDownListener();
      removeLetGoLeftDownListener = null;
    }

    if (removeLetGoLeftUpListener) {
      removeLetGoLeftUpListener();
      removeLetGoLeftUpListener = null;
    }

    if (removeLetGoRightListener) {
      removeLetGoRightListener();
      removeLetGoRightListener = null;
    }

    if (letGoNativeReleaseHandler) {
      window.removeEventListener(
        "mouseup",
        letGoNativeReleaseHandler,
        true
      );

      letGoNativeReleaseHandler = null;
    }

    stopWeek3DemoSounds();

    stopDragQuickReviewAnimation();

    if (removeMeetMouseMovementListener) {
      removeMeetMouseMovementListener();
      removeMeetMouseMovementListener = null;
    }

    if (removeReviewMoveListener) {
      removeReviewMoveListener();
      removeReviewMoveListener = null;
    }

    if (removeReviewLeftClickListener) {
      removeReviewLeftClickListener();
      removeReviewLeftClickListener = null;
    }

    if (removeReviewRightClickListener) {
      removeReviewRightClickListener();
      removeReviewRightClickListener = null;
    }

    if (removeMovementPracticeListener) {
      removeMovementPracticeListener();
      removeMovementPracticeListener = null;
    }

    if (removeLeftClickListener) {
      removeLeftClickListener();
      removeLeftClickListener = null;
    }

    if (removeLeftClickPracticeListener) {
      removeLeftClickPracticeListener();
      removeLeftClickPracticeListener = null;
    }

    if (removeWrongButtonListener) {
      removeWrongButtonListener();
      removeWrongButtonListener = null;
    }

    if (removeMoveClickMoveListener) {
      removeMoveClickMoveListener();
      removeMoveClickMoveListener = null;
    }

    if (removeMoveClickLeftListener) {
      removeMoveClickLeftListener();
      removeMoveClickLeftListener = null;
    }

    if (removeMoveClickRightListener) {
      removeMoveClickRightListener();
      removeMoveClickRightListener = null;
    }

    if (removeMouseChallengeMoveListener) {
      removeMouseChallengeMoveListener();
      removeMouseChallengeMoveListener = null;
    }

    if (removeMouseChallengeLeftListener) {
      removeMouseChallengeLeftListener();
      removeMouseChallengeLeftListener = null;
    }

    if (removeMouseChallengeRightListener) {
      removeMouseChallengeRightListener();
      removeMouseChallengeRightListener = null;
    }
    if (removeBullseyeMoveListener) {
      removeBullseyeMoveListener();
      removeBullseyeMoveListener = null;
    }

    if (removeBullseyeLeftListener) {
      removeBullseyeLeftListener();
      removeBullseyeLeftListener = null;
    }

    if (removeBullseyeRightListener) {
      removeBullseyeRightListener();
      removeBullseyeRightListener = null;
    }

    if (removeWaitMoveListener) {
      removeWaitMoveListener();
      removeWaitMoveListener = null;
    }

    if (removeWaitLeftListener) {
      removeWaitLeftListener();
      removeWaitLeftListener = null;
    }

    if (removeWaitRightListener) {
      removeWaitRightListener();
      removeWaitRightListener = null;
    }

    if (removeCornerHuntMoveListener) {
      removeCornerHuntMoveListener();
      removeCornerHuntMoveListener = null;
    }

    if (removeCornerHuntLeftListener) {
      removeCornerHuntLeftListener();
      removeCornerHuntLeftListener = null;
    }

    if (removeCornerHuntRightListener) {
      removeCornerHuntRightListener();
      removeCornerHuntRightListener = null;
    }

    if (removeColorMatchMoveListener) {
      removeColorMatchMoveListener();
      removeColorMatchMoveListener = null;
    }

    if (removeColorMatchLeftListener) {
      removeColorMatchLeftListener();
      removeColorMatchLeftListener = null;
    }

    if (removeColorMatchRightListener) {
      removeColorMatchRightListener();
      removeColorMatchRightListener = null;
    }

    if (removeMouseSprintMoveListener) {
      removeMouseSprintMoveListener();
      removeMouseSprintMoveListener = null;
    }

    if (removeMouseSprintLeftListener) {
      removeMouseSprintLeftListener();
      removeMouseSprintLeftListener = null;
    }

    if (removeMouseSprintRightListener) {
      removeMouseSprintRightListener();
      removeMouseSprintRightListener = null;
    }

    if (removeBubblePopMoveListener) {
      removeBubblePopMoveListener();
      removeBubblePopMoveListener = null;
    }

    if (removeBubblePopLeftListener) {
      removeBubblePopLeftListener();
      removeBubblePopLeftListener = null;
    }

    if (removeBubblePopRightListener) {
      removeBubblePopRightListener();
      removeBubblePopRightListener = null;
    }

  }

  function startMovementSound() {
    if (!soundEnabled) {
      return;
    }

    if (!movementSound) {
      movementSound = new Audio("/sounds/swoosh.mp3");
      movementSound.loop = true;
      movementSound.volume = 0.35;
    }

    clearTimeout(movementSoundStopTimer);

    if (movementSound.paused) {
      movementSound.play().catch(() => {});
    }

    movementSoundStopTimer = setTimeout(() => {
      if (movementSound) {
        movementSound.pause();
        movementSound.currentTime = 0;
      }
    }, 180);
  }

  function syncReviewBoardState(state) {
    const reviewStep =
      lesson?.steps?.[currentDisplayedStep];

    if (
      lesson?.id !== "review1" ||
      reviewStep?.id !== "review-week1"
    ) {
      return;
    }

    const released =
      state.reviewMovementReleased === true;

    const board =
      document.querySelector(".lesson-screen-review-board");

    const handCard =
      document.querySelector(".review-card-hand");

    const moveCard =
      document.querySelector(".review-card-move");

    const clickCard =
      document.querySelector(".review-card-click");

    if (!board || !handCard || !moveCard || !clickCard) {
      return;
    }

    board.classList.toggle(
      "review-board-movement-released",
      released
    );

    if (!released) {
      moveCard.classList.remove("review-card-ready");
      return;
    }

    moveCard.classList.add("review-card-ready");

    if (removeReviewMoveListener) {
      return;
    }

    const input = window.HandsOnMouseInput;
    const area =
      document.getElementById("reviewMoveArea");

    const pointer =
      document.getElementById("reviewMovePointer");

    if (!input || !area || !pointer) {
      return;
    }

    const directions = [
      { className: "review-up" },
      { className: "review-down" },
      { className: "review-left" },
      { className: "review-right" }
    ];

    let directionIndex = 0;

    function currentTarget() {
      if (directionIndex >= directions.length) {
        return null;
      }

      return area.querySelector(
        `.${directions[directionIndex].className}`
      );
    }

    function highlightCurrentTarget() {
      area
        .querySelectorAll(".review-direction")
        .forEach((target) => {
          target.classList.remove(
            "review-direction-active"
          );
        });

      currentTarget()?.classList.add(
        "review-direction-active"
      );

    }

    function pointerReachedCurrentTarget() {
      const target = currentTarget();

      if (!target) {
        return;
      }

      const pointerRect =
        pointer.getBoundingClientRect();

      const targetRect =
        target.getBoundingClientRect();

      const tipX =
        pointerRect.left +
        pointerRect.width * 0.72;

      const tipY =
        pointerRect.top +
        pointerRect.height * 0.72;

      const hit =
        tipX >= targetRect.left &&
        tipX <= targetRect.right &&
        tipY >= targetRect.top &&
        tipY <= targetRect.bottom;

      if (!hit) {
        return;
      }

      target.classList.remove(
        "review-direction-active"
      );

      target.classList.add(
        "review-direction-complete"
      );

      directionIndex += 1;

      if (directionIndex >= directions.length) {
        moveCard.classList.remove(
          "review-card-ready"
        );

        moveCard.classList.add(
          "review-card-complete"
        );

        clickCard.classList.add(
          "review-card-ready"
        );

        return;
      }

      highlightCurrentTarget();
    }

    highlightCurrentTarget();

    removeReviewMoveListener =
      input.subscribe("move", (event) => {
        const areaRect =
          area.getBoundingClientRect();

        const insideArea =
          event.x >= areaRect.left &&
          event.x <= areaRect.right &&
          event.y >= areaRect.top &&
          event.y <= areaRect.bottom;

        if (insideArea) {
          const tipOffsetX =
            pointer.offsetWidth * 0.72;

          const tipOffsetY =
            pointer.offsetHeight * 0.72;

          pointer.style.left =
            `${event.x - areaRect.left - tipOffsetX}px`;

          pointer.style.top =
            `${event.y - areaRect.top - tipOffsetY}px`;

          startMovementSound();
          pointerReachedCurrentTarget();
        }

        const clickCard =
          document.querySelector(".review-card-click");

        const clickReady =
          clickCard?.classList.contains("review-card-ready");

        if (clickReady) {
          const clickArea =
            document.getElementById("reviewClickArea");

          const clickPointer =
            document.getElementById("reviewClickPointer");

          if (clickArea && clickPointer) {
            const clickRect =
              clickArea.getBoundingClientRect();

            const insideClickArea =
              event.x >= clickRect.left &&
              event.x <= clickRect.right &&
              event.y >= clickRect.top &&
              event.y <= clickRect.bottom;

            if (insideClickArea) {
              const clickTipOffsetX =
                clickPointer.offsetWidth * 0.72;

              const clickTipOffsetY =
                clickPointer.offsetHeight * 0.72;

              clickPointer.style.left =
                `${event.x - clickRect.left - clickTipOffsetX}px`;

              clickPointer.style.top =
                `${event.y - clickRect.top - clickTipOffsetY}px`;

              startMovementSound();
            }
          }
        }
      });

    if (!removeReviewRightClickListener) {
      removeReviewRightClickListener =
        input.subscribe("rightDown", () => {
          const clickCard =
            document.querySelector(".review-card-click");

          if (
            !clickCard?.classList.contains("review-card-ready") ||
            clickCard.classList.contains("review-card-complete")
          ) {
            return;
          }

          showWrongButtonWarning();
        });
    }

    if (!removeReviewLeftClickListener) {
      let pendingReviewClickTimer = null;

      removeReviewLeftClickListener =
        input.subscribe("leftDown", () => {
          const clickCard =
            document.querySelector(".review-card-click");

          if (
            !clickCard?.classList.contains("review-card-ready") ||
            clickCard.classList.contains("review-card-complete")
          ) {
            return;
          }

          const clickPointer =
            document.getElementById("reviewClickPointer");

          const clickTarget =
            document.getElementById("reviewClickTarget");

          if (!clickPointer || !clickTarget) {
            return;
          }

          const pointerRect =
            clickPointer.getBoundingClientRect();

          const targetRect =
            clickTarget.getBoundingClientRect();

          const pointerTipX =
            pointerRect.left +
            pointerRect.width * 0.72;

          const pointerTipY =
            pointerRect.top +
            pointerRect.height * 0.72;

          const hit =
            pointerTipX >= targetRect.left &&
            pointerTipX <= targetRect.right &&
            pointerTipY >= targetRect.top &&
            pointerTipY <= targetRect.bottom;

          if (!hit) {
            return;
          }

          if (pendingReviewClickTimer) {
            clearTimeout(pendingReviewClickTimer);
            pendingReviewClickTimer = null;

            showClickWarning();
            return;
          }

          pendingReviewClickTimer =
            setTimeout(() => {
              pendingReviewClickTimer = null;

              clickTarget.textContent = "✓";

              clickTarget.classList.add(
                "review-click-complete"
              );

              clickCard.classList.add(
                "review-card-complete"
              );

              setTimeout(() => {
                showReviewCompletePopup();
              }, 500);

              if (soundEnabled) {
                if (!leftClickSound) {
                  leftClickSound =
                    new Audio("/sounds/mouseclick.mp3");

                  leftClickSound.volume = 0.5;
                }

                leftClickSound.currentTime = 0;
                leftClickSound.play().catch(() => {});
              }
            }, 450);
        });
    }

  }

  function startMeetMouseBehavior() {
    const input = window.HandsOnMouseInput;
    const area = document.getElementById("pointerPracticeArea");
    const pointer = document.getElementById("lessonDemoPointer");
    const mouseVisual = document.getElementById("lessonMouseMovement");

    if (!input || !area || !pointer || !mouseVisual) {
      return;
    }

    let pointerX = 0;
    let pointerY = 0;

    let visualX = 0;
    let visualY = 0;
    let targetVisualX = 0;
    let targetVisualY = 0;
    let animationFrame = null;

    function positionPointer() {
      const tipOffsetX = pointer.offsetWidth * 0.72;
      const tipOffsetY = pointer.offsetHeight * 0.72;

      const minX = -tipOffsetX;
      const minY = -tipOffsetY;

      const maxX = area.clientWidth - tipOffsetX;

      const extraDownReach = 30;
      const maxY =
        area.clientHeight - tipOffsetY + extraDownReach;

      pointerX = Math.min(Math.max(pointerX, minX), maxX);
      pointerY = Math.min(Math.max(pointerY, minY), maxY);

      pointer.style.left = `${pointerX}px`;
      pointer.style.top = `${pointerY}px`;
    }

    function centerPointer() {
      const tipOffsetX = pointer.offsetWidth * 0.72;
      const tipOffsetY = pointer.offsetHeight * 0.72;

      pointerX = area.clientWidth / 2 - tipOffsetX;
      pointerY = area.clientHeight / 2 - tipOffsetY;

      positionPointer();
    }

    centerPointer();

    removeMeetMouseMovementListener =
      input.subscribe("move", (event) => {
        mouseVisual.classList.add("has-mouse-movement");

        startMovementSound();

        const areaRect = area.getBoundingClientRect();

        const tipOffsetX = pointer.offsetWidth * 0.72;
        const tipOffsetY = pointer.offsetHeight * 0.72;

        pointerX =
          event.x - areaRect.left - tipOffsetX;

        pointerY =
          event.y - areaRect.top - tipOffsetY;

        positionPointer();

        targetVisualX += event.movementX * 0.7;
        targetVisualY += event.movementY * 0.7;

        targetVisualX = Math.max(
          -80,
          Math.min(80, targetVisualX)
        );

        targetVisualY = Math.max(
          -55,
          Math.min(55, targetVisualY)
        );

        if (!animationFrame) {
          const animateVisualMouse = () => {
            visualX +=
              (targetVisualX - visualX) * 0.16;

            visualY +=
              (targetVisualY - visualY) * 0.16;

            mouseVisual.style.transform =
              `translate3d(${visualX}px, ${visualY}px, 0)`;

            const stillMoving =
              Math.abs(targetVisualX - visualX) > 0.2 ||
              Math.abs(targetVisualY - visualY) > 0.2;

            if (stillMoving) {
              animationFrame =
                requestAnimationFrame(
                  animateVisualMouse
                );
            } else {
              animationFrame = null;
            }
          };

          animationFrame =
            requestAnimationFrame(
              animateVisualMouse
            );
        }
      });
  }

  function startMovementPracticeBehavior() {
    const input = window.HandsOnMouseInput;
    const area = document.getElementById("movementPracticeArea");
    const pointer = document.getElementById("movementPracticePointer");
    const instruction =
      document.getElementById("movementPracticeInstruction");
    const status =
      document.getElementById("movementPracticeStatus");

    if (!input || !area || !pointer || !instruction || !status) {
      return;
    }

    const directions = [
      { id: "up", label: "cow" },
      { id: "down", label: "cat" },
      { id: "left", label: "pig" },
      { id: "right", label: "dog" }
    ];

    let directionIndex = 0;
    let pointerX = 0;
    let pointerY = 0;

    function positionPointer() {
      const tipOffsetX = pointer.offsetWidth * 0.72;
      const tipOffsetY = pointer.offsetHeight * 0.72;

      const minX = -tipOffsetX;
      const minY = -tipOffsetY;

      const maxX = area.clientWidth - tipOffsetX;
      const maxY = area.clientHeight - tipOffsetY;

      pointerX = Math.min(Math.max(pointerX, minX), maxX);
      pointerY = Math.min(Math.max(pointerY, minY), maxY);

      pointer.style.left = `${pointerX}px`;
      pointer.style.top = `${pointerY}px`;
    }

    function centerPointer() {
      const tipOffsetX = pointer.offsetWidth * 0.72;
      const tipOffsetY = pointer.offsetHeight * 0.72;

      pointerX = area.clientWidth / 2 - tipOffsetX;
      pointerY = area.clientHeight / 2 - tipOffsetY;

      positionPointer();
    }

    function updateInstruction() {
      const current = directions[directionIndex];

      instruction.textContent =
        `Move to the ${current.label}.`;

      document
        .querySelectorAll(".practice-target")
        .forEach((target) => {
          target.classList.toggle(
            "active-practice-target",
            target.dataset.direction === current.id
          );
        });
    }

    function checkTarget() {
      if (directionIndex >= directions.length) {
        return;
      }

      const current = directions[directionIndex];

      const target = document.querySelector(
        `.practice-target[data-direction="${current.id}"]`
      );

      if (!target) {
        return;
      }

      const pointerRect = pointer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const pointerTipX =
        pointerRect.left + pointerRect.width * 0.72;

      const pointerTipY =
        pointerRect.top + pointerRect.height * 0.72;

      const hit =
        pointerTipX >= targetRect.left &&
        pointerTipX <= targetRect.right &&
        pointerTipY >= targetRect.top &&
        pointerTipY <= targetRect.bottom;

      if (!hit) {
        return;
      }

      directionIndex += 1;

      if (directionIndex >= directions.length) {
        status.textContent =
          "You moved in every direction!";

        instruction.textContent =
          "Movement practice complete!";

        document
          .querySelectorAll(".practice-target")
          .forEach((target) => {
            target.classList.remove(
              "active-practice-target"
            );
          });

        /*
         * Small completion celebration for Week 1 Step 4.
         */
        const celebration =
          document.createElement("div");

        celebration.className =
          "movement-practice-celebration";

        celebration.innerHTML = `
          <div class="movement-practice-celebration-card">
            <div class="movement-practice-celebration-stars">
              ✦ ★ ✦
            </div>

            <strong>
              Great Job!
            </strong>

            <span>
              You finished Movement Practice!
            </span>
          </div>
        `;

        document.body.appendChild(
          celebration
        );

        if (soundEnabled) {
          const correctSound =
            new Audio("/sounds/correct.mp3");

          correctSound.volume = 0.6;
          correctSound.currentTime = 0;

          correctSound
            .play()
            .catch(() => {});
        }

        /*
         * Leave the completion card on screen.
         * It will disappear naturally when the teacher
         * advances to the next lesson step and the
         * current step is re-rendered.
         */
        return;
      }

      status.textContent = "Great job!";
      updateInstruction();
    }

    centerPointer();
    updateInstruction();

    removeMovementPracticeListener =
      input.subscribe("move", (event) => {
        const areaRect = area.getBoundingClientRect();

        const tipOffsetX = pointer.offsetWidth * 0.72;
        const tipOffsetY = pointer.offsetHeight * 0.72;

        pointerX =
          event.x - areaRect.left - tipOffsetX;

        pointerY =
          event.y - areaRect.top - tipOffsetY;

        positionPointer();
        startMovementSound();
        checkTarget();
      });
  }

  function attachLeftClickCoaching({
    input,
    onWrongButton,
    onFastClick
  }) {
    const cleanup = [];

    if (input && typeof onWrongButton === "function") {
      cleanup.push(
        input.subscribe("rightDown", () => {
          showWrongButtonWarning();
          onWrongButton();
        })
      );
    }

    return () => {
      cleanup.forEach((removeListener) => {
        removeListener();
      });
    };
  }

  let removeMoveClickMoveListener = null;
  let removeMoveClickLeftListener = null;
  let removeMoveClickRightListener = null;

  let removeMouseChallengeMoveListener = null;
  let removeMouseChallengeLeftListener = null;
  let removeMouseChallengeRightListener = null;

  function startMouseChallengeBehavior() {
    const input = window.HandsOnMouseInput;
    const area = document.getElementById("mouseChallengeArea");
    const pointer = document.getElementById("mouseChallengePointer");
    const target = document.getElementById("mouseChallengeTarget");
    const status = document.getElementById("mouseChallengeStatus");
    const progress = document.getElementById("mouseChallengeProgress");

    if (!input || !area || !pointer || !target || !status || !progress) {
      return;
    }

    const positions = [
      { x: 18, y: 20 },
      { x: 80, y: 22 },
      { x: 22, y: 72 },
      { x: 76, y: 70 },
      { x: 50, y: 48 }
    ];

    let completedTargets = 0;
    let pendingClickTimer = null;
    let nextAllowedClickTime = 0;

    const DOUBLE_CLICK_WINDOW = 450;
    const CLICK_WAIT_TIME = 1000;

    function updateProgress() {
      progress.textContent =
        `${completedTargets} of ${positions.length}`;
    }

    function positionTarget() {
      if (completedTargets >= positions.length) {
        return;
      }

      const position = positions[completedTargets];

      target.style.left = `${position.x}%`;
      target.style.top = `${position.y}%`;
    }

    function pointerIsOnTarget() {
      const pointerRect = pointer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const pointerTipX =
        pointerRect.left + pointerRect.width * 0.72;

      const pointerTipY =
        pointerRect.top + pointerRect.height * 0.72;

      return (
        pointerTipX >= targetRect.left &&
        pointerTipX <= targetRect.right &&
        pointerTipY >= targetRect.top &&
        pointerTipY <= targetRect.bottom
      );
    }

    function resetChallenge() {
      completedTargets = 0;
      nextAllowedClickTime = 0;

      if (pendingClickTimer) {
        clearTimeout(pendingClickTimer);
        pendingClickTimer = null;
      }

      updateProgress();
      positionTarget();

      status.textContent =
        "Start again. Click once, then wait.";

      showClickWarning();
    }

    removeMouseChallengeMoveListener =
      input.subscribe("move", (event) => {
        const areaRect = area.getBoundingClientRect();

        const tipOffsetX = pointer.offsetWidth * 0.72;
        const tipOffsetY = pointer.offsetHeight * 0.72;

        pointer.style.left =
          `${event.x - areaRect.left - tipOffsetX}px`;

        pointer.style.top =
          `${event.y - areaRect.top - tipOffsetY}px`;

        startMovementSound();
      });

    removeMouseChallengeRightListener =
      input.subscribe("rightDown", () => {
        showWrongButtonWarning();
      });

    removeMouseChallengeLeftListener =
      input.subscribe("leftDown", () => {
        if (completedTargets >= positions.length) {
          return;
        }

        if (!pointerIsOnTarget()) {
          status.textContent =
            "Move onto the target before you click.";
          return;
        }

        const now = Date.now();

        if (
          pendingClickTimer ||
          now < nextAllowedClickTime
        ) {
          resetChallenge();
          return;
        }

        status.textContent = "Wait...";

        pendingClickTimer = setTimeout(() => {
          pendingClickTimer = null;

          if (soundEnabled) {
            if (!leftClickSound) {
              leftClickSound =
                new Audio("/sounds/mouseclick.mp3");
              leftClickSound.volume = 0.5;
            }

            leftClickSound.currentTime = 0;
            leftClickSound.play().catch(() => {});
          }

          completedTargets += 1;

          nextAllowedClickTime =
            Date.now() + CLICK_WAIT_TIME;

          updateProgress();

          if (completedTargets >= positions.length) {
            status.textContent =
              "Mouse Challenge complete!";

            target.textContent = "✓";

            if (!isTeacher) {
              sessionStorage.setItem(
                "handsOnMouseWeek1Complete",
                "true"
              );

              setTimeout(() => {
                renderStep(
                  lesson.steps.length - 1,
                  "teacher"
                );
              }, 700);
            }

            return;
          }

          status.textContent =
            "Great! Find the next target.";

          positionTarget();
        }, DOUBLE_CLICK_WINDOW);
      });

    positionTarget();
    updateProgress();
  }

  function startMoveAndClickBehavior() {
    const input = window.HandsOnMouseInput;
    const area = document.getElementById("moveClickArea");
    const pointer = document.getElementById("moveClickPointer");
    const target = document.getElementById("moveClickTarget");
    const status = document.getElementById("moveClickStatus");

    if (!input || !area || !pointer || !target || !status) {
      return;
    }

    const positions = [
      { x: 20, y: 25 },
      { x: 78, y: 28 },
      { x: 50, y: 72 }
    ];

    let completedTargets = 0;
    let pendingClickTimer = null;
    let nextAllowedClickTime = 0;

    const DOUBLE_CLICK_WINDOW = 450;
    const CLICK_WAIT_TIME = 1000;

    function updateProgress() {
      for (let i = 1; i <= 3; i += 1) {
        const dot = document.getElementById(`moveClickDot${i}`);

        if (dot) {
          dot.classList.toggle(
            "complete",
            i <= completedTargets
          );
        }
      }
    }

    function positionTarget() {
      if (completedTargets >= positions.length) {
        return;
      }

      const position = positions[completedTargets];

      target.style.left = `${position.x}%`;
      target.style.top = `${position.y}%`;
    }

    function pointerIsOnTarget() {
      const pointerRect = pointer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const pointerTipX =
        pointerRect.left + pointerRect.width * 0.72;

      const pointerTipY =
        pointerRect.top + pointerRect.height * 0.72;

      return (
        pointerTipX >= targetRect.left &&
        pointerTipX <= targetRect.right &&
        pointerTipY >= targetRect.top &&
        pointerTipY <= targetRect.bottom
      );
    }

    function resetForFastClick() {
      completedTargets = 0;
      nextAllowedClickTime = 0;

      if (pendingClickTimer) {
        clearTimeout(pendingClickTimer);
        pendingClickTimer = null;
      }

      updateProgress();
      positionTarget();

      status.textContent =
        "Start again. Click once, then wait.";

      showClickWarning();
    }

    removeMoveClickMoveListener =
      input.subscribe("move", (event) => {
        const areaRect = area.getBoundingClientRect();

        const tipOffsetX = pointer.offsetWidth * 0.72;
        const tipOffsetY = pointer.offsetHeight * 0.72;

        pointer.style.left =
          `${event.x - areaRect.left - tipOffsetX}px`;

        pointer.style.top =
          `${event.y - areaRect.top - tipOffsetY}px`;

        startMovementSound();
      });

    removeMoveClickRightListener =
      input.subscribe("rightDown", () => {
        showWrongButtonWarning();
      });

    removeMoveClickLeftListener =
      input.subscribe("leftDown", () => {
        if (completedTargets >= positions.length) {
          return;
        }

        if (!pointerIsOnTarget()) {
          status.textContent =
            "Move onto the target before you click.";
          return;
        }

        const now = Date.now();

        if (
          pendingClickTimer ||
          now < nextAllowedClickTime
        ) {
          resetForFastClick();
          return;
        }

        status.textContent = "Wait...";

        pendingClickTimer = setTimeout(() => {
          pendingClickTimer = null;

          if (soundEnabled) {
            if (!leftClickSound) {
              leftClickSound =
                new Audio("/sounds/mouseclick.mp3");
              leftClickSound.volume = 0.5;
            }

            leftClickSound.currentTime = 0;
            leftClickSound.play().catch(() => {});
          }

          completedTargets += 1;

          nextAllowedClickTime =
            Date.now() + CLICK_WAIT_TIME;

          updateProgress();

          if (completedTargets >= positions.length) {
            status.textContent =
              "Move & Click complete!";

            target.textContent = "✓";
            return;
          }

          status.textContent =
            "Great click! Find the next target.";

          positionTarget();
        }, DOUBLE_CLICK_WINDOW);
      });

    positionTarget();
    updateProgress();
  }

  let clickWarningTimer = null;

  function showReviewCompletePopup() {
    let popup =
      document.getElementById("reviewCompletePopup");

    if (!popup) {
      popup = document.createElement("div");
      popup.id = "reviewCompletePopup";

      popup.innerHTML = `
        <div class="review-complete-popup-card">

          <div class="review-complete-star">
            ★
          </div>

          <div class="review-complete-popup-message">
            <strong>Great Review!</strong>

            <span>
              Let's do some quick activities to help us
              get even better with our mouse.
            </span>
          </div>

        </div>
      `;

      document.body.appendChild(popup);
    }

    popup.classList.add("show");
  }

  function showClickWarning() {
    let warning =
      document.getElementById("clickTooFastWarning");

    if (!warning) {
      warning = document.createElement("div");
      warning.id = "clickTooFastWarning";

      warning.innerHTML = `
        <div class="click-too-fast-popup-card">
          <div class="click-too-fast-icon">✋</div>

          <div class="click-too-fast-message">
            <strong>Slow Down!</strong>
            <span>Click once, then wait.</span>
          </div>
        </div>
      `;

      document.body.appendChild(warning);
    }

    warning.classList.remove("show");

    void warning.offsetWidth;

    warning.classList.add("show");

    if (soundEnabled) {
      const mistakeSound =
        new Audio("/sounds/mistake.mp3");

      mistakeSound.volume = 0.6;
      mistakeSound.play().catch(() => {});
    }

    clearTimeout(clickWarningTimer);

    clickWarningTimer = setTimeout(() => {
      warning.classList.remove("show");
    }, 1400);
  }

  function startLeftClickPracticeBehavior() {
    const input = window.HandsOnMouseInput;
    const target = document.getElementById("leftClickPracticeTarget");
    const status = document.getElementById("leftClickPracticeStatus");

    if (!input || !target || !status) {
      return;
    }

    let correctClicks = 0;
    let pendingClickTimer = null;
    let nextAllowedClickTime = 0;

    const DOUBLE_CLICK_WINDOW = 450;
    const CLICK_WAIT_TIME = 1000;

    function updateProgress() {
      for (let i = 1; i <= 3; i += 1) {
        const dot = document.getElementById(
          `clickPracticeDot${i}`
        );

        if (dot) {
          dot.classList.toggle(
            "complete",
            i <= correctClicks
          );
        }
      }
    }

    function resetForFastClick() {
      correctClicks = 0;
      nextAllowedClickTime = 0;

      if (pendingClickTimer) {
        clearTimeout(pendingClickTimer);
        pendingClickTimer = null;
      }

      updateProgress();

      status.textContent =
        "Too fast! Start again. Click once, then wait.";

      target.classList.remove("clicked");
      target.classList.remove("clicked-too-fast");

      requestAnimationFrame(() => {
        target.classList.add("clicked-too-fast");
      });

      showClickWarning();
    }

    removeWrongButtonListener =
      input.subscribe("rightDown", () => {
        showWrongButtonWarning();
      });

    removeLeftClickPracticeListener =
      input.subscribe("leftDown", (event) => {
        if (correctClicks >= 3) {
          return;
        }

        const targetRect = target.getBoundingClientRect();

        const hit =
          event.x >= targetRect.left &&
          event.x <= targetRect.right &&
          event.y >= targetRect.top &&
          event.y <= targetRect.bottom;

        if (!hit) {
          status.textContent = "Point to the star first.";
          return;
        }

        const now = Date.now();

        /*
         * If a second click arrives while the first click
         * is still waiting to be confirmed, treat both as
         * a double-click mistake.
         */
        if (pendingClickTimer) {
          resetForFastClick();
          return;
        }

        /*
         * Even after a click is confirmed, require the
         * student to wait before beginning another click.
         */
        if (now < nextAllowedClickTime) {
          resetForFastClick();
          return;
        }

        status.textContent = "Wait...";

        pendingClickTimer = setTimeout(() => {
          pendingClickTimer = null;

          correctClicks += 1;

          nextAllowedClickTime =
            Date.now() + CLICK_WAIT_TIME;

          target.classList.remove("clicked-too-fast");
          target.classList.remove("clicked");

          requestAnimationFrame(() => {
            target.classList.add("clicked");
          });

          if (soundEnabled) {
            if (!leftClickSound) {
              leftClickSound =
                new Audio("/sounds/mouseclick.mp3");
              leftClickSound.volume = 0.5;
            }

            leftClickSound.currentTime = 0;
            leftClickSound.play().catch(() => {});
          }

          updateProgress();

          if (correctClicks >= 3) {
            status.textContent =
              "Click practice complete!";
            target.textContent = "✓";
          } else {
            status.textContent =
              "Great click! Wait... then click again.";
          }
        }, DOUBLE_CLICK_WINDOW);
      });

    updateProgress();
  }

  let wrongButtonWarningTimer = null;

  function showWrongButtonWarning() {
    const hand =
      document.querySelector(".left-click-hand") ||
      document.querySelector(".hold-mouse-hand");

    const middleFinger =
      hand?.querySelector(".mouse-demo-middle");

    const mouseBody =
      hand?.nextElementSibling;

    const rightButton =
      mouseBody?.querySelector(".mouse-demo-right");

    let warning =
      document.getElementById("wrongButtonWarning");

    if (!warning) {
      warning = document.createElement("div");
      warning.id = "wrongButtonWarning";

      warning.innerHTML = `
        <div class="wrong-button-warning-card">

          <div class="wrong-button-warning-visual">
            <div class="wrong-warning-hand-wrap">

              <div class="mouse-demo-hand wrong-warning-hand">
                <div class="mouse-demo-palm"></div>
                <div class="mouse-demo-finger mouse-demo-index"></div>
                <div class="mouse-demo-finger mouse-demo-middle wrong-warning-middle"></div>
                <div class="mouse-demo-finger mouse-demo-pinky"></div>
              </div>

              <div class="mouse-demo-body wrong-warning-mouse">
                <div class="mouse-demo-left"></div>
                <div class="mouse-demo-right wrong-warning-right-button"></div>
                <div class="mouse-demo-wheel"></div>
              </div>

            </div>
          </div>

          <div class="wrong-button-warning-message">
            <strong>Wrong Button!</strong>
            <span>Use your pointer finger on the LEFT button.</span>
          </div>

        </div>
      `;

      document.body.appendChild(warning);
    }

    hand?.classList.add("wrong-button-hand-pop");
    middleFinger?.classList.add("wrong-button-finger");
    rightButton?.classList.add("wrong-button-mouse-button");
    warning.classList.add("show");

    if (soundEnabled) {
      const mistakeSound =
        new Audio("/sounds/wrongclick.mp3");

      mistakeSound.volume = 0.6;
      mistakeSound.play().catch(() => {});
    }

    clearTimeout(wrongButtonWarningTimer);

    wrongButtonWarningTimer = setTimeout(() => {
      hand?.classList.remove("wrong-button-hand-pop");
      middleFinger?.classList.remove("wrong-button-finger");
      rightButton?.classList.remove("wrong-button-mouse-button");
      warning.classList.remove("show");
    }, 1100);
  }

  function startLeftClickBehavior() {
    const input = window.HandsOnMouseInput;
    const finger = document.getElementById("leftClickFinger");
    const button = document.getElementById("leftClickButtonVisual");
    const status = document.getElementById("leftClickStatus");

    if (!input || !finger || !button || !status) {
      return;
    }

    removeWrongButtonListener =
      input.subscribe("rightDown", () => {
        showWrongButtonWarning();
      });

    removeLeftClickListener = input.subscribe("leftDown", () => {
      finger.classList.add("left-click-pressed");
      button.classList.add("left-click-button-pressed");

      status.textContent = "Great click!";

      if (soundEnabled) {
        if (!leftClickSound) {
          leftClickSound = new Audio("/sounds/mouseclick.mp3");
          leftClickSound.volume = 0.5;
        }

        leftClickSound.currentTime = 0;
        leftClickSound.play().catch(() => {});
      }

      setTimeout(() => {
        finger.classList.remove("left-click-pressed");
        button.classList.remove("left-click-button-pressed");
      }, 180);
    });
  }

  function renderStep(stepIndex, mode) {
    stopWeek6WarmUpBehavior();
    stopWeek6PrecisionBehavior();

    stopWeek5CompleteBehavior();

    stopWeek5ScrollDragBehavior();

    stopWeek5ScrollClickBehavior();

    stopWeek5StopTargetBehavior();

    stopWeek5ScrollPracticeBehavior();

    stopWeek5ScrollUpBehavior();

    /*
     * ALWAYS stop Week 5 looping demonstrations
     * before replacing the current slide.
     */
    stopWeek5QuickReviewAnimation();
    stopWeek5MeetWheelAnimation();
    stopWeek5ScrollDownBehavior();

    /*
     * IMPORTANT:
     * Completely tear down the OLD slide before
     * building the new one. This stops timers,
     * listeners, animations, and sounds from
     * continuing in the background.
     */
    stopStepBehavior();

    if (
      typeof window.HandsOnMouseStopLessonSounds ===
      "function"
    ) {
      window.HandsOnMouseStopLessonSounds();
    }

    const safeIndex = Math.min(
      Math.max(stepIndex, 0),
      lesson.steps.length - 1
    );

    currentDisplayedStep = safeIndex;

    stopStepBehavior();

    const step = lesson.steps[safeIndex];
    const container = getLessonContainer();

    const independentControls =
      mode === "student"
        ? `
          <div class="student-independent-controls">
            <button
              id="studentBackButton"
              type="button"
              ${safeIndex <= 0 ? "disabled" : ""}
            >
              Back
            </button>

            <button
              id="studentNextButton"
              type="button"
              ${safeIndex >= lesson.steps.length - 1 ? "disabled" : ""}
            >
              Next
            </button>
          </div>
        `
        : "";

    container.innerHTML = `
      ${getStepContent(step, safeIndex)}
      ${independentControls}
    `;

    if (step.id === "drag-quick-review") {
      startDragQuickReviewAnimation();
    }

    if (step.id === "week4-quick-review") {
      startWeek4QuickReviewAnimation();
    }

    if (step.id === "week6-warm-up") {
      startWeek6WarmUpBehavior();
    }

    if (step.id === "week6-precision") {
      startWeek6PrecisionBehavior();
    }

    if (step.id === "week6-scroll-click") {
      startWeek6ScrollClickBehavior();
    }

    if (step.id === "week6-scroll-drag") {
      startWeek6ScrollDragBehavior();
    }

    if (step.id === "week6-mixed-skills") {
      startWeek6MixedBehavior();
    }

    if (step.id === "week5-quick-review") {
      startWeek5QuickReviewAnimation();
    }

    if (step.id === "week5-meet-wheel") {
      startWeek5MeetWheelAnimation();
    }

    if (step.id === "week5-scroll-down") {
      startWeek5ScrollDownBehavior();
    }

    if (step.id === "week5-scroll-up") {
      startWeek5ScrollUpBehavior();
    }

    if (step.id === "week5-scroll-practice") {
      startWeek5ScrollPracticeBehavior();
    }

    if (step.id === "week5-stop-target") {
      startWeek5StopTargetBehavior();
    }

    if (step.id === "week5-scroll-click") {
      startWeek5ScrollClickBehavior();
    }

    if (step.id === "week5-scroll-drag") {
      startWeek5ScrollDragBehavior();
    }

    if (step.id === "week5-complete") {
      startWeek5CompleteBehavior();
    }

    if (step.id === "week4-warm-up") {
      startWeek4WarmUpBehavior();
    }

    if (step.id === "week4-sort") {
      startWeek4SortBehavior();
    }

    if (step.id === "week4-clean-up") {
      startWeek4CleanUpBehavior();
    }

    if (step.id === "week4-puzzle") {
      startWeek4PuzzleBehavior();
    }

    if (step.id === "week4-moving-targets") {
      startWeek4MovingTargetsBehavior();
    }

    if (step.id === "week4-activities") {
      startWeek4ActivitiesBehavior();
    }

    if (step.id === "week4-challenge") {
      startWeek4ChallengeBehavior();
    }

    if (step.id === "week4-complete") {
      startWeek4CompleteBehavior();
    }

    if (step.id === "meet-click-drag") {
      startMeetDragAnimation();
    }

    if (step.id === "press-and-hold") {
      startPressHoldBehavior();
    }

    if (step.id === "hold-and-move") {
      startHoldMoveBehavior();
    }

    if (step.id === "let-go") {
      startLetGoBehavior();
    }

    if (step.id === "drag-practice") {
      startDragPracticeBehavior();
    }

    if (step.id === "drag-and-drop") {
      startDragDropBehavior();
    }

    if (step.id === "drag-challenge") {
      startDragChallengeBehavior();
    }

    if (step.id === "drag-complete") {
      startDragCompleteBehavior();
    }

    if (
      step.id === "meet-the-mouse" ||
      step.id === "move-the-mouse"
    ) {
      startMeetMouseBehavior();
    }

    if (step.id === "movement-practice") {
      startMovementPracticeBehavior();
    }

    if (step.id === "left-click") {
      startLeftClickBehavior();
    }

    if (step.id === "left-click-practice") {
      startLeftClickPracticeBehavior();
    }

    if (step.id === "move-and-click") {
      startMoveAndClickBehavior();
    }

    if (step.id === "guided-practice") {
      startMouseChallengeBehavior();
    }


    if (mode === "student") {
      const backButton = document.getElementById("studentBackButton");
      const nextButton = document.getElementById("studentNextButton");

      backButton?.addEventListener("click", () => {
        const newStep = Math.max(currentDisplayedStep - 1, 0);

        sessionStorage.setItem(
          INDEPENDENT_STEP_KEY,
          String(newStep)
        );

        renderStep(newStep, "student");
      });

      nextButton?.addEventListener("click", () => {
        const newStep = Math.min(
          currentDisplayedStep + 1,
          lesson.steps.length - 1
        );

        sessionStorage.setItem(
          INDEPENDENT_STEP_KEY,
          String(newStep)
        );

        renderStep(newStep, "student");
      });
    }
  }

  function getIndependentStep() {
    const saved = Number(
      sessionStorage.getItem(INDEPENDENT_STEP_KEY)
    );

    if (!Number.isInteger(saved)) {
      return 0;
    }

    return Math.min(
      Math.max(saved, 0),
      lesson.steps.length - 1
    );
  }

  function updateFingerHighlight(value) {
    const hand = document.querySelector(".hold-mouse-hand");

    if (!hand) {
      return;
    }

    hand.dataset.highlight = value || "";
  }

  async function syncLessonState() {
    try {
      const response = await fetch("/api/classroom-state", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Unable to load classroom lesson state.");
      }

      const state = await response.json();
      const mode = state.lessonControlMode || "teacher";


      if (
        state.activeLesson === "review1" &&
        state.reviewActivitiesReleased === true
      ) {
        /*
         * Once a student opens an activity, leave that
         * activity alone until it finishes and returns
         * itself to the hub.
         */
        if (currentMode !== "review-activity") {
          stopStepBehavior();
          currentMode = "review-activities";
          showReviewActivitiesHub();
        }

        return;
      }

      const requestedLessonId =
        state.activeLesson || "week1";

      const requestedLesson =
        window.HandsOnMouseLessons?.[requestedLessonId];

      if (
        requestedLesson &&
        Array.isArray(requestedLesson.steps)
      ) {
        lesson = requestedLesson;
      }

      const lessonChanged =
        requestedLessonId !== currentDisplayedLessonId;

      if (isTeacher) {
        const menu =
          document.getElementById("teacherLessonMenu");

        if (menu && !menu.hidden) {
          return;
        }
      }

      showLessonView();

      const sharedStep =
        state.currentLessonStep ?? 0;

      if (isTeacher) {
        if (
          currentMode !== "teacher-view" ||
          lessonChanged ||
          currentDisplayedStep !== sharedStep
        ) {
          currentMode = "teacher-view";
          currentDisplayedLessonId = requestedLessonId;
          renderStep(sharedStep, "teacher");
        }

      } else if (mode === "teacher") {

        /*
         * Week 1 has the special behavior where a student
         * who finishes Step 9 can independently remain on
         * Step 10 while the teacher stays on Step 9.
         *
         * Review lessons should not inherit that behavior.
         */
        if (requestedLessonId === "week1") {
          const week1Complete =
            sessionStorage.getItem(
              "handsOnMouseWeek1Complete"
            ) === "true";

          const challengeStep =
            lesson.steps.findIndex(
              step => step.id === "guided-practice"
            );

          const completeStep =
            lesson.steps.findIndex(
              step => step.id === "complete"
            );

          if (
            week1Complete &&
            sharedStep === challengeStep
          ) {
            if (
              currentMode !== "student-complete" ||
              lessonChanged ||
              currentDisplayedStep !== completeStep
            ) {
              currentMode = "student-complete";
              currentDisplayedLessonId =
                requestedLessonId;

              renderStep(
                completeStep,
                "teacher"
              );
            }
          } else {
            if (
              week1Complete &&
              sharedStep < challengeStep
            ) {
              sessionStorage.removeItem(
                "handsOnMouseWeek1Complete"
              );
            }

            if (
              currentMode !== "teacher" ||
              lessonChanged ||
              currentDisplayedStep !== sharedStep
            ) {
              currentMode = "teacher";
              currentDisplayedLessonId =
                requestedLessonId;

              renderStep(
                sharedStep,
                "teacher"
              );
            }
          }

        } else if (requestedLessonId === "week3") {

          /*
           * Week 3 mirrors Week 1:
           *
           * A student who completes the Drag Challenge
           * may move to Dragging Master while the teacher
           * remains on the challenge screen.
           */
          const week3Complete =
            sessionStorage.getItem(
              "handsOnMouseWeek3Complete"
            ) === "true";

          const challengeStep =
            lesson.steps.findIndex(
              step =>
                step.id === "drag-challenge"
            );

          const completeStep =
            lesson.steps.findIndex(
              step =>
                step.id === "drag-complete"
            );

          if (
            week3Complete &&
            sharedStep === challengeStep
          ) {
            if (
              currentMode !== "student-complete" ||
              lessonChanged ||
              currentDisplayedStep !== completeStep
            ) {
              currentMode =
                "student-complete";

              currentDisplayedLessonId =
                requestedLessonId;

              renderStep(
                completeStep,
                "teacher"
              );
            }
          } else {

            /*
             * If the teacher moves backward before
             * the challenge, reset the student's
             * completion flag for a fresh run.
             */
            if (
              week3Complete &&
              sharedStep < challengeStep
            ) {
              sessionStorage.removeItem(
                "handsOnMouseWeek3Complete"
              );
            }

            if (
              currentMode !== "teacher" ||
              lessonChanged ||
              currentDisplayedStep !== sharedStep
            ) {
              currentMode = "teacher";

              currentDisplayedLessonId =
                requestedLessonId;

              renderStep(
                sharedStep,
                "teacher"
              );
            }
          }

        } else {
          /*
           * Other teacher-led lessons simply follow
           * the teacher's currently selected step.
           */
          if (
            currentMode !== "teacher" ||
            lessonChanged ||
            currentDisplayedStep !== sharedStep
          ) {
            currentMode = "teacher";
            currentDisplayedLessonId =
              requestedLessonId;

            renderStep(
              sharedStep,
              "teacher"
            );
          }
        }

      } else {
        if (
          currentMode !== "student" ||
          lessonChanged
        ) {
          currentMode = "student";
          currentDisplayedLessonId =
            requestedLessonId;

          renderStep(
            getIndependentStep(),
            "student"
          );
        }
      }

      updateFingerHighlight(
        state.fingerHighlight
      );

      syncReviewBoardState(state);

    } catch (error) {
      console.error(
        "Student lesson controller:",
        error
      );
    }
  }

  async function loadSoundSetting() {
    try {
      const response = await fetch("/api/settings");

      if (!response.ok) {
        throw new Error("Unable to load sound setting.");
      }

      const settings = await response.json();
      soundEnabled = settings.soundEnabled !== false;
    } catch (error) {
      console.error("Could not load sound setting:", error);
      soundEnabled = true;
    }
  }

  window.addEventListener(
    "handsOnMouseLessonSelected",
    () => {
      currentDisplayedStep = -1;
      syncLessonState();
    }
  );

  loadSoundSetting();
  syncLessonState();
  setInterval(syncLessonState, 1000);
})();







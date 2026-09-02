(() => {
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

  let removeDragDropMoveListener = null;
  let removeDragDropLeftDownListener = null;
  let removeDragDropRightListener = null;
  let dragDropNativeReleaseHandler = null;

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

        } else {
          /*
           * Review and future lessons simply follow the
           * teacher's currently selected lesson/step.
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

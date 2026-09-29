(() => {
  "use strict";

  const COMMANDS = [
    {
      id: "go",
      icon: "⬆️",
      word: "GO"
    },
    {
      id: "turn",
      icon: "↪️",
      word: "TURN"
    },
    {
      id: "scan",
      icon: "🔎",
      word: "SCAN"
    }
  ];

  function initRoverLesson() {
    const screen =
      document.querySelector(".lesson-screen-week10-rover");

    if (!screen || screen.dataset.roverSafeReady === "true") {
      return;
    }

    screen.dataset.roverSafeReady = "true";

    const rover =
      screen.querySelector("#week10Rover");

    const menu =
      screen.querySelector("#week10RoverMenu");

    const status =
      screen.querySelector("#week10RoverStatus");

    const targetIcon =
      screen.querySelector("#week10RoverTargetIcon");

    const targetWord =
      screen.querySelector("#week10RoverTargetWord");

    const scanBeam =
      screen.querySelector("#week10RoverScanBeam");

    const rightWarning =
      screen.querySelector("#week10RoverRightClickWarning");

    const leftWarning =
      screen.querySelector("#week10RoverLeftClickWarning");

    const complete =
      screen.querySelector("#week10RoverComplete");

    const choices =
      Array.from(
        screen.querySelectorAll(
          "[data-week10-rover-command]"
        )
      );

    const progressStars =
      Array.from(
        screen.querySelectorAll(
          "[data-week10-rover-star]"
        )
      );

    if (
      !rover ||
      !menu ||
      !status ||
      !targetIcon ||
      !targetWord ||
      !rightWarning ||
      !leftWarning ||
      !complete
    ) {
      return;
    }

    let missionIndex = 0;
    let locked = false;
    let warningTimer = null;

    function playSound(src, volume = 0.6) {
      try {
        const sound = new Audio(src);
        sound.volume = volume;
        sound.play().catch(() => {});
        return sound;
      } catch (error) {
        return null;
      }
    }

    function hideWarnings() {
      rightWarning.hidden = true;
      leftWarning.hidden = true;

      if (warningTimer) {
        window.clearTimeout(warningTimer);
        warningTimer = null;
      }
    }

    function showWarning(element) {
      hideWarnings();

      element.hidden = false;

      warningTimer =
        window.setTimeout(() => {
          element.hidden = true;
          warningTimer = null;
        }, 1800);
    }

    function closeMenu() {
      menu.hidden = true;
      screen.classList.remove("week10-rover-menu-open");
    }

    function openMenu() {
      if (locked) {
        return;
      }

      hideWarnings();

      menu.hidden = false;
      screen.classList.add("week10-rover-menu-open");

      status.innerHTML =
        "<span>👆</span><strong>LEFT-CLICK THE COMMAND</strong>";
    }

    function updateMission() {
      const mission = COMMANDS[missionIndex];

      if (!mission) {
        return;
      }

      targetIcon.textContent = mission.icon;
      targetWord.textContent = mission.word;

      progressStars.forEach((star, index) => {
        star.textContent =
          index < missionIndex
            ? "★"
            : "☆";
      });

      status.innerHTML =
        "<span>🖱️</span><strong>RIGHT-CLICK THE ROVER</strong>";
    }

    function clearActionClasses() {
      rover.classList.remove(
        "week10-rover-action-go",
        "week10-rover-action-turn",
        "week10-rover-action-scan",
        "week10-rover-action-wrong"
      );

      if (scanBeam) {
        scanBeam.hidden = true;
      }
    }

    function runRoverAction(command) {
      clearActionClasses();

      void rover.offsetWidth;

      if (command === "go") {
        rover.classList.add("week10-rover-action-go");

        window.setTimeout(() => {
          rover.classList.remove("week10-rover-action-go");
          rover.classList.add("week10-rover-position-forward");
        }, 900);

        return;
      }

      if (command === "turn") {
        rover.classList.add("week10-rover-action-turn");

        window.setTimeout(() => {
          rover.classList.remove("week10-rover-action-turn");
          rover.classList.add("week10-rover-position-turned");
        }, 900);

        return;
      }

      if (command === "scan") {
        rover.classList.add("week10-rover-action-scan");

        if (scanBeam) {
          scanBeam.hidden = false;
        }

        playSound("/sounds/scan.mp3", 0.72);

        const crystal =
          screen.querySelector("#week10RoverCrystal");

        if (crystal) {
          crystal.classList.add("week10-rover-crystal-scanning");
        }

        window.setTimeout(() => {
          rover.classList.remove("week10-rover-action-scan");

          if (scanBeam) {
            scanBeam.hidden = true;
          }

          if (crystal) {
            crystal.classList.remove("week10-rover-crystal-scanning");
            crystal.classList.add("week10-rover-crystal-found");
          }
        }, 1100);
      }
    }

    function wrongCommand() {
      locked = true;

      playSound("/sounds/buzzer.mp3", 0.52);

      clearActionClasses();
      rover.classList.add("week10-rover-action-wrong");

      status.innerHTML =
        "<span>👀</span><strong>LOOK AT THE MISSION!</strong>";

      window.setTimeout(() => {
        rover.classList.remove(
          "week10-rover-action-wrong"
        );

        status.innerHTML =
          "<span>🖱️</span><strong>RIGHT-CLICK THE ROVER</strong>";

        locked = false;
      }, 900);
    }

    function finishMission() {
      locked = true;
      closeMenu();
      clearActionClasses();

      playSound("/sounds/complete.mp3", 0.78);

      progressStars.forEach((star) => {
        star.textContent = "★";
      });

      status.innerHTML =
        "<span>⭐</span><strong>MISSION COMPLETE!</strong>";

      window.setTimeout(() => {
        complete.hidden = false;
      }, 350);
    }

    function correctCommand(command) {
      locked = true;
      closeMenu();

      progressStars[missionIndex].textContent = "★";

      runRoverAction(command);

      status.innerHTML =
        "<span>⭐</span><strong>GREAT COMMAND!</strong>";

      window.setTimeout(() => {
        missionIndex += 1;

        if (missionIndex >= COMMANDS.length) {
          finishMission();
          return;
        }

        updateMission();
        locked = false;
      }, 1250);
    }

    rover.addEventListener(
      "contextmenu",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        playSound("/sounds/boom.mp3", 0.52);
        openMenu();
      }
    );

    rover.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (locked) {
          return;
        }

        closeMenu();
        showWarning(rightWarning);
      }
    );

    choices.forEach((choice) => {
      choice.addEventListener(
        "contextmenu",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          showWarning(leftWarning);
        }
      );

      choice.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (locked) {
            return;
          }

          const selected =
            choice.dataset.week10RoverCommand;

          const expected =
            COMMANDS[missionIndex]?.id;

          playSound("/sounds/mouseclick.mp3", 0.58);

          if (selected === expected) {
            correctCommand(selected);
          } else {
            closeMenu();
            wrongCommand();
          }
        }
      );
    });

    screen.addEventListener(
      "contextmenu",
      (event) => {
        if (
          !event.target.closest("#week10Rover") &&
          !event.target.closest(
            "[data-week10-rover-command]"
          )
        ) {
          event.preventDefault();
        }
      }
    );

    screen.addEventListener(
      "click",
      (event) => {
        if (
          menu.hidden ||
          event.target.closest("#week10RoverMenu") ||
          event.target.closest("#week10Rover")
        ) {
          return;
        }

        closeMenu();
      }
    );

    updateMission();
  }

  const observer =
    new MutationObserver(() => {
      initRoverLesson();
    });

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );

  document.addEventListener(
    "DOMContentLoaded",
    initRoverLesson
  );

  initRoverLesson();
})();



(() => {
  "use strict";

  const MISSIONS = [
    {
      id: "fix",
      icon: "🔧",
      word: "FIX"
    },
    {
      id: "clean",
      icon: "🧹",
      word: "CLEAN"
    },
    {
      id: "light",
      icon: "💡",
      word: "LIGHT"
    }
  ];

  function initDinoMuseum() {
    const screen =
      document.querySelector(".lesson-screen-week10-dino");

    if (!screen || screen.dataset.dinoSafeReady === "true") {
      return;
    }

    screen.dataset.dinoSafeReady = "true";

    const exhibit =
      screen.querySelector("#week10DinoExhibit");

    const menu =
      screen.querySelector("#week10DinoMenu");

    const status =
      screen.querySelector("#week10DinoStatus");

    const targetIcon =
      screen.querySelector("#week10DinoTargetIcon");

    const targetWord =
      screen.querySelector("#week10DinoTargetWord");


    const dirt =
      screen.querySelector("#week10DinoDirt");

    const spotlight =
      screen.querySelector("#week10DinoSpotlight");

    const rightWarning =
      screen.querySelector("#week10DinoRightWarning");

    const leftWarning =
      screen.querySelector("#week10DinoLeftWarning");

    const complete =
      screen.querySelector("#week10DinoComplete");

    const choices =
      Array.from(
        screen.querySelectorAll(
          "[data-week10-dino-command]"
        )
      );

    const stars =
      Array.from(
        screen.querySelectorAll(
          "[data-week10-dino-star]"
        )
      );

    if (
      !exhibit ||
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
        clearTimeout(warningTimer);
        warningTimer = null;
      }
    }

    function showWarning(element) {
      hideWarnings();

      element.hidden = false;

      warningTimer =
        setTimeout(() => {
          element.hidden = true;
          warningTimer = null;
        }, 1800);
    }

    function closeMenu() {
      menu.hidden = true;
    }

    function openMenu() {
      if (locked) {
        return;
      }

      hideWarnings();

      playSound("/sounds/boom.mp3", 0.5);

      menu.hidden = false;

      status.innerHTML =
        "<span>👆</span><strong>LEFT-CLICK THE TOOL</strong>";
    }

    function updateMission() {
      const mission = MISSIONS[missionIndex];

      if (!mission) {
        return;
      }

      targetIcon.textContent = mission.icon;
      targetWord.textContent = mission.word;

      stars.forEach((star, index) => {
        star.textContent =
          index < missionIndex
            ? "★"
            : "☆";
      });

      status.innerHTML =
        "<span>🖱️</span><strong>RIGHT-CLICK THE DINOSAUR</strong>";
    }

    function wrongChoice() {
      locked = true;

      playSound("/sounds/buzzer.mp3", 0.5);

      exhibit.classList.add("week10-dino-wrong");

      status.innerHTML =
        "<span>👀</span><strong>LOOK AT THE MUSEUM JOB!</strong>";

      setTimeout(() => {
        exhibit.classList.remove("week10-dino-wrong");

        status.innerHTML =
          "<span>🖱️</span><strong>RIGHT-CLICK THE DINOSAUR</strong>";

        locked = false;
      }, 900);
    }

    function runAction(command) {
      if (command === "fix") {
        exhibit.classList.add("week10-dino-fixing");

        setTimeout(() => {
          exhibit.classList.add("week10-dino-bone-fixed");
          exhibit.classList.remove("week10-dino-fixing");
        }, 750);

        return;
      }

      if (command === "clean") {
        exhibit.classList.add("week10-dino-cleaning");

        if (dirt) {
          dirt.classList.add("week10-dino-dirt-cleaning");
        }

        setTimeout(() => {
          if (dirt) {
            dirt.classList.add("week10-dino-dirt-gone");
          }

          exhibit.classList.remove("week10-dino-cleaning");
        }, 850);

        return;
      }

      if (command === "light") {
        if (spotlight) {
          spotlight.hidden = false;
        }

        playSound("/sounds/spotlight.mp3", 0.72);

        screen.classList.add("week10-dino-lights-on");

        exhibit.classList.add("week10-dino-lit");
      }
    }

    function finishMuseum() {
      locked = true;
      closeMenu();

      stars.forEach((star) => {
        star.textContent = "★";
      });

      status.innerHTML =
        "<span>⭐</span><strong>MUSEUM RESCUED!</strong>";

      playSound("/sounds/complete.mp3", 0.78);

      setTimeout(() => {
        complete.hidden = false;
      }, 450);
    }

    function correctChoice(command) {
      locked = true;
      closeMenu();

      playSound("/sounds/mouseclick.mp3", 0.58);

      stars[missionIndex].textContent = "★";

      status.innerHTML =
        "<span>⭐</span><strong>GREAT JOB!</strong>";

      runAction(command);

      setTimeout(() => {
        missionIndex += 1;

        if (missionIndex >= MISSIONS.length) {
          finishMuseum();
          return;
        }

        updateMission();
        locked = false;
      }, 1250);
    }

    exhibit.addEventListener(
      "contextmenu",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        openMenu();
      }
    );

    exhibit.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (locked) {
          return;
        }

        closeMenu();

        playSound("/sounds/buzzer.mp3", 0.48);

        showWarning(rightWarning);
      }
    );

    choices.forEach((choice) => {
      choice.addEventListener(
        "contextmenu",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          playSound("/sounds/buzzer.mp3", 0.45);

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
            choice.dataset.week10DinoCommand;

          const expected =
            MISSIONS[missionIndex]?.id;

          if (selected === expected) {
            correctChoice(selected);
          } else {
            playSound("/sounds/mouseclick.mp3", 0.52);
            closeMenu();
            wrongChoice();
          }
        }
      );
    });

    screen.addEventListener(
      "contextmenu",
      (event) => {
        if (
          !event.target.closest("#week10DinoExhibit") &&
          !event.target.closest(
            "[data-week10-dino-command]"
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
          event.target.closest("#week10DinoMenu") ||
          event.target.closest("#week10DinoExhibit")
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
      initDinoMuseum();
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
    initDinoMuseum
  );

  initDinoMuseum();
})();



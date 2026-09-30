(() => {
  "use strict";

  const SKILLS = [
    "YOU LEARNED TO MOVE THE MOUSE!",
    "YOU LEARNED TO LEFT-CLICK!",
    "YOU LEARNED TO PRESS AND HOLD!",
    "YOU LEARNED TO DRAG!",
    "YOU LEARNED TO LET GO!",
    "YOU LEARNED TO SCROLL DOWN!",
    "YOU LEARNED TO SCROLL UP!",
    "YOU LEARNED TO SCROLL AND CLICK!",
    "YOU LEARNED TO SCROLL AND DRAG!",
    "YOU LEARNED TO DOUBLE-CLICK!",
    "YOU LEARNED TO RIGHT-CLICK!",
    "YOU LEARNED TO PICK FROM A MENU!"
  ];

  function initWrapup() {
    const screen =
      document.querySelector(
        ".lesson-screen-week10-wrapup"
      );

    if (
      !screen ||
      screen.dataset.wrapupSafeReady === "true"
    ) {
      return;
    }

    screen.dataset.wrapupSafeReady = "true";

    const stations =
      Array.from(
        screen.querySelectorAll(
          "[data-wrapup-station]"
        )
      );

    const message =
      screen.querySelector(
        "#week10WrapupMessage"
      );

    const mouse =
      screen.querySelector(
        "#week10WrapupMouse"
      );

    const complete =
      screen.querySelector(
        "#week10WrapupComplete"
      );

    if (
      stations.length === 0 ||
      !message ||
      !mouse ||
      !complete
    ) {
      return;
    }

    let index = 0;

    function playSound(src, volume = 0.6) {
      try {
        const sound = new Audio(src);

        sound.volume = volume;

        sound
          .play()
          .catch(() => {});

        return sound;
      } catch (error) {
        return null;
      }
    }

    function activateStation() {
      if (index >= stations.length) {
        finishWrapup();
        return;
      }

      stations.forEach((station) => {
        station.classList.remove(
          "week10-wrapup-station-active"
        );
      });

      const station =
        stations[index];

      station.classList.add(
        "week10-wrapup-station-active",
        "week10-wrapup-station-complete"
      );

      message.innerHTML =
        `<span>⭐</span><strong>${SKILLS[index]}</strong>`;

      mouse.dataset.position =
        String(index);

      playSound(
        "/sounds/correct.mp3",
        0.42
      );

      index += 1;

      setTimeout(
        activateStation,
        1050
      );
    }

    function finishWrapup() {
      stations.forEach((station) => {
        station.classList.add(
          "week10-wrapup-station-complete"
        );
      });

      message.innerHTML =
        "<span>🏆</span><strong>LOOK AT ALL YOUR MOUSE SKILLS!</strong>";

      playSound(
        "/sounds/complete.mp3",
        0.82
      );

      setTimeout(() => {
        complete.hidden = false;
      }, 900);
    }

    setTimeout(
      activateStation,
      700
    );
  }

  const observer =
    new MutationObserver(() => {
      initWrapup();
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
    initWrapup
  );

  initWrapup();
})();

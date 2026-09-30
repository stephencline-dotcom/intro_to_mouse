(() => {
  "use strict";

  const MISSIONS = [
    {
      object: "ghost",
      objectIcon: "👻",
      objectWord: "GHOST",
      helper: "light",
      helperIcon: "🔦"
    },
    {
      object: "web",
      objectIcon: "🕸️",
      objectWord: "WEB",
      helper: "clean",
      helperIcon: "🧹"
    },
    {
      object: "door",
      objectIcon: "🚪",
      objectWord: "DOOR",
      helper: "unlock",
      helperIcon: "🔑"
    }
  ];

  function initHauntedHouse() {
    const screen =
      document.querySelector(".lesson-screen-week10-haunted");

    if (!screen || screen.dataset.hauntedSafeReady === "true") {
      return;
    }

    screen.dataset.hauntedSafeReady = "true";

    const menu =
      screen.querySelector("#week10HauntedMenu");

    const status =
      screen.querySelector("#week10HauntedStatus");

    const targetIcon =
      screen.querySelector("#week10HauntedTargetIcon");

    const targetWord =
      screen.querySelector("#week10HauntedTargetWord");

    const ghost =
      screen.querySelector("#week10HauntedGhost");

    const web =
      screen.querySelector("#week10HauntedWeb");

    const door =
      screen.querySelector("#week10HauntedDoor");

    const lightBeam =
      screen.querySelector("#week10HauntedLightBeam");

    const rightWarning =
      screen.querySelector("#week10HauntedRightWarning");

    const leftWarning =
      screen.querySelector("#week10HauntedLeftWarning");

    const complete =
      screen.querySelector("#week10HauntedComplete");

    const objects =
      Array.from(
        screen.querySelectorAll(
          "[data-haunted-object]"
        )
      );

    const helpers =
      Array.from(
        screen.querySelectorAll(
          "[data-week10-haunted-helper]"
        )
      );

    const stars =
      Array.from(
        screen.querySelectorAll(
          "[data-week10-haunted-star]"
        )
      );

    if (
      !menu ||
      !status ||
      !targetIcon ||
      !targetWord ||
      !ghost ||
      !web ||
      !door ||
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

    function getCurrentMission() {
      return MISSIONS[missionIndex];
    }

    function updateMission() {
      const mission = getCurrentMission();

      if (!mission) {
        return;
      }

      targetIcon.textContent =
        mission.objectIcon;

      targetWord.textContent =
        mission.objectWord;

      objects.forEach((object) => {
        const isCurrent =
          object.dataset.hauntedObject ===
          mission.object;

        object.classList.toggle(
          "week10-haunted-object-active",
          isCurrent
        );
      });

      stars.forEach((star, index) => {
        star.textContent =
          index < missionIndex
            ? "★"
            : "☆";
      });

      status.innerHTML =
        `<span>🖱️</span><strong>RIGHT-CLICK THE ${mission.objectWord}</strong>`;
    }

    function openMenu() {
      hideWarnings();

      playSound("/sounds/boom.mp3", 0.5);

      menu.hidden = false;

      const mission =
        getCurrentMission();

      const helperWord =
        mission?.helper?.toUpperCase() || "HELPER";

      const helperIcon =
        mission?.helperIcon || "👆";

      status.innerHTML =
        `<span>${helperIcon}</span><strong>LEFT-CLICK ${helperWord}</strong>`;
    }

    function wrongObject() {
      playSound("/sounds/buzzer.mp3", 0.5);

      status.innerHTML =
        "<span>👀</span><strong>LOOK FOR THE GLOWING OBJECT!</strong>";

      setTimeout(() => {
        updateMission();
      }, 850);
    }

    function wrongHelper() {
      locked = true;

      playSound("/sounds/buzzer.mp3", 0.5);

      screen.classList.add("week10-haunted-wrong");

      status.innerHTML =
        "<span>👀</span><strong>LOOK AT THE HELP CARD!</strong>";

      setTimeout(() => {
        screen.classList.remove("week10-haunted-wrong");
        updateMission();
        locked = false;
      }, 900);
    }

    function runAction(helper) {
      if (helper === "light") {
        if (lightBeam) {
          lightBeam.hidden = false;
        }

        playSound(
          "/sounds/flashlight.mp3",
          0.72
        );

        ghost.classList.add(
          "week10-haunted-ghost-lit"
        );

        screen.classList.add(
          "week10-haunted-house-brighter"
        );

        return;
      }

      if (helper === "clean") {
        playSound(
          "/sounds/broom.mp3",
          0.68
        );

        web.classList.add(
          "week10-haunted-web-cleaned"
        );

        return;
      }

      if (helper === "unlock") {
        playSound(
          "/sounds/door.mp3",
          0.72
        );

        door.classList.add(
          "week10-haunted-door-open"
        );

        screen.classList.add(
          "week10-haunted-house-friendly"
        );

        setTimeout(() => {
          playSound(
            "/sounds/bones.mp3",
            0.68
          );
        }, 420);
      }
    }

    function finishHouse() {
      locked = true;
      closeMenu();

      stars.forEach((star) => {
        star.textContent = "★";
      });

      status.innerHTML =
        "<span>⭐</span><strong>HOUSE RESCUED!</strong>";

      playSound("/sounds/complete.mp3", 0.78);

      setTimeout(() => {
        complete.hidden = false;
      }, 450);
    }

    function correctHelper(helper) {
      locked = true;
      closeMenu();

      playSound("/sounds/mouseclick.mp3", 0.58);

      stars[missionIndex].textContent = "★";

      status.innerHTML =
        "<span>✨</span><strong>GREAT HELP!</strong>";

      runAction(helper);

      setTimeout(() => {
        missionIndex += 1;

        if (missionIndex >= MISSIONS.length) {
          finishHouse();
          return;
        }

        updateMission();
        locked = false;
      }, 1250);
    }

    objects.forEach((object) => {
      object.addEventListener(
        "contextmenu",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (locked) {
            return;
          }

          const mission =
            getCurrentMission();

          const selectedObject =
            object.dataset.hauntedObject;

          if (
            selectedObject !==
            mission?.object
          ) {
            wrongObject();
            return;
          }

          if (selectedObject === "ghost") {
            playSound(
              "/sounds/creepy.mp3",
              0.55
            );
          }

          openMenu();
        }
      );

      object.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (locked) {
            return;
          }

          closeMenu();

          playSound(
            "/sounds/buzzer.mp3",
            0.48
          );

          showWarning(rightWarning);
        }
      );
    });

    helpers.forEach((helperButton) => {
      helperButton.addEventListener(
        "contextmenu",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          playSound(
            "/sounds/buzzer.mp3",
            0.45
          );

          showWarning(leftWarning);
        }
      );

      helperButton.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (locked) {
            return;
          }

          const selected =
            helperButton.dataset
              .week10HauntedHelper;

          const expected =
            getCurrentMission()?.helper;

          if (selected === expected) {
            correctHelper(selected);
          } else {
            playSound(
              "/sounds/mouseclick.mp3",
              0.5
            );

            closeMenu();
            wrongHelper();
          }
        }
      );
    });

    screen.addEventListener(
      "contextmenu",
      (event) => {
        if (
          !event.target.closest(
            "[data-haunted-object]"
          ) &&
          !event.target.closest(
            "[data-week10-haunted-helper]"
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
          event.target.closest("#week10HauntedMenu") ||
          event.target.closest(
            "[data-haunted-object]"
          )
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
      initHauntedHouse();
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
    initHauntedHouse
  );

  initHauntedHouse();
})();





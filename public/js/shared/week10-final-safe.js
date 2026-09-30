(() => {
  "use strict";

  const ROUNDS = [
    {
      id: "robot",
      icon: "🤖",
      word: "ROBOT",
      action: "repair",
      actionIcon: "🔧",
      actionWord: "REPAIR"
    },
    {
      id: "treasure",
      icon: "🧰",
      word: "TREASURE",
      action: "unlock",
      actionIcon: "🔑",
      actionWord: "UNLOCK"
    },
    {
      id: "monster",
      icon: "👾",
      word: "MONSTER",
      action: "feed",
      actionIcon: "🍕",
      actionWord: "FEED"
    },
    {
      id: "rover",
      icon: "🤖",
      word: "ROVER",
      action: "scan",
      actionIcon: "🔎",
      actionWord: "SCAN"
    },
    {
      id: "dinosaur",
      icon: "🦖",
      word: "DINOSAUR",
      action: "fix",
      actionIcon: "🔧",
      actionWord: "FIX"
    },
    {
      id: "boss",
      icon: "🎁",
      word: "MYSTERY BOX",
      action: "open",
      actionIcon: "✨",
      actionWord: "OPEN",
      boss: true
    }
  ];

  const DECOYS = [
    { id: "ghost", icon: "👻" },
    { id: "moon", icon: "🌙" },
    { id: "apple", icon: "🍎" },
    { id: "web", icon: "🕸️" },
    { id: "gem", icon: "💎" },
    { id: "rocket", icon: "🚀" },
    { id: "pizza", icon: "🍕" },
    { id: "star", icon: "⭐" },
    { id: "bone", icon: "🦴" }
  ];

  const ACTIONS = [
    { id: "repair", icon: "🔧", word: "REPAIR" },
    { id: "unlock", icon: "🔑", word: "UNLOCK" },
    { id: "feed", icon: "🍕", word: "FEED" },
    { id: "scan", icon: "🔎", word: "SCAN" },
    { id: "fix", icon: "🛠️", word: "FIX" },
    { id: "open", icon: "✨", word: "OPEN" },
    { id: "clean", icon: "🧹", word: "CLEAN" },
    { id: "light", icon: "🔦", word: "LIGHT" }
  ];

  function shuffle(items) {
    const copy = [...items];

    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j =
        Math.floor(
          Math.random() * (i + 1)
        );

      [copy[i], copy[j]] =
        [copy[j], copy[i]];
    }

    return copy;
  }

  function initFinalMission() {
    const screen =
      document.querySelector(
        ".lesson-screen-week10-final"
      );

    if (
      !screen ||
      screen.dataset.finalSafeReady === "true"
    ) {
      return;
    }

    screen.dataset.finalSafeReady = "true";

    const arena =
      screen.querySelector("#week10FinalArena");

    const menu =
      screen.querySelector("#week10FinalMenu");

    const status =
      screen.querySelector("#week10FinalStatus");

    const roundDisplay =
      screen.querySelector("#week10FinalRound");

    const power =
      screen.querySelector("#week10FinalPower");

    const missionIcon =
      screen.querySelector(
        "#week10FinalMissionIcon"
      );

    const missionWord =
      screen.querySelector(
        "#week10FinalMissionWord"
      );

    const rightWarning =
      screen.querySelector(
        "#week10FinalRightWarning"
      );

    const leftWarning =
      screen.querySelector(
        "#week10FinalLeftWarning"
      );

    const complete =
      screen.querySelector(
        "#week10FinalComplete"
      );

    if (
      !arena ||
      !menu ||
      !status ||
      !roundDisplay ||
      !power ||
      !missionIcon ||
      !missionWord ||
      !rightWarning ||
      !leftWarning ||
      !complete
    ) {
      return;
    }

    let roundIndex = 0;
    let locked = false;
    let warningTimer = null;

    const roundOrder =
      shuffle(ROUNDS.slice(0, 5));

    roundOrder.push(ROUNDS[5]);

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
        }, 1600);
    }

    function closeMenu() {
      menu.hidden = true;
      menu.innerHTML = "";
    }

    function getRound() {
      return roundOrder[roundIndex];
    }

    function makeTarget(item, isCorrect, slot) {
      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        "week10-final-target";

      button.dataset.finalId =
        item.id;

      button.dataset.correct =
        isCorrect ? "true" : "false";

      button.dataset.slot =
        String(slot);

      button.innerHTML =
        `<span>${item.icon}</span>`;

      if (isCorrect) {
        button.classList.add(
          "week10-final-correct-target"
        );
      }

      button.addEventListener(
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
            0.45
          );

          showWarning(rightWarning);
        }
      );

      button.addEventListener(
        "contextmenu",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (locked) {
            return;
          }

          if (
            button.dataset.correct !==
            "true"
          ) {
            playSound(
              "/sounds/buzzer.mp3",
              0.48
            );

            button.classList.add(
              "week10-final-target-wrong"
            );

            status.innerHTML =
              "<span>👀</span><strong>FIND THE GLOWING TARGET!</strong>";

            setTimeout(() => {
              button.classList.remove(
                "week10-final-target-wrong"
              );

              status.innerHTML =
                "<span>🖱️</span><strong>RIGHT-CLICK THE TARGET!</strong>";
            }, 650);

            return;
          }

          playSound(
            "/sounds/boom.mp3",
            0.5
          );

          openActionMenu(button);
        }
      );

      return button;
    }

    function renderRound() {
      locked = false;
      closeMenu();

      const round =
        getRound();

      if (!round) {
        return;
      }

      arena.innerHTML = "";

      roundDisplay.textContent =
        String(roundIndex + 1);

      missionIcon.textContent =
        round.icon;

      missionWord.textContent =
        round.word;

      power.style.width =
        `${(roundIndex / 6) * 100}%`;

      screen.classList.toggle(
        "week10-final-boss-round",
        Boolean(round.boss)
      );

      const decoys =
        shuffle(
          DECOYS.filter(
            item =>
              item.id !== round.id
          )
        ).slice(0, 2);

      const targets =
        shuffle([
          {
            item: round,
            correct: true
          },
          {
            item: decoys[0],
            correct: false
          },
          {
            item: decoys[1],
            correct: false
          }
        ]);

      targets.forEach(
        (target, index) => {
          arena.appendChild(
            makeTarget(
              target.item,
              target.correct,
              index
            )
          );
        }
      );

      status.innerHTML =
        round.boss
          ? "<span>🔥</span><strong>FINAL BOSS! FIND THE MYSTERY BOX!</strong>"
          : "<span>👀</span><strong>FIND THE TARGET!</strong>";
    }

    function openActionMenu(target) {
      const round =
        getRound();

      if (!round) {
        return;
      }

      const wrongActions =
        shuffle(
          ACTIONS.filter(
            action =>
              action.id !== round.action
          )
        ).slice(0, 3);

      const choices =
        shuffle([
          {
            id: round.action,
            icon: round.actionIcon,
            word: round.actionWord,
            correct: true
          },
          ...wrongActions.map(
            action => ({
              ...action,
              correct: false
            })
          )
        ]);

      menu.innerHTML = "";

      choices.forEach((choice) => {
        const button =
          document.createElement("button");

        button.type = "button";

        button.dataset.finalAction =
          choice.id;

        button.dataset.correct =
          choice.correct
            ? "true"
            : "false";

        button.innerHTML =
          `<span>${choice.icon}</span><strong>${choice.word}</strong>`;

        button.addEventListener(
          "contextmenu",
          (event) => {
            event.preventDefault();
            event.stopPropagation();

            playSound(
              "/sounds/buzzer.mp3",
              0.44
            );

            showWarning(
              leftWarning
            );
          }
        );

        button.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (locked) {
              return;
            }

            playSound(
              "/sounds/mouseclick.mp3",
              0.56
            );

            if (
              button.dataset.correct ===
              "true"
            ) {
              correctAction(
                target,
                round
              );
            } else {
              wrongAction();
            }
          }
        );

        menu.appendChild(button);
      });

      menu.hidden = false;

      const arenaRect =
        arena.getBoundingClientRect();

      const targetRect =
        target.getBoundingClientRect();

      let left =
        targetRect.left -
        arenaRect.left +
        targetRect.width +
        12;

      let top =
        targetRect.top -
        arenaRect.top -
        25;

      if (left > arenaRect.width - 270) {
        left =
          targetRect.left -
          arenaRect.left -
          255;
      }

      if (top < 8) {
        top = 8;
      }

      menu.style.left =
        `${left}px`;

      menu.style.top =
        `${top}px`;

      status.innerHTML =
        `<span>${round.actionIcon}</span><strong>LEFT-CLICK ${round.actionWord}</strong>`;
    }

    function wrongAction() {
      closeMenu();

      playSound(
        "/sounds/buzzer.mp3",
        0.5
      );

      screen.classList.add(
        "week10-final-shake"
      );

      status.innerHTML =
        "<span>👀</span><strong>TRY ANOTHER ACTION!</strong>";

      setTimeout(() => {
        screen.classList.remove(
          "week10-final-shake"
        );

        status.innerHTML =
          "<span>🖱️</span><strong>RIGHT-CLICK THE TARGET AGAIN!</strong>";
      }, 700);
    }

    function correctAction(target, round) {
      locked = true;
      closeMenu();

      target.classList.add(
        "week10-final-target-success"
      );

      playSound(
        "/sounds/correct.mp3",
        0.68
      );

      status.innerHTML =
        "<span>⭐</span><strong>POWER UP!</strong>";

      const nextPercent =
        ((roundIndex + 1) / 6) *
        100;

      power.style.width =
        `${nextPercent}%`;

      if (round.boss) {
        target.innerHTML =
          "<span>🎉</span>";

        screen.classList.add(
          "week10-final-boss-defeated"
        );
      }

      setTimeout(() => {
        roundIndex += 1;

        if (
          roundIndex >=
          roundOrder.length
        ) {
          finishGame();
          return;
        }

        renderRound();
      }, round.boss ? 1200 : 850);
    }

    function finishGame() {
      locked = true;
      closeMenu();

      power.style.width = "100%";

      status.innerHTML =
        "<span>🏆</span><strong>FINAL MISSION COMPLETE!</strong>";

      playSound(
        "/sounds/complete.mp3",
        0.82
      );

      setTimeout(() => {
        complete.hidden = false;
      }, 500);
    }

    screen.addEventListener(
      "contextmenu",
      (event) => {
        if (
          !event.target.closest(
            ".week10-final-target"
          ) &&
          !event.target.closest(
            "[data-final-action]"
          )
        ) {
          event.preventDefault();
        }
      }
    );

    renderRound();
  }

  const observer =
    new MutationObserver(() => {
      initFinalMission();
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
    initFinalMission
  );

  initFinalMission();
})();

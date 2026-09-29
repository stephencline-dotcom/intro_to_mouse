(() => {
  "use strict";

  const recipes = [
    {
      id: "berry",
      icon: "🍓"
    },
    {
      id: "mushroom",
      icon: "🍄"
    },
    {
      id: "moon",
      icon: "🌙"
    }
  ];

  function playSound(file) {
    try {
      const audio = new Audio("/sounds/" + file);
      audio.volume = 0.72;

      audio.play().catch(() => {});
    } catch (error) {
      // Sound is optional.
    }
  }

  function createLeftClickWarning(screen) {
    const old =
      screen.querySelector(
        ".w10-safe-left-warning"
      );

    if (old) {
      old.remove();
    }

    const warning =
      document.createElement("div");

    warning.className =
      "w10-safe-left-warning";

    warning.innerHTML = `
      <div class="w10-safe-warning-card">

        <div class="w10-safe-warning-demo">

          <div class="w10-safe-warning-mouse">

            <span class="w10-safe-mouse-left"></span>
            <span class="w10-safe-mouse-right"></span>
            <span class="w10-safe-mouse-wheel"></span>

            <div class="w10-safe-warning-hand">

              <span class="w10-safe-hand-palm"></span>

              <span class="w10-safe-hand-index"></span>
              <span class="w10-safe-hand-middle"></span>
              <span class="w10-safe-hand-ring"></span>
              <span class="w10-safe-hand-pinky"></span>

              <span class="w10-safe-hand-thumb"></span>

            </div>

          </div>

          <strong>LEFT BUTTON</strong>

        </div>

        <div class="w10-safe-warning-message">

          <strong>REMEMBER!</strong>

          <span>
            LEFT-CLICK<br>
            TO SELECT
          </span>

        </div>

      </div>
    `;

    screen.appendChild(warning);

    playSound("mouseclick.mp3");

    window.setTimeout(() => {
      warning.remove();
    }, 1900);
  }

  function initializePotionLab(screen) {
    if (
      !screen ||
      screen.dataset.week10PotionSafe === "yes"
    ) {
      return;
    }

    const cauldron =
      screen.querySelector(
        "#week10PotionCauldron"
      );

    const menu =
      screen.querySelector(
        "#week10PotionMenu"
      );

    const target =
      screen.querySelector(
        "#week10PotionTarget"
      );

    const status =
      screen.querySelector(
        "#week10PotionStatus"
      );

    const burst =
      screen.querySelector(
        "#week10PotionIngredientBurst"
      );

    const complete =
      screen.querySelector(
        "#week10PotionComplete"
      );

    if (
      !cauldron ||
      !menu ||
      !target ||
      !status ||
      !burst ||
      !complete
    ) {
      return;
    }

    screen.dataset.week10PotionSafe = "yes";

    let round = 0;
    let menuOpen = false;
    let finished = false;

    function setStatus(message, type = "") {
      status.className =
        "week10-potion-status" +
        (
          type
            ? " week10-potion-status-" + type
            : ""
        );

      status.innerHTML = message;
    }

    function closeMenu() {
      menu.hidden = true;
      menuOpen = false;

      cauldron.classList.remove(
        "week10-potion-menu-open"
      );
    }

    function showRecipe() {
      const recipe = recipes[round];

      if (!recipe) {
        return;
      }

      target.textContent = recipe.icon;

      setStatus(
        "<span>🖱️</span>" +
        "<strong>RIGHT-CLICK THE CAULDRON</strong>"
      );
    }

    function showRightClickReminder() {
      setStatus(
        "<span>👉</span>" +
        "<strong>USE THE RIGHT MOUSE BUTTON!</strong>" +
        "<span>🖱️</span>",
        "warning"
      );

      screen.classList.remove(
        "week10-potion-wrong"
      );

      void screen.offsetWidth;

      screen.classList.add(
        "week10-potion-wrong"
      );

      playSound("buzzer.mp3");
    }

    screen.addEventListener(
      "contextmenu",
      (event) => {

        const element =
          event.target instanceof Element
            ? event.target
            : null;

        if (!element) {
          return;
        }

        const choice =
          element.closest(
            "[data-week10-potion-choice]"
          );

        if (choice) {

          event.preventDefault();

          if (menuOpen && !finished) {

            createLeftClickWarning(
              screen
            );

            setStatus(
              "<span>👆</span>" +
              "<strong>LEFT-CLICK A PICTURE!</strong>",
              "choose"
            );
          }

          return;
        }

        const hitCauldron =
          element.closest(
            "#week10PotionCauldron"
          );

        if (!hitCauldron) {
          return;
        }

        event.preventDefault();

        if (finished) {
          return;
        }

        menu.hidden = false;
        menuOpen = true;

        cauldron.classList.add(
          "week10-potion-menu-open"
        );

        setStatus(
          "<span>✨</span>" +
          "<strong>LEFT-CLICK THE MATCHING INGREDIENT!</strong>" +
          "<span>👆</span>",
          "choose"
        );

        playSound("mouseclick.mp3");
      }
    );


    screen.addEventListener(
      "click",
      (event) => {

        const element =
          event.target instanceof Element
            ? event.target
            : null;

        if (!element || finished) {
          return;
        }

        const choice =
          element.closest(
            "[data-week10-potion-choice]"
          );

        if (choice && menuOpen) {

          event.preventDefault();

          const recipe =
            recipes[round];

          if (!recipe) {
            return;
          }

          const picked =
            choice.dataset.week10PotionChoice;

          if (picked !== recipe.id) {

            choice.classList.remove(
              "week10-potion-choice-wrong"
            );

            void choice.offsetWidth;

            choice.classList.add(
              "week10-potion-choice-wrong"
            );

            setStatus(
              "<span>👀</span>" +
              "<strong>LOOK AT THE RECIPE AGAIN!</strong>" +
              "<span>" +
              recipe.icon +
              "</span>",
              "warning"
            );

            playSound("buzzer.mp3");

            return;
          }

          closeMenu();

          burst.hidden = false;
          burst.textContent = recipe.icon;

          burst.classList.remove(
            "week10-potion-burst-go"
          );

          void burst.offsetWidth;

          burst.classList.add(
            "week10-potion-burst-go"
          );

          cauldron.classList.remove(
            "week10-potion-success"
          );

          void cauldron.offsetWidth;

          cauldron.classList.add(
            "week10-potion-success"
          );

          const star =
            screen.querySelector(
              '[data-week10-potion-star="' +
              round +
              '"]'
            );

          if (star) {
            star.textContent = "⭐";

            star.classList.add(
              "week10-potion-star-earned"
            );
          }

          setStatus(
            "<span>✨</span>" +
            "<strong>MAGIC!</strong>" +
            "<span>⭐</span>",
            "success"
          );

          playSound("correct.mp3");

          round += 1;

          if (round >= recipes.length) {

            finished = true;

            window.setTimeout(() => {

              burst.hidden = true;
              complete.hidden = false;

              playSound("complete.mp3");

            }, 850);

            return;
          }

          window.setTimeout(() => {

            if (!screen.isConnected) {
              return;
            }

            burst.hidden = true;

            cauldron.classList.remove(
              "week10-potion-success"
            );

            showRecipe();

          }, 850);

          return;
        }

        const hitCauldron =
          element.closest(
            "#week10PotionCauldron"
          );

        if (
          hitCauldron &&
          !menuOpen
        ) {
          event.preventDefault();

          showRightClickReminder();

          return;
        }

        if (
          menuOpen &&
          !element.closest(
            "#week10PotionMenu"
          )
        ) {
          closeMenu();
        }
      }
    );

    showRecipe();
  }

  function scanForPotionLab() {
    const screen =
      document.getElementById(
        "week10PotionScreen"
      );

    if (screen) {
      initializePotionLab(screen);
    }
  }

  const observer =
    new MutationObserver(
      scanForPotionLab
    );

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );

  scanForPotionLab();
})();
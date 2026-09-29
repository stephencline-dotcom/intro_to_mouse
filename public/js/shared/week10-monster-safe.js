(() => {
  "use strict";

  const ORDERS = [
    {
      id: "pizza",
      icon: "🍕",
      word: "PIZZA"
    },
    {
      id: "apple",
      icon: "🍎",
      word: "APPLE"
    },
    {
      id: "icecream",
      icon: "🍦",
      word: "ICE CREAM"
    }
  ];

  function initMonsterRestaurant() {
    const screen =
      document.querySelector(".lesson-screen-week10-monster");

    if (!screen || screen.dataset.monsterSafeReady === "true") {
      return;
    }

    screen.dataset.monsterSafeReady = "true";

    const monster =
      screen.querySelector("#week10Monster");

    const menu =
      screen.querySelector("#week10MonsterMenu");

    const status =
      screen.querySelector("#week10MonsterStatus");

    const orderIcon =
      screen.querySelector("#week10MonsterOrderIcon");

    const orderWord =
      screen.querySelector("#week10MonsterOrderWord");

    const foodFly =
      screen.querySelector("#week10MonsterFoodFly");

    const rightWarning =
      screen.querySelector("#week10MonsterRightWarning");

    const leftWarning =
      screen.querySelector("#week10MonsterLeftWarning");

    const complete =
      screen.querySelector("#week10MonsterComplete");

    const choices =
      Array.from(
        screen.querySelectorAll(
          "[data-week10-monster-food]"
        )
      );

    const stars =
      Array.from(
        screen.querySelectorAll(
          "[data-week10-monster-star]"
        )
      );

    if (
      !monster ||
      !menu ||
      !status ||
      !orderIcon ||
      !orderWord ||
      !foodFly ||
      !rightWarning ||
      !leftWarning ||
      !complete
    ) {
      return;
    }

    let orderIndex = 0;
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

    function openMenu() {
      if (locked) {
        return;
      }

      hideWarnings();

      playSound("/sounds/boom.mp3", 0.5);

      menu.hidden = false;

      status.innerHTML =
        "<span>👆</span><strong>LEFT-CLICK THE FOOD</strong>";
    }

    function closeMenu() {
      menu.hidden = true;
    }

    function updateOrder() {
      const order = ORDERS[orderIndex];

      if (!order) {
        return;
      }

      orderIcon.textContent = order.icon;
      orderWord.textContent = order.word;

      stars.forEach((star, index) => {
        star.textContent =
          index < orderIndex
            ? "★"
            : "☆";
      });

      status.innerHTML =
        "<span>🖱️</span><strong>RIGHT-CLICK THE HUNGRY MONSTER</strong>";
    }

    function showWrongFood() {
      locked = true;

      playSound("/sounds/buzzer.mp3", 0.52);

      monster.classList.add("week10-monster-wrong");

      status.innerHTML =
        "<span>👀</span><strong>LOOK AT THE ORDER!</strong>";

      setTimeout(() => {
        monster.classList.remove("week10-monster-wrong");

        updateOrder();

        locked = false;
      }, 900);
    }

    function feedMonster(food) {
      const order = ORDERS[orderIndex];

      locked = true;
      closeMenu();

      playSound("/sounds/mouseclick.mp3", 0.58);

      foodFly.textContent = order.icon;
      foodFly.hidden = false;

      foodFly.classList.remove(
        "week10-monster-food-on-plate",
        "week10-monster-food-pickup"
      );

      void foodFly.offsetWidth;

      foodFly.classList.add(
        "week10-monster-food-on-plate"
      );

      status.innerHTML =
        "<span>🍽️</span><strong>ORDER SERVED!</strong>";

      setTimeout(() => {
        monster.classList.add(
          "week10-monster-reaching",
          "week10-monster-ready-to-eat"
        );

        foodFly.classList.remove(
          "week10-monster-food-on-plate"
        );

        foodFly.classList.add(
          "week10-monster-food-pickup"
        );

        status.innerHTML =
          "<span>😋</span><strong>YUM!</strong>";
      }, 650);

      setTimeout(() => {
        monster.classList.add(
          "week10-monster-chomp"
        );

        playSound(
          "/sounds/crunching.mp3",
          0.62
        );
      }, 1250);

      setTimeout(() => {
        foodFly.hidden = true;

        foodFly.classList.remove(
          "week10-monster-food-on-plate",
          "week10-monster-food-pickup"
        );

        monster.classList.remove(
          "week10-monster-reaching",
          "week10-monster-ready-to-eat",
          "week10-monster-chomp"
        );

        stars[orderIndex].textContent = "★";

        orderIndex += 1;

        if (orderIndex >= ORDERS.length) {
          finishRestaurant();
          return;
        }

        updateOrder();
        locked = false;
      }, 1900);
    }

    function finishRestaurant() {
      locked = true;
      closeMenu();

      stars.forEach((star) => {
        star.textContent = "★";
      });

      monster.classList.add("week10-monster-happy");

      status.innerHTML =
        "<span>⭐</span><strong>ALL ORDERS COMPLETE!</strong>";

      playSound("/sounds/complete.mp3", 0.78);

      setTimeout(() => {
        complete.hidden = false;
      }, 500);
    }

    monster.addEventListener(
      "contextmenu",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        openMenu();
      }
    );

    monster.addEventListener(
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
            choice.dataset.week10MonsterFood;

          const expected =
            ORDERS[orderIndex]?.id;

          if (selected === expected) {
            feedMonster(selected);
          } else {
            playSound("/sounds/mouseclick.mp3", 0.5);
            closeMenu();
            showWrongFood();
          }
        }
      );
    });

    screen.addEventListener(
      "contextmenu",
      (event) => {
        if (
          !event.target.closest("#week10Monster") &&
          !event.target.closest(
            "[data-week10-monster-food]"
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
          event.target.closest("#week10MonsterMenu") ||
          event.target.closest("#week10Monster")
        ) {
          return;
        }

        closeMenu();
      }
    );

    updateOrder();
  }

  const observer =
    new MutationObserver(() => {
      initMonsterRestaurant();
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
    initMonsterRestaurant
  );

  initMonsterRestaurant();
})();


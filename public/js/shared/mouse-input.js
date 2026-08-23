(() => {
  const listeners = {
    move: new Set(),
    leftDown: new Set(),
    rightDown: new Set(),
    wheel: new Set()
  };

  function emit(type, detail) {
    listeners[type]?.forEach((callback) => {
      callback(detail);
    });
  }

  function onPointerMove(event) {
    emit("move", {
      x: event.clientX,
      y: event.clientY,
      movementX: event.movementX,
      movementY: event.movementY,
      originalEvent: event
    });
  }

  function onPointerDown(event) {
    if (event.button === 0) {
      emit("leftDown", {
        x: event.clientX,
        y: event.clientY,
        originalEvent: event
      });
    }

    if (event.button === 2) {
      emit("rightDown", {
        x: event.clientX,
        y: event.clientY,
        originalEvent: event
      });
    }
  }

  function onWheel(event) {
    emit("wheel", {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      originalEvent: event
    });
  }

  function subscribe(type, callback) {
    if (!listeners[type]) {
      throw new Error(`Unknown mouse input type: ${type}`);
    }

    listeners[type].add(callback);

    return () => {
      listeners[type].delete(callback);
    };
  }

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("wheel", onWheel, { passive: true });

  window.HandsOnMouseInput = {
    subscribe
  };
})();

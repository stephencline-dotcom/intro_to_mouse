(() => {
  const teacherSession = window.HandsOnMouseTeacherSession;
  const isTeacher = teacherSession?.isTeacherSession?.() === true;
  const STORAGE_KEY = "handsOnMouseStudentDataSession";
  const forceStudentSignIn = new URLSearchParams(window.location.search).get("student-signin") === "1";
  let session = null;
  let current = null;
  let observer = null;
  let heartbeat = null;
  let lastTick = performance.now();
  let frozenAt = null;
  let lastUserAction = 0;
  let lastWrongAt = 0;

  function loadSession() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (value?.token && value?.student?.id && value?.classroom?.id) return value;
    } catch {}
    return null;
  }

  function authHeaders() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${session?.token || ""}` };
  }

  function eligibleForTime() {
    return current && !document.hidden && !document.body.classList.contains("student-screen-frozen") && !document.body.classList.contains("student-training-paused");
  }

  function tick() {
    const now = performance.now();
    if (eligibleForTime()) current.activeMs += Math.max(0, Math.min(2000, now - lastTick));
    lastTick = now;
  }

  async function save(status = current?.completed ? "completed" : "started", keepalive = false) {
    if (!current?.attemptId || !session) return;
    tick();
    const payload = {
      status,
      activeMs: Math.round(current.activeMs),
      correctActions: current.correctActions,
      wrongActions: current.wrongActions,
      freezeCount: current.freezeCount,
      frozenMs: Math.round(current.frozenMs)
    };
    try {
      await fetch(`/api/mouse-data/attempts/${current.attemptId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
        keepalive
      });
    } catch (error) {
      console.error("Hands-On Mouse data save:", error);
    }
  }

  function isCompletionElement(element) {
    if (!(element instanceof HTMLElement)) return false;
    const id = element.id || "";
    if (!/(Complete|CompleteOverlay|Completion)$/i.test(id)) return false;
    return !element.hidden && getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility !== "hidden";
  }


  /*
   * Week 1 uses several different visual success signals.
   * Convert those signals into one reliable data completion event.
   */
  function week1StepLooksComplete() {
    if (!current || current.lessonId !== "week1") {
      return false;
    }

    const textIncludesComplete = selector => {
      const element = document.querySelector(selector);

      return Boolean(
        element &&
        /complete|finished|every direction/i.test(
          element.textContent || ""
        )
      );
    };

    switch (current.stepId) {
      case "movement-practice":
        return Boolean(
          document.querySelector(
            ".movement-practice-celebration"
          )
        ) ||
        textIncludesComplete(
          "#movementPracticeInstruction"
        ) ||
        textIncludesComplete(
          "#movementPracticeStatus"
        );

      case "left-click-practice":
        return (
          document
            .getElementById("leftClickPracticeTarget")
            ?.textContent
            ?.trim() === "✓"
        ) ||
        textIncludesComplete(
          "#leftClickPracticeStatus"
        );

      case "move-and-click":
        return (
          document
            .getElementById("moveClickTarget")
            ?.textContent
            ?.trim() === "✓"
        ) ||
        textIncludesComplete("#moveClickStatus");

      case "guided-practice":
        return (
          document
            .getElementById("mouseChallengeTarget")
            ?.textContent
            ?.trim() === "✓"
        ) ||
        textIncludesComplete(
          "#mouseChallengeStatus"
        );

      default:
        return false;
    }
  }


  function review1StepLooksComplete() {
    if (
      !current ||
      current.lessonId !== "review1" ||
      !current.stepId.startsWith("review-")
    ) {
      return false;
    }

    const activityId =
      current.stepId.slice("review-".length);

    return Boolean(
      document.querySelector(
        `[data-review-activity="${activityId}"].review-activity-complete`
      )
    );
  }


  function review1MistakeMessageOnScreen() {
    if (
      !current ||
      current.lessonId !== "review1" ||
      current.stepId === "review-bubble-pop" ||
      current.stepId === "review-mouse-sprint"
    ) {
      return false;
    }

    const mistakePattern =
      /wrong button|too fast|too soon|not that color|miss!|it escaped|keep looking for the deer|look for the glowing bubble|start again|try again/i;

    return [
      ...document.querySelectorAll(
        '[id*="Status"], [class*="status"], [class*="coaching"], [aria-live="polite"]'
      )
    ].some(element =>
      mistakePattern.test(
        element.textContent || ""
      )
    );
  }

  function review1ShowsWrongFeedback(records) {
    if (
      !current ||
      current.lessonId !== "review1" ||
      current.stepId === "review-bubble-pop" ||
      current.stepId === "review-mouse-sprint"
    ) {
      return false;
    }

    const mistakePattern =
      /wrong button|too fast|too soon|not that color|miss!|it escaped|keep looking for the deer|look for the glowing bubble|start again|try again/i;

    return records.some(record => {
      const target =
        record.target instanceof Element
          ? record.target
          : record.target?.parentElement;

      if (!target) {
        return false;
      }

      const feedback =
        target.closest(
          '[id*="Status"], [class*="status"], [class*="coaching"], [id*="Warning"], [class*="warning"]'
        ) || target;

      return mistakePattern.test(
        feedback.textContent || ""
      );
    });
  }

  function watchCompletion(root) {
    observer?.disconnect();
    observer = new MutationObserver(records => {
      if (week1StepLooksComplete() || review1StepLooksComplete()) {
        complete();
        return;
      }
      for (const record of records) {
        const candidates = [record.target, ...record.addedNodes];
        for (const candidate of candidates) {
          if (isCompletionElement(candidate) || (candidate instanceof Element && [...candidate.querySelectorAll("[id]")].some(isCompletionElement))) {
            complete();
            return;
          }
        }
      }
    });
    observer.observe(root || document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "class", "style"] });
  }

  async function beginStep(meta) {
    if (isTeacher || !session || !meta?.lessonId || !meta?.stepId) return;
    await leaveStep();
    const next = {
      lessonId: meta.lessonId,
      stepId: meta.stepId,
      stepTitle: meta.stepTitle || "",
      activeMs: 0,
      correctActions: 0,
      wrongActions: 0,
      freezeCount: 0,
      frozenMs: 0,
      completed: false,
      attemptId: null
    };
    current = next;
    lastTick = performance.now();

    /*
     * Start observing immediately so fast first mistakes
     * are not missed while the server request finishes.
     */
    watchCompletion(
      document.getElementById("studentLessonView") ||
      document.body
    );
    try {
      const response = await fetch("/api/mouse-data/attempts/start", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(meta)
      });
      const result = await response.json();
      if (current !== next) return;
      if (!response.ok) throw new Error(result.error || "Tracking could not start.");
      if (!result.tracked) { current = null; return; }
      current.attemptId = result.attempt.id;
      watchCompletion(document.getElementById("studentLessonView") || document.body);
    } catch (error) {
      console.error("Hands-On Mouse data start:", error);
      if (current === next) current = null;
    }
  }

  async function leaveStep() {
    if (!current) return;
    const leaving = current;
    if (frozenAt !== null) {
      leaving.frozenMs += performance.now() - frozenAt;
      frozenAt = null;
    }
    await save(leaving.completed ? "completed" : "incomplete", true);
    if (current === leaving) current = null;
    observer?.disconnect();
  }

  function correct(amount = 1) {
    if (current) current.correctActions += Math.max(1, Number(amount || 1));
  }

  function wrong(amount = 1) {
    if (!current) {
      return;
    }

    const now = performance.now();

    /*
     * One mistake can trigger both a visible warning
     * and a warning sound. Count that as one mistake.
     */
    if (now - lastWrongAt < 180) {
      return;
    }

    lastWrongAt = now;

    current.wrongActions +=
      Math.max(1, Number(amount || 1));
  }

  function wrongEach(amount = 1) {
    if (!current) {
      return;
    }

    current.wrongActions +=
      Math.max(1, Number(amount || 1));
  }

  function complete() {
    if (!current || current.completed) return;
    current.completed = true;
    save("completed");
  }

  function freezeStarted() {
    if (!current || frozenAt !== null) return;
    tick();
    current.freezeCount += 1;
    frozenAt = performance.now();
  }

  function freezeEnded() {
    if (!current || frozenAt === null) return;
    current.frozenMs += performance.now() - frozenAt;
    frozenAt = null;
    lastTick = performance.now();
    save(current.completed ? "completed" : "started");
  }

  function buildSignIn() {
    if (isTeacher || (session && !forceStudentSignIn)) return;
    const overlay = document.createElement("div");
    overlay.id = "mouseStudentSignIn";
    overlay.innerHTML = `
      <form class="mouse-student-signin-card">
        <div class="mouse-signin-icon">🖱️</div>
        <h1>Ready for Mouse Class?</h1>
        <label>Class Code<input name="classCode" maxlength="8" autocomplete="off" required></label>
        <label>Your Name<input name="studentName" maxlength="80" autocomplete="name" required></label>
        <button type="submit">Start</button>
        <p class="mouse-signin-status" aria-live="polite"></p>
      </form>`;
    document.body.appendChild(overlay);
    const form = overlay.querySelector("form");
    const status = overlay.querySelector(".mouse-signin-status");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      status.textContent = "Checking your class...";
      const values = new FormData(form);
      try {
        const response = await fetch("/api/mouse-data/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classCode: values.get("classCode"), studentName: values.get("studentName") })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not join the class.");
        if (current) await leaveStep();
        session = result;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        overlay.remove();
        if (forceStudentSignIn) {
          window.history.replaceState(null, "", window.location.pathname);
        }
        window.dispatchEvent(new CustomEvent("handsOnMouseStudentReady", { detail: result }));
      } catch (error) {
        status.textContent = error.message;
      }
    });
  }


  const review1ActivityTitles = {
    "bullseye": "Bullseye Click",
    "wait-for-it": "Wait for It",
    "corner-hunt": "Corner Hunt",
    "color-match": "Color Match",
    "mouse-sprint": "Mouse Sprint",
    "bubble-pop": "Bubble Pop"
  };

  window.addEventListener(
    "handsOnMouseReviewActivitySelected",
    event => {
      const activityId =
        String(event.detail?.activityId || "");

      const title =
        review1ActivityTitles[activityId];

      if (!title) {
        return;
      }

      queueMicrotask(() => {
        beginStep({
          lessonId: "review1",
          stepId: `review-${activityId}`,
          stepTitle: title,
          stepType: "practice"
        });
      });
    }
  );

  function review1PointerMistakeFallback() {
    if (
      !current ||
      current.lessonId !== "review1"
    ) {
      return;
    }

    /*
     * Let the activity process the click and update its
     * visible coaching message before checking it.
     */
    setTimeout(() => {
      if (review1MistakeMessageOnScreen()) {
        wrong();
      }
    }, 40);
  }

  document.addEventListener(
    "pointerdown",
    review1PointerMistakeFallback,
    true
  );

  session = loadSession();
  window.HandsOnMouseData = {
    beginStep,
    leaveStep,
    correct,
    wrong,
    wrongEach,
    complete,
    freezeStarted,
    freezeEnded,
    getSession: () => session,
    signOut() { localStorage.removeItem(STORAGE_KEY); location.reload(); }
  };

  if (!isTeacher) {
    document.addEventListener("pointerdown", () => { lastUserAction = performance.now(); }, true);
    document.addEventListener("wheel", () => { lastUserAction = performance.now(); }, { capture: true, passive: true });
    const originalPlay = window.Audio?.prototype?.play;
    if (originalPlay) {
      window.Audio.prototype.play = function (...args) {
        const source = String(this.currentSrc || this.src || "");
        if (performance.now() - lastUserAction < 1200) {
          if (/(wrongclick|mistake|buzzer)\.mp3/i.test(source)) wrong();
          if (/\/correct\.mp3/i.test(source)) correct();
        }
        return originalPlay.apply(this, args);
      };
    }
    heartbeat = setInterval(() => { tick(); save(current?.completed ? "completed" : "started"); }, 10000);
    document.addEventListener("visibilitychange", () => { tick(); lastTick = performance.now(); });
    window.addEventListener("pagehide", () => { leaveStep(); clearInterval(heartbeat); });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildSignIn, { once: true });
    else buildSignIn();
  }
})();

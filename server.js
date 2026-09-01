require("dotenv").config();

const express = require("express");
const path = require("path");
const defaultSettings = require("./server/defaultSettings");
const { normalizeSettings } = require("./server/settings");
const supabase = require("./server/supabase");

const app = express();

const PORT = process.env.PORT || 3000;

let freezeScreenArmed = false;
let freezeCycle = 0;
let freezeUnlockVersion = 0;
let trainingPaused = false;
let currentLessonStep = 0;
let lessonControlMode = "teacher";
let activeLesson = "week1";
let reviewMovementReleased = false;
let reviewActivitiesReleased = false;



let fingerHighlight = null;




// Parse JSON requests
app.use(express.json());

// Serve the student-facing app from /public
app.use(express.static(path.join(__dirname, "public")));

// Simple health check
// Teacher login
app.post("/api/teacher-login", (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      success: false,
      error: "Password is required."
    });
  }

  if (password !== process.env.TEACHER_PASSWORD) {
    return res.status(401).json({
      success: false,
      error: "Incorrect password."
    });
  }

  res.json({
    success: true
  });
});

app.get("/api/classroom-state", (req, res) => {
  res.json({
    freezeScreenArmed,
    freezeCycle,
    freezeUnlockVersion,
    trainingPaused,
    currentLessonStep,
    lessonControlMode,
    activeLesson,
    reviewMovementReleased,
    reviewActivitiesReleased,
    fingerHighlight
  });
});

app.put("/api/classroom-state", (req, res) => {
  if (typeof req.body.freezeScreenArmed === "boolean") {
    const wasArmed = freezeScreenArmed;
    freezeScreenArmed = req.body.freezeScreenArmed;

    /*
     * Every new Freeze ON starts a fresh cycle.
     * Any Chromebook released during an earlier
     * freeze must freeze again.
     */
    if (freezeScreenArmed && !wasArmed) {
      freezeCycle += 1;
    }
  }

  /*
   * UNLOCK ALL
   *
   * Release Unlocked only sets freezeScreenArmed=false.
   * This separate version change tells already-frozen
   * student screens to remove their overlays.
   */
  if (req.body.unlockAllFrozenStudents === true) {
    freezeScreenArmed = false;
    freezeUnlockVersion += 1;
  }

  if (typeof req.body.trainingPaused === "boolean") {
    trainingPaused = req.body.trainingPaused;
  }

  if (
    Number.isInteger(req.body.currentLessonStep) &&
    req.body.currentLessonStep >= 0
  ) {
    currentLessonStep = req.body.currentLessonStep;
  }

  if (
    req.body.lessonControlMode === "teacher" ||
    req.body.lessonControlMode === "student"
  ) {
    lessonControlMode = req.body.lessonControlMode;
  }

  if (
    req.body.activeLesson === "week1" ||
    req.body.activeLesson === "review1" ||
    req.body.activeLesson === "week3"
  ) {
    activeLesson = req.body.activeLesson;
    currentLessonStep = 0;
    fingerHighlight = null;
    reviewMovementReleased = false;
    reviewActivitiesReleased = false;
  }

  if (typeof req.body.reviewMovementReleased === "boolean") {
    reviewMovementReleased =
      req.body.reviewMovementReleased;
  }

  if (typeof req.body.reviewActivitiesReleased === "boolean") {
    reviewActivitiesReleased =
      req.body.reviewActivitiesReleased;
  }

  if (
    req.body.fingerHighlight === null ||
    ["thumb", "pointer", "middle", "other"].includes(
      req.body.fingerHighlight
    )
  ) {
    fingerHighlight = req.body.fingerHighlight;
  }

  res.json({
    freezeScreenArmed,
    freezeCycle,
    freezeUnlockVersion,
    trainingPaused,
    currentLessonStep,
    lessonControlMode,
    activeLesson,
    reviewMovementReleased,
    reviewActivitiesReleased,
    fingerHighlight
  });
});

app.post("/api/release-freeze-screen", (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      success: false,
      error: "Teacher password is required."
    });
  }

  if (password !== process.env.TEACHER_PASSWORD) {
    return res.status(401).json({
      success: false,
      error: "Incorrect teacher password."
    });
  }

  res.json({
    success: true,
    freezeCycle
  });
});

app.get("/api/settings", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("settings")
      .eq("id", 1)
      .single();

    if (error) {
      throw error;
    }

    const settings = normalizeSettings(
      data?.settings || defaultSettings
    );

    res.json(settings);
  } catch (error) {
    console.error("Failed to load settings from Supabase:", error);

    res.status(500).json({
      error: "Failed to load settings."
    });
  }
});

app.put("/api/settings", async (req, res) => {
  try {
    const { data: existingRow, error: readError } = await supabase
      .from("app_settings")
      .select("settings")
      .eq("id", 1)
      .single();

    if (readError) {
      throw readError;
    }

    const updatedSettings = normalizeSettings({
      ...(existingRow?.settings || defaultSettings),
      ...req.body
    });

    const { error: updateError } = await supabase
      .from("app_settings")
      .update({
        settings: updatedSettings,
        updated_at: new Date().toISOString()
      })
      .eq("id", 1);

    if (updateError) {
      throw updateError;
    }

    res.json(updatedSettings);
  } catch (error) {
    console.error("Failed to update settings in Supabase:", error);

    res.status(500).json({
      error: "Failed to update settings."
    });
  }
});
// Student homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Hands-On Mouse running on port ${PORT}`);
});
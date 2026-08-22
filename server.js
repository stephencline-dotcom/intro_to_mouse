require("dotenv").config();

const express = require("express");
const path = require("path");
const defaultSettings = require("./server/defaultSettings");
const { normalizeSettings } = require("./server/settings");
const supabase = require("./server/supabase");

const app = express();

const PORT = process.env.PORT || 3000;

let freezeScreenArmed = false;

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
    freezeScreenArmed
  });
});

app.put("/api/classroom-state", (req, res) => {
  if (typeof req.body.freezeScreenArmed === "boolean") {
    freezeScreenArmed = req.body.freezeScreenArmed;
  }

  res.json({
    freezeScreenArmed
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
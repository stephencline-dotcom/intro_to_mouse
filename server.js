const express = require("express");
const path = require("path");
const defaultSettings = require("./server/defaultSettings");
const { normalizeSettings } = require("./server/settings");
let currentSettings = normalizeSettings(defaultSettings);
const app = express();

const PORT = process.env.PORT || 3000;

// Parse JSON requests
app.use(express.json());

// Serve the student-facing app from /public
app.use(express.static(path.join(__dirname, "public")));

// Simple health check
app.get("/api/settings", (req, res) => {
  res.json(currentSettings);
});

app.put("/api/settings", (req, res) => {
  currentSettings = normalizeSettings({
    ...currentSettings,
    ...req.body
  });

  res.json(currentSettings);
});

// Student homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Hands-On Mouse running on port ${PORT}`);
});
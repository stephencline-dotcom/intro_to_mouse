const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

// Parse JSON requests
app.use(express.json());

// Serve the student-facing app from /public
app.use(express.static(path.join(__dirname, "public")));

// Simple health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Student homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Hands-On Mouse running on port ${PORT}`);
});
const defaultSettings = require("./defaultSettings");

function normalizeSettings(input = {}) {
  return {
    soundEnabled:
      typeof input.soundEnabled === "boolean"
        ? input.soundEnabled
        : defaultSettings.soundEnabled,

    freezeScreenFeatureEnabled:
      typeof input.freezeScreenFeatureEnabled === "boolean"
        ? input.freezeScreenFeatureEnabled
        : defaultSettings.freezeScreenFeatureEnabled,

    trainingPauseEnabled:
      typeof input.trainingPauseEnabled === "boolean"
        ? input.trainingPauseEnabled
        : defaultSettings.trainingPauseEnabled,

    mousePracticeEnabled:
      typeof input.mousePracticeEnabled === "boolean"
        ? input.mousePracticeEnabled
        : defaultSettings.mousePracticeEnabled
  };
}

module.exports = {
  normalizeSettings
};
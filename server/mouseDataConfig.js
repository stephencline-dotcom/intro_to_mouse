const trackableSteps = {
  week1: ["movement-practice", "left-click-practice", "move-and-click", "guided-practice"],
  review1: [
    "review-bullseye",
    "review-wait-for-it",
    "review-corner-hunt",
    "review-color-match",
    "review-mouse-sprint",
    "review-bubble-pop"
  ],
  week3: ["hold-and-move", "let-go", "drag-practice", "drag-and-drop", "drag-challenge"],
  week4: ["week4-warm-up", "week4-sort", "week4-clean-up", "week4-puzzle", "week4-moving-targets", "week4-activities", "week4-challenge"],
  week5: ["week5-scroll-practice", "week5-stop-target", "week5-scroll-click", "week5-scroll-drag"],
  week6: ["week6-warm-up", "week6-precision", "week6-scroll-click", "week6-scroll-drag", "week6-mixed-skills", "week6-activities"],
  week7: ["week7-click-rhythm", "week7-select-or-open", "week7-animal-doors", "week7-picture-gallery", "week7-hatch-eggs"],
  week8: ["week8-fireflies", "week8-space-launch", "week8-museum", "week8-special-delivery", "week8-carnival", "week8-computer-rescue"],
  week9: ["week9-meet-right-click", "week9-dress-character", "week9-pet-care", "week9-robot-repair", "week9-treasure-map", "week9-silly-scene"],
  week10: ["week10-potion-lab", "week10-space-rover", "week10-dinosaur-museum", "week10-monster-restaurant", "week10-haunted-house", "week10-final-mission"]
};

const expectedSeconds = {
  "guided-practice": 240,
  "drag-challenge": 240,
  "week4-challenge": 300,
  "week8-computer-rescue": 300,
  "week10-final-mission": 360
};

function isTrackable(lessonId, stepId) {
  return trackableSteps[lessonId]?.includes(stepId) === true;
}

function expectedTime(lessonId, stepId) {
  return expectedSeconds[stepId] || 210;
}

module.exports = { trackableSteps, isTrackable, expectedTime };

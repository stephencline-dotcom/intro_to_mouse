const fs=require('node:fs'); const assert=require('node:assert/strict');
const src=fs.readFileSync('public/js/shared/student-lesson-controller.js','utf8');
const config=fs.readFileSync('server/mouseDataConfig.js','utf8');
const cases=[
 ['startWeek6WarmUpBehavior','week6-warm-up'],
 ['startWeek6PrecisionBehavior','week6-precision'],
 ['startWeek6ScrollClickBehavior','week6-scroll-click'],
 ['startWeek6ScrollDragBehavior','week6-scroll-drag'],
 ['startWeek6MixedBehavior','week6-mixed-skills'],
 ['startWeek6ActivitiesBehavior','week6-activities'],
 ['startWeek7ClickRhythmBehavior','week7-click-rhythm'],
 ['startWeek7SelectOpenBehavior','week7-select-or-open'],
 ['startWeek7AnimalDoorsBehavior','week7-animal-doors'],
 ['startWeek7PictureGalleryBehavior','week7-picture-gallery'],
 ['startWeek7HatchEggsBehavior','week7-hatch-eggs']
];
const boundaries=[...src.matchAll(/^  (?:function|let|const) /gm)].map(m=>m.index);
for(const [fn,id] of cases){
 const start=src.indexOf('  function '+fn+'() {');
 assert(start>=0,'Missing '+fn);
 const end=boundaries.find(x=>x>start)??src.length;
 const section=src.slice(start,end);
 assert(section.includes('window.HandsOnMouseData?.complete?.()'),'Missing direct completion: '+id);
 assert(config.includes('"'+id+'"'),'Not configured: '+id);
 console.log('PASS completion hook '+id);
}
const w6=src.slice(src.indexOf('  function startWeek6ActivitiesBehavior()'),src.indexOf('  function startWeek6MixedBehavior()'));
assert(w6.includes('completedActivities.size === 3'),'Mini-game completion gate missing');
assert(!w6.includes('data-week6-test-complete'),'Test-complete bypass remains');
console.log('PASS three-game completion gate and no test shortcut');
for(const [fn,label] of [
 ['startWeek6MixedBehavior','robot mistakes'],
 ['startWeek6ScrollDragBehavior','delivery mistakes'],
 ['startWeek6ScrollClickBehavior','treasure mistakes'],
 ['startWeek7HatchEggsBehavior','egg mistakes'],
 ['startWeek7PictureGalleryBehavior','picture mistakes'],
 ['startWeek7AnimalDoorsBehavior','door mistakes'],
 ['startWeek7SelectOpenBehavior','desktop mistakes'],
 ['startWeek7ClickRhythmBehavior','rhythm mistakes']
]){
 const start=src.indexOf('  function '+fn+'() {');const end=boundaries.find(x=>x>start)??src.length;
 assert(src.slice(start,end).includes('window.HandsOnMouseData?.wrongEach?.()'),'Missing '+label);
 console.log('PASS '+label);
}
console.log('PASS 20 static tracking checks. Browser gameplay verification still required.');

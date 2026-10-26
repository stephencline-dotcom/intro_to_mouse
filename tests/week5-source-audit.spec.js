const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const source = fs.readFileSync('public/js/shared/student-lesson-controller.js', 'utf8');
const config = fs.readFileSync('server/mouseDataConfig.js', 'utf8');
const sections = [
  ['Scroll Practice','startWeek5ScrollPracticeBehavior','startWeek5ScrollUpBehavior','practice'],
  ['Stop at the Target','startWeek5StopTargetBehavior','startWeek5ScrollPracticeBehavior','stop'],
  ['Scroll & Click','startWeek5ScrollClickBehavior','startWeek5StopTargetBehavior','click'],
  ['Scroll & Drag','startWeek5ScrollDragBehavior','startWeek5ScrollClickBehavior','drag']
];
for (const [label,start,end,marker] of sections) {
  test(`${label}: direct completion is inside its finish function`, () => {
    const a=source.indexOf(`function ${start}()`), b=source.indexOf(`function ${end}()`,a+1);
    expect(a).toBeGreaterThan(-1);expect(b).toBeGreaterThan(a);
    const part=source.slice(a,b);
    const finish=part.indexOf(marker==='practice'?'function finish()':'function finishActivity()');
    expect(finish).toBeGreaterThan(-1);
    const after=part.slice(finish,finish+500);
    expect(after).toContain(`week5-direct-completion-${marker}`);
    expect(after).toContain('window.HandsOnMouseData?.complete?.()');
  });
}
for (const [label,start,end,marker] of [
  ['Wrong click','startWeek5ScrollClickBehavior','startWeek5StopTargetBehavior','week5-wrong-click'],
  ['Wrong drag object','startWeek5ScrollDragBehavior','startWeek5ScrollClickBehavior','week5-wrong-object'],
  ['Wrong drag drop','startWeek5ScrollDragBehavior','startWeek5ScrollClickBehavior','week5-wrong-drop']
]) test(`${label}: direct mistake hook exists`, () => {
  const a=source.indexOf(`function ${start}()`),b=source.indexOf(`function ${end}()`,a+1);
  const part=source.slice(a,b),i=part.indexOf(marker);
  expect(i).toBeGreaterThan(-1);
  expect(part.slice(i-65,i)).toContain('wrongEach');
});
test('Week 5 lists exactly four required activities',()=>{
  expect(config).toMatch(/week5:\s*\["week5-scroll-practice",\s*"week5-stop-target",\s*"week5-scroll-click",\s*"week5-scroll-drag"\]/);
});

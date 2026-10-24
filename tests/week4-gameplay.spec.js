const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'public/js/shared/student-lesson-controller.js'), 'utf8');

function extract(name, nextName) {
  const begin = source.indexOf(`  function ${name}()`);
  const end = source.indexOf(`  function ${nextName}()`, begin + 1);
  if (begin < 0 || end < 0) throw new Error(`Cannot isolate ${name}; controller structure changed`);
  return source.slice(begin, end);
}
const moving = extract('startWeek4MovingTargetsBehavior', 'startWeek4PuzzleBehavior');
const sort = extract('startWeek4SortBehavior', 'startWeek4WarmUpBehavior');

async function fixture(page, type) {
  const isSort = type === 'sort';
  const html = isSort ? `
  <div id="week4SortArea" style="position:relative;width:900px;height:550px;background:#eee">
    <div id="week4SortPointer" style="position:absolute;width:12px;height:12px;pointer-events:none"></div>
    <div class="week4-sort-object" data-category="red" style="position:absolute;left:18%;top:50%;width:70px;height:70px;transform:translate(-50%,-50%);background:red"></div>
    <div class="week4-sort-bin" data-category="red" style="position:absolute;left:600px;top:80px;width:160px;height:160px;background:#faa"></div>
    <div class="week4-sort-bin" data-category="blue" style="position:absolute;left:600px;top:300px;width:160px;height:160px;background:#aaf"></div>
    <div id="week4SortStatus"></div><div id="week4SortProgress"></div>
  </div>` : `
  <div id="week4MovingArea" style="position:relative;width:900px;height:550px;background:#eee">
    <div id="week4MovingPointer" style="position:absolute;width:12px;height:12px;pointer-events:none"></div>
    <div id="week4MovingObject" style="position:absolute;left:18%;top:50%;width:70px;height:70px;transform:translate(-50%,-50%);background:red"></div>
    <div id="week4MovingDestination" style="position:absolute;left:600px;top:80px;width:160px;height:160px;background:#aaf"></div>
    <div id="week4MovingStatus"></div><div id="week4MovingProgress"></div>
  </div>`;
  await page.route('http://mouse-gameplay.invalid/**', route => route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html><body>${html}</body></html>`}));
  await page.goto('http://mouse-gameplay.invalid/');
  await page.evaluate(({ code, functionName }) => {
    window.__events = {};
    window.__tracking = { wrong:0, complete:0 };
    window.HandsOnMouseData = { wrongEach: () => window.__tracking.wrong++, complete: () => window.__tracking.complete++ };
    window.HandsOnMouseInput = { subscribe(name, callback) { (window.__events[name] ||= []).push(callback); return () => {}; } };
    window.soundEnabled = false;
    window.leftClickSound = null;
    window.showWrongButtonWarning = () => {};
    window.pointerTipHitsElement = (pointer, element) => {
      const p = pointer.getBoundingClientRect(), e = element.getBoundingClientRect();
      const x = p.right, y = p.top + p.height/2;
      return x >= e.left && x <= e.right && y >= e.top && y <= e.bottom;
    };
    document.addEventListener('mousemove', e => (window.__events.move || []).forEach(fn => fn({x:e.clientX,y:e.clientY})));
    document.addEventListener('mousedown', e => (window.__events[e.button===2?'rightDown':'leftDown'] || []).forEach(fn => fn()));
    document.addEventListener('mouseup', e => (window.__events[e.button===0?'leftUp':'rightUp'] || []).forEach(fn => fn()));
    // Evaluate only the extracted, unmodified activity function from the real controller.
    (new Function(`${code}; ${functionName}();`))();
  }, { code:isSort?sort:moving, functionName:isSort?'startWeek4SortBehavior':'startWeek4MovingTargetsBehavior' });
}

for (const kind of ['sort','moving']) {
  test(`${kind}: physical incorrect drag increments mistake once`, async ({page}) => {
    await fixture(page, kind);
    const area = kind === 'sort' ? '#week4SortArea' : '#week4MovingArea';
    const obj = kind === 'sort' ? '.week4-sort-object' : '#week4MovingObject';
    const box = await page.locator(obj).boundingBox();
    const x=box.x+box.width/2, y=box.y+box.height/2;
    await page.mouse.move(x,y);
    await page.mouse.down();
    await page.mouse.move(x+100,y+30,{steps:10});
    await page.mouse.up();
    const state = await page.evaluate(() => window.__tracking);
    expect(state.wrong, 'A wrong physical drop should reach wrongEach exactly once').toBe(1);
    expect(state.complete).toBe(0);
    expect(await page.locator(area).count()).toBe(1);
  });
}
